package config

import (
	"crypto/rand"
	"encoding/base64"
	"strings"
	"testing"
)

func TestConfiguration(t *testing.T) {
	// Synthetic URI only; never an actual credential.
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		t.Fatal(err)
	}
	values := map[string]string{"MONGODB_URI": "mongodb://user:secret@example.invalid", "SESSION_SECRET": base64.StdEncoding.EncodeToString(key)}
	get := func(key string) string { return values[key] }
	cfg, err := FromEnvironment(get)
	if err != nil || cfg.Database != "raihan_portfolio" || cfg.Address != "127.0.0.1:8080" || len(cfg.Origins) != 4 {
		t.Fatalf("defaults failed: %+v, %v", cfg, err)
	}
	for _, test := range []struct{ key, value string }{{"MONGODB_URI", ""}, {"MONGODB_URI", "secret"}, {"PORT", "65536"}, {"MONGODB_DATABASE", "bad/name"}, {"HOST", "unexpected"}, {"CORS_ORIGINS", "*"}, {"CORS_ORIGINS", "https://example.com/path"}, {"CORS_ORIGINS", "https://user:secret@example.com"}} {
		t.Run(test.key+test.value, func(t *testing.T) {
			original := values[test.key]
			values[test.key] = test.value
			defer func() { values[test.key] = original }()
			_, err := FromEnvironment(get)
			if err == nil || strings.Contains(err.Error(), "secret") {
				t.Fatalf("expected safe configuration error: %v", err)
			}
		})
	}
}

func TestAuthenticationConfiguration(t *testing.T) {
	key := make([]byte, 32)
	_, _ = rand.Read(key)
	values := map[string]string{"MONGODB_URI": "mongodb://example.invalid", "SESSION_SECRET": base64.StdEncoding.EncodeToString(key)}
	get := func(k string) string { return values[k] }
	for _, bad := range []struct{ key, value string }{{"SESSION_SECRET", ""}, {"SESSION_SECRET", "too-short"}, {"SESSION_TTL_MINUTES", "4"}, {"SESSION_TTL_MINUTES", "61"}, {"COOKIE_SECURE", "wrong"}, {"APP_ENV", "staging"}, {"APP_ENV", "production"}} {
		original := values[bad.key]
		values[bad.key] = bad.value
		if _, err := FromEnvironment(get); err == nil {
			t.Fatalf("accepted invalid %s", bad.key)
		}
		values[bad.key] = original
	}
	values["APP_ENV"] = "production"
	values["CORS_ORIGINS"] = "https://portfolio.example"
	cfg, err := FromEnvironment(get)
	if err != nil || !cfg.CookieSecure || !cfg.Production {
		t.Fatal("production must default to secure cookies")
	}
	values["COOKIE_SECURE"] = "false"
	if _, err := FromEnvironment(get); err == nil {
		t.Fatal("production accepted insecure cookies")
	}
}
