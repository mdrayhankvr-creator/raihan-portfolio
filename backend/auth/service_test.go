package auth

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"go.mongodb.org/mongo-driver/v2/bson"
	"golang.org/x/crypto/bcrypt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"raihan-portfolio/backend/repository"
	"strings"
	"testing"
	"time"
)

// Memory storage exists only in tests. The production implementation always uses MongoDB.
type memoryStore struct {
	admin    Admin
	sessions map[string]Session
	failure  error
}

func (m *memoryStore) FindAdmin(_ context.Context, n string) (Admin, error) {
	if m.failure != nil {
		return Admin{}, m.failure
	}
	if n != m.admin.Username {
		return Admin{}, ErrNotFound
	}
	return m.admin, nil
}
func (m *memoryStore) FindAdminByID(c context.Context, id string) (Admin, error) {
	if id != m.admin.ID {
		return Admin{}, ErrNotFound
	}
	return m.FindAdmin(c, m.admin.Username)
}
func (m *memoryStore) CreateAdmin(_ context.Context, a Admin) error {
	if m.admin.ID != "" {
		return ErrAdminExists
	}
	a.ID = "primary-admin"
	m.admin = a
	return m.failure
}
func (m *memoryStore) CreateSession(_ context.Context, s Session) error {
	if m.failure != nil {
		return m.failure
	}
	m.sessions[s.Hash] = s
	return nil
}
func (m *memoryStore) FindSession(_ context.Context, id string) (Session, error) {
	if m.failure != nil {
		return Session{}, m.failure
	}
	s, ok := m.sessions[id]
	if !ok {
		return s, ErrNotFound
	}
	return s, nil
}
func (m *memoryStore) DeleteSession(_ context.Context, id string) error {
	if m.failure != nil {
		return m.failure
	}
	delete(m.sessions, id)
	return nil
}
func randomText(t *testing.T) string {
	t.Helper()
	b := make([]byte, 24)
	if _, e := rand.Read(b); e != nil {
		t.Fatal(e)
	}
	return hex.EncodeToString(b)
}
func newFixture(t *testing.T, store Store, secure bool) (*Service, string, *bytes.Buffer) {
	t.Helper()
	password := randomText(t)
	if err := InitializeAdmin(context.Background(), store, "fixture.admin", password); err != nil {
		t.Fatal(err)
	}
	key := make([]byte, 32)
	_, _ = rand.Read(key)
	logs := new(bytes.Buffer)
	s, err := New(store, Options{Key: key, TTL: 30 * time.Minute, Secure: secure}, slog.New(slog.NewTextHandler(logs, nil)))
	if err != nil {
		t.Fatal(err)
	}
	return s, password, logs
}
func callAuth(t *testing.T, h http.HandlerFunc, method, body string, cookie *http.Cookie, status int) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRequest(method, "/api/auth", strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	if cookie != nil {
		r.AddCookie(cookie)
	}
	w := httptest.NewRecorder()
	h(w, r)
	if w.Code != status {
		t.Fatalf("expected %d, got %d: %s", status, w.Code, w.Body)
	}
	if !json.Valid(w.Body.Bytes()) {
		t.Fatal("invalid JSON response")
	}
	return w
}
func credentials(username, password string) string {
	b, _ := json.Marshal(map[string]string{"username": username, "password": password})
	return string(b)
}
func TestSessionLifecycle(t *testing.T) {
	m := &memoryStore{sessions: map[string]Session{}}
	s, password, logs := newFixture(t, m, false)
	hash := m.admin.PasswordHash
	if bytes.Contains(hash, []byte(password)) {
		t.Fatal("plaintext password stored")
	}
	if cost, _ := bcrypt.Cost(hash); cost != 12 {
		t.Fatal("incorrect bcrypt cost")
	}
	if err := InitializeAdmin(context.Background(), m, "other.admin", randomText(t)); !errors.Is(err, ErrAdminExists) {
		t.Fatal("setup overwrote existing admin")
	}
	callAuth(t, s.Require(s.Me), "GET", "", nil, 401)
	callAuth(t, s.Login, "POST", credentials("fixture.admin", "incorrect password"), nil, 401)
	callAuth(t, s.Login, "POST", credentials("unknown.admin", password), nil, 401)
	w := callAuth(t, s.Login, "POST", credentials("fixture.admin", password), nil, 200)
	cookie := w.Result().Cookies()[0]
	if !cookie.HttpOnly || cookie.Secure || cookie.SameSite != http.SameSiteStrictMode || cookie.Path != "/" || cookie.Domain != "" || cookie.MaxAge != 1800 {
		t.Fatal("development cookie attributes incorrect")
	}
	if strings.Contains(w.Body.String(), password) || strings.Contains(w.Body.String(), "token") || strings.Contains(w.Body.String(), "passwordHash") {
		t.Fatal("secret in response")
	}
	id, err := s.parse(cookie.Value)
	if err != nil {
		t.Fatal(err)
	}
	if id == cookie.Value || len(id) != 64 {
		t.Fatal("session key must be hashed")
	}
	callAuth(t, s.Require(s.Me), "GET", "", cookie, 200)
	tampered := *cookie
	tampered.Value = "A" + cookie.Value[1:]
	if tampered.Value == cookie.Value {
		tampered.Value = "B" + cookie.Value[1:]
	}
	callAuth(t, s.Require(s.Me), "GET", "", &tampered, 401)
	originalNow := s.now
	s.now = func() time.Time { return originalNow().Add(31 * time.Minute) }
	callAuth(t, s.Require(s.Me), "GET", "", cookie, 401)
	s.now = originalNow
	m.admin.Role = "viewer"
	callAuth(t, s.Require(s.Me), "GET", "", cookie, 403)
	m.admin.Role = "admin"
	m.admin.Disabled = true
	callAuth(t, s.Require(s.Me), "GET", "", cookie, 401)
	m.admin.Disabled = false
	m.failure = errors.New("sensitive-password mongodb://secret@example.invalid")
	callAuth(t, s.Require(s.Me), "GET", "", cookie, 500)
	failure := callAuth(t, s.Logout, "POST", "", cookie, 500)
	if len(failure.Result().Cookies()) != 0 {
		t.Fatal("failed revocation faked successful logout")
	}
	m.failure = nil
	// Login rotates the previous cookie and revokes its server record.
	rotated := callAuth(t, s.Login, "POST", credentials("fixture.admin", password), cookie, 200).Result().Cookies()[0]
	callAuth(t, s.Require(s.Me), "GET", "", cookie, 401)
	callAuth(t, s.Require(s.Me), "GET", "", rotated, 200)
	logout := callAuth(t, s.Logout, "POST", "", rotated, 200)
	if logout.Result().Cookies()[0].MaxAge != -1 {
		t.Fatal("logout did not expire cookie")
	}
	callAuth(t, s.Require(s.Me), "GET", "", rotated, 401)
	callAuth(t, s.Logout, "POST", "", nil, 200)
	if strings.Contains(logs.String(), "secret") || strings.Contains(logs.String(), password) || strings.Contains(logs.String(), cookie.Value) {
		t.Fatal("secrets in logs")
	}
}
func TestSecureCookiesAndLoginLimits(t *testing.T) {
	m := &memoryStore{sessions: map[string]Session{}}
	s, p, _ := newFixture(t, m, true)
	cookie := callAuth(t, s.Login, "POST", credentials("fixture.admin", p), nil, 200).Result().Cookies()[0]
	if !cookie.Secure || !cookie.HttpOnly || cookie.Name != "__Host-portfolio_admin_session" || cookie.Domain != "" || cookie.Path != "/" {
		t.Fatal("invalid production cookie")
	}
	for i := 0; i < 4; i++ {
		callAuth(t, s.Login, "POST", credentials("fixture.admin", "wrong"), nil, 401)
	}
	w := callAuth(t, s.Login, "POST", credentials("fixture.admin", p), nil, 429)
	if w.Header().Get("Retry-After") == "" {
		t.Fatal("missing retry-after")
	}
	now := time.Now()
	limiter := newLimiter()
	for i := 0; i < 30; i++ {
		ok, _ := limiter.allow(randomText(t), now)
		if !ok {
			t.Fatal("global limit too early")
		}
	}
	if ok, _ := limiter.allow("new-source", now); ok {
		t.Fatal("global limit bypassed")
	}
	if ok, _ := limiter.allow("new-source", now.Add(time.Minute)); !ok {
		t.Fatal("rate limit never resets")
	}
}
func TestInvalidLoginAndSetup(t *testing.T) {
	m := &memoryStore{sessions: map[string]Session{}}
	s, _, _ := newFixture(t, m, false)
	for _, body := range []string{"null", "{}", `{"username":"fixture.admin","password":""}`, `{"username":"fixture.admin","password":"x","extra":true}`, strings.Repeat("x", 4097)} {
		s.limiter = newLimiter()
		callAuth(t, s.Login, "POST", body, nil, 400)
	}
	for _, p := range []string{"short", strings.Repeat("x", 73), "            ", "password\nwithcontrol"} {
		if InitializeAdmin(context.Background(), &memoryStore{}, "valid.admin", p) == nil {
			t.Fatal("invalid setup password accepted")
		}
	}
	if InitializeAdmin(context.Background(), &memoryStore{}, "invalid username", randomText(t)) == nil {
		t.Fatal("invalid username accepted")
	}
}
func TestBrowserWriteProtection(t *testing.T) {
	h := BrowserWrites(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) }), []string{"https://portfolio.example"})
	for _, c := range []struct {
		origin, marker, site string
		status               int
	}{{"", "", "", 403}, {"https://evil.example", "1", "", 403}, {"https://portfolio.example", "", "same-origin", 403}, {"https://portfolio.example", "1", "cross-site", 403}, {"https://portfolio.example", "1", "same-site", 200}} {
		r := httptest.NewRequest("POST", "/api/auth/login", nil)
		r.Header.Set("Origin", c.origin)
		r.Header.Set("X-Admin-Request", c.marker)
		r.Header.Set("Sec-Fetch-Site", c.site)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != c.status {
			t.Fatal("unsafe browser request accepted")
		}
	}
	w := httptest.NewRecorder()
	SecurityHeaders(h, true).ServeHTTP(w, httptest.NewRequest("GET", "/", nil))
	for _, key := range []string{"Cache-Control", "X-Content-Type-Options", "X-Frame-Options", "Content-Security-Policy", "Strict-Transport-Security"} {
		if w.Header().Get(key) == "" {
			t.Fatalf("missing %s", key)
		}
	}
}
func TestMongoAuthentication(t *testing.T) {
	uri := os.Getenv("MONGODB_TEST_URI")
	if uri == "" {
		t.Skip("set MONGODB_TEST_URI for real session persistence tests")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	client, err := repository.Connect(ctx, uri)
	if err != nil {
		t.Fatal(err)
	}
	defer client.Disconnect(context.Background())
	db := client.Database("portfolio_test_" + bson.NewObjectID().Hex())
	defer db.Drop(context.Background())
	store, err := NewMongoStore(ctx, db)
	if err != nil {
		t.Fatal(err)
	}
	s, password, _ := newFixture(t, store, false)
	if err := InitializeAdmin(ctx, store, "second.admin", randomText(t)); !errors.Is(err, ErrAdminExists) {
		t.Fatal("duplicate first admin accepted")
	}
	a, err := store.FindAdmin(ctx, "fixture.admin")
	if err != nil || bcrypt.CompareHashAndPassword(a.PasswordHash, []byte(password)) != nil {
		t.Fatal("stored hash invalid")
	}
	cookie := callAuth(t, s.Login, "POST", credentials("fixture.admin", password), nil, 200).Result().Cookies()[0]
	// A second store instance reads the actual persisted session, without process-memory state.
	other, err := NewMongoStore(ctx, db)
	if err != nil {
		t.Fatal(err)
	}
	s.store = other
	callAuth(t, s.Require(s.Me), "GET", "", cookie, 200)
	hash, _ := s.parse(cookie.Value)
	record, err := other.FindSession(ctx, hash)
	if err != nil || record.AdminID != a.ID || hash == cookie.Value {
		t.Fatal("session not persisted safely")
	}
	callAuth(t, s.Logout, "POST", "", cookie, 200)
	callAuth(t, s.Require(s.Me), "GET", "", cookie, 401)
	indexes, err := db.Collection("admin_sessions").Indexes().List(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer indexes.Close(ctx)
	found := false
	for indexes.Next(ctx) {
		var doc bson.M
		_ = indexes.Decode(&doc)
		if _, ok := doc["expireAfterSeconds"]; ok {
			found = true
		}
	}
	if !found {
		t.Fatal("missing session TTL index")
	}
}
