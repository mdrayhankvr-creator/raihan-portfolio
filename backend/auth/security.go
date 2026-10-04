package auth

import (
	"net/http"
	"raihan-portfolio/backend/handlers"
)

// A non-secret custom header forces CORS preflight. Exact origin checks and
// SameSite cookies protect unsafe requests; no bearer/CSRF secret enters JS.
func BrowserWrites(next http.Handler, origins []string) http.Handler {
	allowed := map[string]bool{}
	for _, origin := range origins {
		allowed[origin] = true
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" && r.Method != "HEAD" && r.Method != "OPTIONS" {
			if !allowed[r.Header.Get("Origin")] || r.Header.Get("X-Admin-Request") != "1" || r.Header.Get("Sec-Fetch-Site") == "cross-site" {
				handlers.Error(w, 403, "Request origin or browser request marker is not allowed")
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}
func SecurityHeaders(next http.Handler, production bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
		w.Header().Set("Cache-Control", "no-store")
		if production {
			w.Header().Set("Strict-Transport-Security", "max-age=31536000")
		}
		next.ServeHTTP(w, r)
	})
}
