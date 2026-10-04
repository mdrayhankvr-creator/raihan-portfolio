package auth

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"reflect"
	"strings"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type resetMemoryStore struct {
	*memoryStore
	resetFailure error
	resetCalls   int
}

func (m *resetMemoryStore) ReplaceAdminPassword(_ context.Context, previous Admin, hash []byte) error {
	m.resetCalls++
	if m.resetFailure != nil {
		return m.resetFailure
	}
	if previous.ID != m.admin.ID || previous.Username != m.admin.Username || !bytes.Equal(previous.PasswordHash, m.admin.PasswordHash) {
		return ErrAdminChanged
	}
	m.admin.PasswordHash = hash
	for id, session := range m.sessions {
		if session.AdminID == previous.ID {
			delete(m.sessions, id)
		}
	}
	return nil
}

func TestResetAdminPasswordSessionLifecycle(t *testing.T) {
	store := &resetMemoryStore{memoryStore: &memoryStore{sessions: make(map[string]Session)}}
	service, oldPassword, _ := newFixture(t, store, true)
	cookie := callAuth(t, service.Login, "POST", credentials("fixture.admin", oldPassword), nil, http.StatusOK).Result().Cookies()[0]
	previous := store.admin
	store.sessions["other-account"] = Session{Hash: "other-account", AdminID: "another-admin", ExpiresAt: time.Now().Add(time.Hour)}
	newPassword := []byte(randomText(t))
	if err := ResetAdminPassword(context.Background(), store, "  FIXTURE.ADMIN  ", newPassword); err != nil {
		t.Fatal(err)
	}
	if err := bcrypt.CompareHashAndPassword(store.admin.PasswordHash, newPassword); err != nil {
		t.Fatal("new password not stored correctly")
	}
	if cost, err := bcrypt.Cost(store.admin.PasswordHash); err != nil || cost != 12 {
		t.Fatal("reset changed bcrypt cost")
	}
	updated := store.admin
	updated.PasswordHash = previous.PasswordHash
	if !reflect.DeepEqual(updated, previous) {
		t.Fatal("reset changed account fields other than passwordHash")
	}
	if len(store.sessions) != 1 || store.sessions["other-account"].AdminID != "another-admin" {
		t.Fatal("reset did not revoke only the target admin's sessions")
	}
	callAuth(t, service.Require(service.Me), "GET", "", cookie, http.StatusUnauthorized)
	callAuth(t, service.Login, "POST", credentials("fixture.admin", oldPassword), nil, http.StatusUnauthorized)
	callAuth(t, service.Login, "POST", credentials("fixture.admin", string(newPassword)), nil, http.StatusOK)
}

func TestResetPreservesDisabledStatusAndRole(t *testing.T) {
	for _, disabled := range []bool{false, true} {
		store := &resetMemoryStore{memoryStore: &memoryStore{admin: Admin{ID: "preserved-id", Username: "fixture.admin", Role: "existing-role", Disabled: disabled, CreatedAt: time.Now()}, sessions: make(map[string]Session)}}
		if err := ResetAdminPassword(context.Background(), store, "fixture.admin", []byte(randomText(t))); err != nil {
			t.Fatal(err)
		}
		if store.admin.Disabled != disabled || store.admin.Role != "existing-role" || store.admin.ID != "preserved-id" {
			t.Fatal("reset changed identity, role, or disabled status")
		}
	}
}

func TestResetAdminPasswordFailures(t *testing.T) {
	databaseFailure := errors.New("database failure")
	cases := []struct {
		name, username string
		password       []byte
		lookupFailure  error
		resetFailure   error
		want           error
		wantCalls      int
	}{
		{name: "missing admin", username: "missing.admin", password: []byte(randomText(t)), want: ErrNotFound},
		{name: "lookup failure", username: "fixture.admin", password: []byte(randomText(t)), lookupFailure: databaseFailure, want: databaseFailure},
		{name: "transaction failure", username: "fixture.admin", password: []byte(randomText(t)), resetFailure: databaseFailure, want: databaseFailure, wantCalls: 1},
		{name: "concurrent reset", username: "fixture.admin", password: []byte(randomText(t)), resetFailure: ErrAdminChanged, want: ErrAdminChanged, wantCalls: 1},
		{name: "invalid username", username: "bad user", password: []byte(randomText(t))},
		{name: "short password", username: "fixture.admin", password: []byte("short")},
		{name: "too many bytes", username: "fixture.admin", password: []byte(strings.Repeat("a", 73))},
		{name: "too few Unicode characters", username: "fixture.admin", password: []byte(strings.Repeat("界", 11))},
		{name: "Unicode byte limit", username: "fixture.admin", password: []byte(strings.Repeat("界", 25))},
		{name: "control characters", username: "fixture.admin", password: []byte("password-with\ncontrol")},
		{name: "whitespace only", username: "fixture.admin", password: []byte(strings.Repeat(" ", 12))},
		{name: "invalid UTF8", username: "fixture.admin", password: append([]byte(strings.Repeat("a", 12)), 0xff)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			store := &resetMemoryStore{memoryStore: &memoryStore{admin: Admin{ID: "primary-admin", Username: "fixture.admin", PasswordHash: []byte("previous-hash"), Role: "admin"}, sessions: map[string]Session{"existing": {Hash: "existing", AdminID: "primary-admin"}}, failure: tc.lookupFailure}, resetFailure: tc.resetFailure}
			err := ResetAdminPassword(context.Background(), store, tc.username, tc.password)
			if err == nil || (tc.want != nil && !errors.Is(err, tc.want)) {
				t.Fatal("expected reset failure was not returned")
			}
			if string(store.admin.PasswordHash) != "previous-hash" || len(store.sessions) != 1 || store.resetCalls != tc.wantCalls {
				t.Fatal("failed reset changed the account or sessions")
			}
		})
	}
}
