package config

import (
	"encoding/base64"
	"errors"
	"net"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	MongoURI     string
	Database     string
	Address      string
	Origins      []string
	SessionKey   []byte
	SessionTTL   time.Duration
	CookieSecure bool
	Production   bool
}

func Load() (Config, error) {
	// Existing process environment wins over local configuration.
	if err := godotenv.Load(".env"); err != nil && !os.IsNotExist(err) {
		return Config{}, errors.New("cannot load backend .env; check its format and permissions")
	}
	return FromEnvironment(os.Getenv)
}

func FromEnvironment(getenv func(string) string) (Config, error) {
	cfg, err := DatabaseFromEnvironment(getenv)
	if err != nil {
		return Config{}, err
	}
	environment := valueOr(getenv("APP_ENV"), "development")
	if environment != "development" && environment != "production" {
		return Config{}, errors.New("APP_ENV must be development or production")
	}
	cfg.Production = environment == "production"
	secure, err := strconv.ParseBool(valueOr(getenv("COOKIE_SECURE"), strconv.FormatBool(cfg.Production)))
	if err != nil || (cfg.Production && !secure) {
		return Config{}, errors.New("COOKIE_SECURE must be true in production")
	}
	cfg.CookieSecure = secure
	if cfg.Production {
		if strings.TrimSpace(getenv("CORS_ORIGINS")) == "" {
			return Config{}, errors.New("production requires explicitly configured HTTPS CORS_ORIGINS")
		}
		for _, origin := range cfg.Origins {
			if !strings.HasPrefix(origin, "https://") {
				return Config{}, errors.New("production CORS_ORIGINS must use HTTPS")
			}
		}
	}
	key, err := base64.StdEncoding.DecodeString(strings.TrimSpace(getenv("SESSION_SECRET")))
	if err != nil || len(key) < 32 || len(key) > 64 {
		return Config{}, errors.New("SESSION_SECRET must be base64-encoded random bytes (32-64 bytes)")
	}
	cfg.SessionKey = key
	minutes, err := strconv.Atoi(valueOr(getenv("SESSION_TTL_MINUTES"), "30"))
	if err != nil || minutes < 5 || minutes > 60 {
		return Config{}, errors.New("SESSION_TTL_MINUTES must be between 5 and 60")
	}
	cfg.SessionTTL = time.Duration(minutes) * time.Minute
	return cfg, nil
}

// Bootstrap needs database settings, never a running-server session secret.
func LoadDatabase() (Config, error) {
	if err := godotenv.Load(".env"); err != nil && !os.IsNotExist(err) {
		return Config{}, errors.New("cannot load backend .env; check its format and permissions")
	}
	return DatabaseFromEnvironment(os.Getenv)
}

func DatabaseFromEnvironment(getenv func(string) string) (Config, error) {
	uri := strings.TrimSpace(getenv("MONGODB_URI"))
	if uri == "" {
		return Config{}, errors.New("MONGODB_URI is required")
	}
	if !strings.HasPrefix(uri, "mongodb://") && !strings.HasPrefix(uri, "mongodb+srv://") {
		return Config{}, errors.New("MONGODB_URI must use a MongoDB URI scheme")
	}
	database := valueOr(getenv("MONGODB_DATABASE"), "raihan_portfolio")
	if len(database) > 63 || strings.ContainsAny(database, "/\\. \"$\x00") {
		return Config{}, errors.New("MONGODB_DATABASE is invalid")
	}
	port := valueOr(getenv("PORT"), "8080")
	parsedPort, err := strconv.Atoi(port)
	if err != nil || parsedPort < 1 || parsedPort > 65535 {
		return Config{}, errors.New("PORT must be between 1 and 65535")
	}
	host := valueOr(getenv("HOST"), "127.0.0.1")
	if net.ParseIP(host) == nil && host != "localhost" {
		return Config{}, errors.New("HOST must be an IP address or localhost")
	}
	origins := strings.Split(valueOr(getenv("CORS_ORIGINS"), "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"), ",")
	for index, origin := range origins {
		origin = strings.TrimSpace(origin)
		parsed, err := url.Parse(origin)
		if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" || parsed.User != nil || parsed.Path != "" || parsed.RawQuery != "" || parsed.Fragment != "" {
			return Config{}, errors.New("CORS_ORIGINS must contain exact HTTP(S) origins without paths or credentials")
		}
		origins[index] = origin
	}
	return Config{MongoURI: uri, Database: database, Address: net.JoinHostPort(host, port), Origins: origins}, nil
}

func valueOr(value, fallback string) string {
	if value = strings.TrimSpace(value); value != "" {
		return value
	}
	return fallback
}
