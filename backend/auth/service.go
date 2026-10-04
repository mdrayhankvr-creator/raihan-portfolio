package auth

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"golang.org/x/crypto/bcrypt"
	"io"
	"log/slog"
	"mime"
	"net"
	"net/http"
	"raihan-portfolio/backend/handlers"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

type Options struct {
	Key    []byte
	TTL    time.Duration
	Secure bool
}
type Service struct {
	store     Store
	options   Options
	logger    *slog.Logger
	limiter   *loginLimiter
	dummyHash []byte
	now       func() time.Time
}
type principal struct {
	Admin   Admin
	Session Session
}
type principalKey struct{}

var errUnauthorized = errors.New("unauthorized")
var errForbidden = errors.New("forbidden")

func New(store Store, options Options, logger *slog.Logger) (*Service, error) {
	if len(options.Key) < 32 || options.TTL < time.Minute || options.TTL > time.Hour {
		return nil, errors.New("invalid authentication configuration")
	}
	random := make([]byte, 32)
	if _, err := rand.Read(random); err != nil {
		return nil, errors.New("cannot initialize authentication")
	}
	hash, err := bcrypt.GenerateFromPassword(random, PasswordCost)
	if err != nil {
		return nil, errors.New("cannot initialize authentication")
	}
	options.Key = append([]byte(nil), options.Key...)
	return &Service{store: store, options: options, logger: logger, limiter: newLimiter(), dummyHash: hash, now: time.Now}, nil
}
func (s *Service) CookieName() string {
	if s.options.Secure {
		return "__Host-portfolio_admin_session"
	}
	return "portfolio_admin_session"
}
func (s *Service) cookie(value string, expires time.Time, maxAge int) *http.Cookie {
	return &http.Cookie{Name: s.CookieName(), Value: value, Path: "/", HttpOnly: true, Secure: s.options.Secure, SameSite: http.SameSiteStrictMode, Expires: expires, MaxAge: maxAge}
}
func (s *Service) clearCookie(w http.ResponseWriter) {
	http.SetCookie(w, s.cookie("", time.Unix(1, 0), -1))
}
func (s *Service) sign(id string) string {
	mac := hmac.New(sha256.New, s.options.Key)
	mac.Write([]byte(id))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}
func sessionHash(id string) string {
	sum := sha256.Sum256([]byte(id))
	return hex.EncodeToString(sum[:])
}
func (s *Service) parse(value string) (string, error) {
	parts := strings.Split(value, ".")
	if len(parts) != 2 || len(parts[0]) != 43 {
		return "", errUnauthorized
	}
	id, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil || len(id) != 32 {
		return "", errUnauthorized
	}
	actual, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", errUnauthorized
	}
	expected, _ := base64.RawURLEncoding.DecodeString(s.sign(parts[0]))
	if !hmac.Equal(actual, expected) {
		return "", errUnauthorized
	}
	return sessionHash(parts[0]), nil
}
func (s *Service) authenticate(r *http.Request) (principal, error) {
	cookie, err := r.Cookie(s.CookieName())
	if err != nil {
		return principal{}, errUnauthorized
	}
	hash, err := s.parse(cookie.Value)
	if err != nil {
		return principal{}, errUnauthorized
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	session, err := s.store.FindSession(ctx, hash)
	if errors.Is(err, ErrNotFound) {
		return principal{}, errUnauthorized
	}
	if err != nil {
		return principal{}, err
	}
	if !s.now().Before(session.ExpiresAt) {
		return principal{}, errUnauthorized
	}
	admin, err := s.store.FindAdminByID(ctx, session.AdminID)
	if errors.Is(err, ErrNotFound) || (err == nil && admin.Disabled) {
		return principal{}, errUnauthorized
	}
	if err != nil {
		return principal{}, err
	}
	if admin.Role != "admin" {
		return principal{}, errForbidden
	}
	return principal{Admin: admin, Session: session}, nil
}

func (s *Service) Require(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, err := s.authenticate(r)
		if errors.Is(err, errUnauthorized) {
			s.clearCookie(w)
			handlers.Error(w, 401, "Authentication required")
			return
		}
		if errors.Is(err, errForbidden) {
			handlers.Error(w, 403, "Admin access required")
			return
		}
		if err != nil {
			s.logger.Error("Session check failed")
			handlers.Error(w, 500, "Unable to verify session. Please try again.")
			return
		}
		next(w, r.WithContext(context.WithValue(r.Context(), principalKey{}, user)))
	}
}
func respondSession(w http.ResponseWriter, user principal) {
	handlers.JSON(w, 200, map[string]any{"admin": map[string]string{"username": user.Admin.Username}, "expiresAt": user.Session.ExpiresAt})
}
func (s *Service) Me(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value(principalKey{}).(principal)
	respondSession(w, user)
}

func (s *Service) Login(w http.ResponseWriter, r *http.Request) {
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		ip = r.RemoteAddr
	}
	// Never trust forwarded IP headers from an unconfigured reverse proxy.
	if allowed, retry := s.limiter.allow(ip, s.now()); !allowed {
		w.Header().Set("Retry-After", strconv.Itoa(retry))
		handlers.Error(w, 429, "Too many login attempts. Try again later.")
		return
	}
	media, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || media != "application/json" {
		handlers.Error(w, 400, "Content-Type must be application/json")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 4096)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	var input *struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := decoder.Decode(&input); err != nil || input == nil {
		handlers.Error(w, 400, "Invalid login request")
		return
	}
	var extra any
	if decoder.Decode(&extra) != io.EOF {
		handlers.Error(w, 400, "Invalid login request")
		return
	}
	username, err := NormalizeUsername(input.Username)
	if err != nil || input.Password == "" || len(input.Password) > 72 || !utf8.ValidString(input.Password) {
		handlers.Error(w, 400, "Enter a valid username and password (up to 72 UTF-8 bytes)")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	admin, lookupErr := s.store.FindAdmin(ctx, username)
	if lookupErr != nil && !errors.Is(lookupErr, ErrNotFound) {
		s.logger.Error("Admin login database lookup failed")
		handlers.Error(w, 500, "Unable to sign in. Please try again.")
		return
	}
	hash := admin.PasswordHash
	if lookupErr != nil {
		hash = s.dummyHash
	}
	passwordErr := bcrypt.CompareHashAndPassword(hash, []byte(input.Password))
	input.Password = ""
	if lookupErr != nil || passwordErr != nil || admin.Disabled || admin.Role != "admin" {
		handlers.Error(w, 401, "Invalid username or password")
		return
	}
	random := make([]byte, 32)
	if _, err := rand.Read(random); err != nil {
		handlers.Error(w, 500, "Unable to sign in. Please try again.")
		return
	}
	id := base64.RawURLEncoding.EncodeToString(random)
	session := Session{Hash: sessionHash(id), AdminID: admin.ID, ExpiresAt: s.now().UTC().Add(s.options.TTL).Truncate(time.Second)}
	// Rotate a previous browser session on every successful login.
	if cookie, err := r.Cookie(s.CookieName()); err == nil {
		if hash, err := s.parse(cookie.Value); err == nil {
			if err := s.store.DeleteSession(ctx, hash); err != nil {
				s.logger.Error("Session rotation failed")
				handlers.Error(w, 500, "Unable to sign in. Please try again.")
				return
			}
		}
	}
	if err := s.store.CreateSession(ctx, session); err != nil {
		s.logger.Error("Session creation failed")
		handlers.Error(w, 500, "Unable to sign in. Please try again.")
		return
	}
	http.SetCookie(w, s.cookie(id+"."+s.sign(id), session.ExpiresAt, int(s.options.TTL.Seconds())))
	respondSession(w, principal{Admin: admin, Session: session})
}
func (s *Service) Logout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(s.CookieName()); err == nil {
		if hash, err := s.parse(cookie.Value); err == nil {
			ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
			defer cancel()
			if err := s.store.DeleteSession(ctx, hash); err != nil {
				s.logger.Error("Session revocation failed")
				handlers.Error(w, 500, "Unable to sign out. Please try again.")
				return
			}
		}
	}
	s.clearCookie(w)
	handlers.JSON(w, 200, map[string]string{"message": "Signed out"})
}
