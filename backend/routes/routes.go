package routes

import (
	"context"
	"log/slog"
	"net/http"
	"raihan-portfolio/backend/auth"
	"strings"

	"raihan-portfolio/backend/handlers"
	"raihan-portfolio/backend/models"
	"raihan-portfolio/backend/repository"
)

func New(projects repository.Repository[models.Project], achievements repository.Repository[models.Achievement], ping func(context.Context) error, origins []string, logger *slog.Logger, sessions *auth.Service, production bool) http.Handler {
	mux := http.NewServeMux()
	p := handlers.Resource[models.Project, models.ProjectInput]{Store: projects, Validate: models.NewProject, Logger: logger}
	a := handlers.Resource[models.Achievement, models.AchievementInput]{Store: achievements, Validate: models.NewAchievement, Logger: logger}
	mux.HandleFunc("GET /api/health", handlers.Health(ping, logger))
	unsafe := func(handler http.HandlerFunc) http.HandlerFunc { return auth.BrowserWrites(handler, origins).ServeHTTP }
	protect := func(handler http.HandlerFunc) http.HandlerFunc { return sessions.Require(unsafe(handler)) }
	read := func(handler http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			scope := r.URL.Query().Get("scope")
			if scope == "admin" {
				sessions.Require(handler)(w, r)
				return
			}
			if scope != "" {
				handlers.Error(w, 400, "Invalid content scope")
				return
			}
			published := r.URL.Query().Get("published")
			if published != "" && published != "true" {
				handlers.Error(w, 400, "Public reads contain published content only")
				return
			}
			// Never expose unpublished records through anonymous/default GET requests.
			copy := r.Clone(r.Context())
			query := copy.URL.Query()
			query.Set("published", "true")
			copy.URL.RawQuery = query.Encode()
			handler(w, copy)
		}
	}
	mux.HandleFunc("POST /api/auth/login", unsafe(sessions.Login))
	mux.HandleFunc("POST /api/auth/logout", unsafe(sessions.Logout))
	mux.HandleFunc("GET /api/auth/me", sessions.Require(sessions.Me))
	mux.HandleFunc("GET /api/projects", read(p.List))
	mux.HandleFunc("POST /api/projects", protect(p.Create))
	mux.HandleFunc("PUT /api/projects/{id}", protect(p.Update))
	mux.HandleFunc("DELETE /api/projects/{id}", protect(p.Delete))
	mux.HandleFunc("GET /api/achievements", read(a.List))
	mux.HandleFunc("POST /api/achievements", protect(a.Create))
	mux.HandleFunc("PUT /api/achievements/{id}", protect(a.Update))
	mux.HandleFunc("DELETE /api/achievements/{id}", protect(a.Delete))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if path == "/api/health" || path == "/api/projects" || path == "/api/achievements" || path == "/api/auth/login" || path == "/api/auth/logout" || path == "/api/auth/me" || (strings.Count(path, "/") == 3 && (strings.HasPrefix(path, "/api/projects/") || strings.HasPrefix(path, "/api/achievements/"))) {
			allow := "PUT, DELETE"
			if path == "/api/health" {
				allow = "GET"
			}
			if path == "/api/projects" || path == "/api/achievements" {
				allow = "GET, POST"
			}
			if path == "/api/auth/me" {
				allow = "GET"
			}
			if path == "/api/auth/login" || path == "/api/auth/logout" {
				allow = "POST"
			}
			w.Header().Set("Allow", allow)
			handlers.Error(w, 405, "Method not allowed")
			return
		}
		handlers.Error(w, 404, "Endpoint not found")
	})
	return auth.SecurityHeaders(CORS(mux, origins), production)
}

func CORS(next http.Handler, origins []string) http.Handler {
	allowed := make(map[string]bool, len(origins))
	for _, origin := range origins {
		allowed[origin] = true
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Vary", "Origin")
		origin := r.Header.Get("Origin")
		if origin != "" {
			if !allowed[origin] {
				handlers.Error(w, 403, "Origin is not allowed")
				return
			}
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Admin-Request")
		}
		if r.Method == "OPTIONS" {
			handlers.JSON(w, 200, map[string]string{"status": "ok"})
			return
		}
		next.ServeHTTP(w, r)
	})
}
