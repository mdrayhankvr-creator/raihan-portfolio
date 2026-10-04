package auth

import (
	"context"
	"errors"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"go.mongodb.org/mongo-driver/v2/mongo/readconcern"
	"go.mongodb.org/mongo-driver/v2/mongo/writeconcern"
	"golang.org/x/crypto/bcrypt"
)

var ErrAdminChanged = errors.New("admin changed during reset; retry the command")

// PasswordResetStore is deliberately separate from the HTTP authentication store:
// resetting a password is a local maintenance operation, never an API endpoint.
type PasswordResetStore interface {
	FindAdmin(context.Context, string) (Admin, error)
	ReplaceAdminPassword(context.Context, Admin, []byte) error
}

func ResetAdminPassword(ctx context.Context, store PasswordResetStore, username string, password []byte) error {
	username, err := NormalizeUsername(username)
	if err != nil {
		return err
	}
	if err := ValidatePassword(password); err != nil {
		return err
	}
	admin, err := store.FindAdmin(ctx, username)
	if err != nil {
		return err
	}
	if admin.ID == "" || admin.Username != username {
		return ErrNotFound
	}
	hash, err := bcrypt.GenerateFromPassword(password, PasswordCost)
	if err != nil {
		return errors.New("password hashing failed")
	}
	return store.ReplaceAdminPassword(ctx, admin, hash)
}

// ReplaceAdminPassword changes only the hash and revokes the account's sessions
// atomically. It requires a replica set or sharded cluster (including Atlas).
// There is deliberately no non-transactional fallback or upsert.
func (s *MongoStore) ReplaceAdminPassword(ctx context.Context, admin Admin, hash []byte) error {
	session, err := s.admins.Database().Client().StartSession()
	if err != nil {
		return err
	}
	defer session.EndSession(ctx)
	_, err = session.WithTransaction(ctx, func(tx context.Context) (any, error) {
		// Reject a concurrent password reset instead of overwriting its result.
		filter := bson.M{"_id": admin.ID, "username": admin.Username, "passwordHash": admin.PasswordHash}
		result, err := s.admins.UpdateOne(tx, filter, bson.M{"$set": bson.M{"passwordHash": hash}})
		if err != nil {
			return nil, err
		}
		if result.MatchedCount != 1 {
			return nil, ErrAdminChanged
		}
		_, err = s.sessions.DeleteMany(tx, bson.M{"adminId": admin.ID})
		return nil, err
	}, options.Transaction().SetReadConcern(readconcern.Snapshot()).SetWriteConcern(writeconcern.Majority()))
	return err
}
