package routes

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"golang.org/x/crypto/bcrypt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"raihan-portfolio/backend/auth"
	"strings"
	"testing"
	"time"

	"raihan-portfolio/backend/models"
	"raihan-portfolio/backend/repository"
)

// Auth storage fixture: only used in tests; signing, cookie checks and login remain real.
type authTestStore struct {
	admin    auth.Admin
	sessions map[string]auth.Session
}

func (s *authTestStore) FindAdmin(_ context.Context, name string) (auth.Admin, error) {
	if name != s.admin.Username {
		return auth.Admin{}, auth.ErrNotFound
	}
	return s.admin, nil
}
func (s *authTestStore) FindAdminByID(_ context.Context, id string) (auth.Admin, error) {
	if id != s.admin.ID {
		return auth.Admin{}, auth.ErrNotFound
	}
	return s.admin, nil
}
func (s *authTestStore) CreateAdmin(_ context.Context, a auth.Admin) error { s.admin = a; return nil }
func (s *authTestStore) CreateSession(_ context.Context, a auth.Session) error {
	s.sessions[a.Hash] = a
	return nil
}
func (s *authTestStore) FindSession(_ context.Context, id string) (auth.Session, error) {
	a, ok := s.sessions[id]
	if !ok {
		return a, auth.ErrNotFound
	}
	return a, nil
}
func (s *authTestStore) DeleteSession(_ context.Context, id string) error {
	delete(s.sessions, id)
	return nil
}

// This test double is used only by handler tests, never by the running API.
type testStore[T any] struct {
	records map[string]T
	failure error
}

func (s *testStore[T]) List(_ context.Context, publishedOnly bool) ([]T, error) {
	if s.failure != nil {
		return nil, s.failure
	}
	records := []T{}
	for _, record := range s.records {
		encoded, _ := json.Marshal(record)
		var fields struct{ Published bool }
		_ = json.Unmarshal(encoded, &fields)
		if !publishedOnly || fields.Published {
			records = append(records, record)
		}
	}
	return records, nil
}
func (s *testStore[T]) Create(_ context.Context, record T) error {
	if s.failure != nil {
		return s.failure
	}
	encoded, _ := json.Marshal(record)
	var fields struct{ ID string }
	_ = json.Unmarshal(encoded, &fields)
	s.records[fields.ID] = record
	return nil
}
func (s *testStore[T]) Update(_ context.Context, id string, record T) (T, error) {
	if s.failure != nil {
		return record, s.failure
	}
	if _, exists := s.records[id]; !exists {
		return record, repository.ErrNotFound
	}
	s.records[id] = record
	return record, nil
}
func (s *testStore[T]) Delete(_ context.Context, id string) error {
	if s.failure != nil {
		return s.failure
	}
	if _, exists := s.records[id]; !exists {
		return repository.ErrNotFound
	}
	delete(s.records, id)
	return nil
}

func TestAPIHandlers(t *testing.T) {
	p := &testStore[models.Project]{records: map[string]models.Project{}}
	a := &testStore[models.Achievement]{records: map[string]models.Achievement{}}
	var logs bytes.Buffer
	logger := slog.New(slog.NewTextHandler(&logs, nil))
	key := make([]byte, 32)
	_, _ = rand.Read(key)
	password := make([]byte, 24)
	_, _ = rand.Read(password)
	hash, _ := bcrypt.GenerateFromPassword(password, bcrypt.MinCost)
	store := &authTestStore{admin: auth.Admin{ID: "fixture", Username: "fixture", PasswordHash: hash, Role: "admin"}, sessions: map[string]auth.Session{}}
	sessions, err := auth.New(store, auth.Options{Key: key, TTL: 30 * time.Minute}, logger)
	if err != nil {
		t.Fatal(err)
	}
	api := New(p, a, func(context.Context) error { return p.failure }, []string{"http://localhost:5173"}, logger, sessions, false)
	// Use a valid UTF-8 random password and the real login handler for the fixture cookie.
	passwordText := fmt.Sprintf("%x", password)
	store.admin.PasswordHash, _ = bcrypt.GenerateFromPassword([]byte(passwordText), bcrypt.MinCost)
	loginBody, _ := json.Marshal(map[string]string{"username": "fixture", "password": passwordText})
	r := httptest.NewRequest("POST", "/api/auth/login", bytes.NewReader(loginBody))
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("Origin", "http://localhost:5173")
	r.Header.Set("X-Admin-Request", "1")
	w := httptest.NewRecorder()
	api.ServeHTTP(w, r)
	if w.Code != 200 || len(w.Result().Cookies()) != 1 {
		t.Fatal("fixture login failed")
	}
	cookie := w.Result().Cookies()[0]
	for _, resource := range []string{"projects", "achievements"} {
		for _, operation := range []struct{ method, path string }{{"POST", "/api/" + resource}, {"PUT", "/api/" + resource + "/aaaaaaaaaaaaaaaaaaaaaaaa"}, {"DELETE", "/api/" + resource + "/aaaaaaaaaaaaaaaaaaaaaaaa"}, {"GET", "/api/" + resource + "?scope=admin"}} {
			request := httptest.NewRequest(operation.method, operation.path, nil)
			response := httptest.NewRecorder()
			api.ServeHTTP(response, request)
			if response.Code != 401 {
				t.Fatalf("anonymous %s %s was not rejected", operation.method, operation.path)
			}
		}
	}
	unsafe := httptest.NewRequest("POST", "/api/projects", nil)
	unsafe.AddCookie(cookie)
	unsafeResponse := httptest.NewRecorder()
	api.ServeHTTP(unsafeResponse, unsafe)
	if unsafeResponse.Code != 403 {
		t.Fatal("authenticated write accepted without origin/request marker")
	}
	call := func(method, path, body string, status int) *httptest.ResponseRecorder {
		t.Helper()
		request := httptest.NewRequest(method, path, strings.NewReader(body))
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Origin", "http://localhost:5173")
		request.Header.Set("X-Admin-Request", "1")
		request.AddCookie(cookie)
		response := httptest.NewRecorder()
		api.ServeHTTP(response, request)
		if response.Code != status || !strings.HasPrefix(response.Header().Get("Content-Type"), "application/json") || !json.Valid(response.Body.Bytes()) {
			t.Fatalf("%s %s: status=%d body=%s", method, path, response.Code, response.Body)
		}
		return response
	}
	call("GET", "/api/health", "", 200)
	if call("GET", "/api/projects", "", 200).Body.String() != "[]\n" {
		t.Fatal("empty arrays must serialize as []")
	}
	projectBody := `{"title":"Service","status":"In Progress","description":"Test","technologies":["Go"],"published":false}`
	achievementBody := `{"title":"Event","event":"Event","year":2026,"result":"Finalist","description":"","published":true}`
	for _, test := range []struct{ resource, body string }{{"projects", projectBody}, {"achievements", achievementBody}} {
		created := call("POST", "/api/"+test.resource, test.body, 201)
		var record struct {
			ID        string
			CreatedAt string
			UpdatedAt string
		}
		_ = json.Unmarshal(created.Body.Bytes(), &record)
		if len(record.ID) != 24 || record.CreatedAt == "" || record.UpdatedAt == "" {
			t.Fatal("missing generated metadata")
		}
		call("GET", "/api/"+test.resource, "", 200)
		call("PUT", "/api/"+test.resource+"/"+record.ID, test.body, 200)
		call("DELETE", "/api/"+test.resource+"/"+record.ID, "", 200)
		call("DELETE", "/api/"+test.resource+"/"+record.ID, "", 404)
		call("PUT", "/api/"+test.resource+"/"+record.ID, test.body, 404)
		call("DELETE", "/api/"+test.resource+"/bad-id", "", 400)
	}
	call("POST", "/api/projects", projectBody, 201)
	if call("GET", "/api/projects?published=true", "", 200).Body.String() != "[]\n" {
		t.Fatal("unpublished record exposed in public query")
	}
	call("GET", "/api/projects?published=wrong", "", 400)
	for _, body := range []string{"null", "[]", "{", "{}", projectBody + "{}", strings.Replace(projectBody, `"published":false`, `"published":"yes"`, 1), strings.Replace(projectBody, `"published":false`, `"published":false,"id":"injected"`, 1), `{"title":"` + strings.Repeat("x", 65536) + `"}`} {
		call("POST", "/api/projects", body, 400)
	}
	call("PATCH", "/api/projects", "", 405)
	call("GET", "/api/projects/aaaaaaaaaaaaaaaaaaaaaaaa", "", 405)
	call("GET", "/api/missing", "", 404)
	request := httptest.NewRequest("POST", "/api/projects", strings.NewReader(projectBody))
	request.Header.Set("Origin", "http://localhost:5173")
	request.Header.Set("X-Admin-Request", "1")
	request.AddCookie(cookie)
	response := httptest.NewRecorder()
	api.ServeHTTP(response, request)
	if response.Code != 400 {
		t.Fatal("missing content type accepted")
	}
	p.failure = errors.New("sensitive-password mongodb://secret@host")
	for _, test := range []struct{ method, path, body string }{{"GET", "/api/projects", ""}, {"POST", "/api/projects", projectBody}, {"PUT", "/api/projects/aaaaaaaaaaaaaaaaaaaaaaaa", projectBody}, {"DELETE", "/api/projects/aaaaaaaaaaaaaaaaaaaaaaaa", ""}, {"GET", "/api/health", ""}} {
		response := call(test.method, test.path, test.body, 500)
		if strings.Contains(response.Body.String(), "secret") {
			t.Fatal("database details leaked")
		}
	}
	if strings.Contains(logs.String(), "secret") || strings.Contains(logs.String(), "password") {
		t.Fatal("database error leaked into logs")
	}
}

func TestCORS(t *testing.T) {
	api := CORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) }), []string{"http://localhost:5173"})
	for _, test := range []struct {
		origin, method string
		status         int
	}{{"http://localhost:5173", "OPTIONS", 200}, {"http://localhost:5173", "GET", 200}, {"https://untrusted.example", "OPTIONS", 403}, {"https://untrusted.example", "POST", 403}, {"", "GET", 200}} {
		r := httptest.NewRequest(test.method, "/api/projects", nil)
		r.Header.Set("Origin", test.origin)
		w := httptest.NewRecorder()
		api.ServeHTTP(w, r)
		if w.Code != test.status {
			t.Fatalf("origin %q: %d", test.origin, w.Code)
		}
		if test.origin == "http://localhost:5173" && w.Header().Get("Access-Control-Allow-Origin") != test.origin {
			t.Fatal("missing exact origin")
		}
		if test.origin == "http://localhost:5173" && w.Header().Get("Access-Control-Allow-Credentials") != "true" {
			t.Fatal("credentialed CORS missing")
		}
	}
}
