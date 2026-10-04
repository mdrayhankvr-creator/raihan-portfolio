package auth

import (
	"bytes"
	"context"
	"errors"
	"os"
	"reflect"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"golang.org/x/crypto/bcrypt"
	"raihan-portfolio/backend/repository"
)

func TestMongoPasswordReset(t *testing.T) {
	uri := os.Getenv("MONGODB_TEST_URI")
	if uri == "" {
		t.Skip("set MONGODB_TEST_URI to a disposable MongoDB replica set to verify reset transactions")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	client, err := repository.Connect(ctx, uri)
	if err != nil {
		t.Fatal("cannot connect to test MongoDB")
	}
	defer client.Disconnect(context.Background())
	database := client.Database("portfolio_reset_test_" + bson.NewObjectID().Hex())
	defer func() {
		cleanup, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := database.Drop(cleanup); err != nil {
			t.Error("cannot clean up test database")
		}
	}()
	store, err := NewMongoStore(ctx, database)
	if err != nil {
		t.Fatal("cannot prepare test store")
	}
	if err := InitializeAdmin(ctx, store, "fixture.admin", randomText(t)); err != nil {
		t.Fatal("cannot initialize test admin")
	}
	if _, err := store.admins.UpdateOne(ctx, bson.M{"username": "fixture.admin"}, bson.M{"$set": bson.M{"disabled": true, "role": "preserved-role", "extraField": "preserved"}}); err != nil {
		t.Fatal("cannot set account preservation fixtures")
	}
	previous, err := store.FindAdmin(ctx, "fixture.admin")
	if err != nil {
		t.Fatal("cannot read test admin")
	}
	for _, session := range []Session{
		{Hash: "first", AdminID: previous.ID, ExpiresAt: time.Now().Add(time.Hour)},
		{Hash: "second", AdminID: previous.ID, ExpiresAt: time.Now().Add(time.Hour)},
		{Hash: "other", AdminID: "other-admin", ExpiresAt: time.Now().Add(time.Hour)},
	} {
		if err := store.CreateSession(ctx, session); err != nil {
			t.Fatal("cannot create fixture session")
		}
	}
	newPassword := []byte(randomText(t))
	if err := ResetAdminPassword(ctx, store, " FIXTURE.ADMIN ", newPassword); err != nil {
		t.Fatal("transactional reset failed")
	}
	// Verify persisted state through a fresh connection, rather than cached values.
	reader, err := repository.Connect(ctx, uri)
	if err != nil {
		t.Fatal("cannot connect test reader")
	}
	defer reader.Disconnect(context.Background())
	var current Admin
	if err := reader.Database(database.Name()).Collection("admins").FindOne(ctx, bson.M{"_id": previous.ID}).Decode(&current); err != nil {
		t.Fatal("cannot read persisted admin")
	}
	if bcrypt.CompareHashAndPassword(current.PasswordHash, newPassword) != nil {
		t.Fatal("new hash was not persisted as BSON binary")
	}
	preserved := current
	preserved.PasswordHash = previous.PasswordHash
	if !reflect.DeepEqual(preserved, previous) {
		t.Fatal("reset changed account fields other than passwordHash")
	}
	var document bson.M
	if err := store.admins.FindOne(ctx, bson.M{"_id": previous.ID}).Decode(&document); err != nil || document["extraField"] != "preserved" {
		t.Fatal("reset replaced the admin document")
	}
	if count, err := store.sessions.CountDocuments(ctx, bson.M{}); err != nil || count != 1 {
		t.Fatal("session revocation affected the wrong records")
	}
	if _, err := store.FindSession(ctx, "other"); err != nil {
		t.Fatal("another account's session was revoked")
	}
	if err := store.ReplaceAdminPassword(ctx, previous, current.PasswordHash); !errors.Is(err, ErrAdminChanged) {
		t.Fatal("stale reset overwrote a newer password")
	}
	if err := store.CreateSession(ctx, Session{Hash: "rollback-session", AdminID: current.ID, ExpiresAt: time.Now().Add(time.Hour)}); err != nil {
		t.Fatal("cannot create rollback fixture")
	}
	// A session-deletion error after UpdateOne must abort the hash update too.
	sessions := store.sessions
	store.sessions = database.Collection("invalid\x00collection")
	hash, err := bcrypt.GenerateFromPassword([]byte(randomText(t)), PasswordCost)
	if err != nil {
		t.Fatal("cannot hash rollback fixture password")
	}
	err = store.ReplaceAdminPassword(ctx, current, hash)
	store.sessions = sessions
	if err == nil {
		t.Fatal("session deletion failure did not abort reset")
	}
	afterFailure, err := store.FindAdmin(ctx, current.Username)
	if err != nil || !bytes.Equal(afterFailure.PasswordHash, current.PasswordHash) {
		t.Fatal("failed session revocation left a changed password")
	}
	if _, err := store.FindSession(ctx, "rollback-session"); err != nil {
		t.Fatal("failed transaction revoked a session")
	}
	if err := ResetAdminPassword(ctx, store, "missing.admin", newPassword); !errors.Is(err, ErrNotFound) {
		t.Fatal("missing admin did not fail reset")
	}
	if count, err := store.admins.CountDocuments(ctx, bson.M{}); err != nil || count != 1 {
		t.Fatal("reset created an account")
	}
}
