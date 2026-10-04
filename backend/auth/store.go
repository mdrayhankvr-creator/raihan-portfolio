package auth

import (
	"context"
	"errors"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"time"
)

var ErrNotFound = errors.New("authentication record not found")
var ErrAdminExists = errors.New("an admin already exists; setup never overwrites an account")

type Admin struct {
	ID           string    `bson:"_id" json:"-"`
	Username     string    `bson:"username" json:"-"`
	PasswordHash []byte    `bson:"passwordHash" json:"-"`
	Role         string    `bson:"role" json:"-"`
	Disabled     bool      `bson:"disabled" json:"-"`
	CreatedAt    time.Time `bson:"createdAt" json:"-"`
}
type Session struct {
	Hash      string    `bson:"_id" json:"-"`
	AdminID   string    `bson:"adminId" json:"-"`
	ExpiresAt time.Time `bson:"expiresAt" json:"-"`
}
type Store interface {
	FindAdmin(context.Context, string) (Admin, error)
	FindAdminByID(context.Context, string) (Admin, error)
	CreateAdmin(context.Context, Admin) error
	CreateSession(context.Context, Session) error
	FindSession(context.Context, string) (Session, error)
	DeleteSession(context.Context, string) error
}
type MongoStore struct{ admins, sessions *mongo.Collection }

func NewMongoStore(ctx context.Context, db *mongo.Database) (*MongoStore, error) {
	s := &MongoStore{admins: db.Collection("admins"), sessions: db.Collection("admin_sessions")}
	if _, err := s.admins.Indexes().CreateOne(ctx, mongo.IndexModel{Keys: bson.D{{Key: "username", Value: 1}}, Options: options.Index().SetUnique(true)}); err != nil {
		return nil, err
	}
	if _, err := s.sessions.Indexes().CreateOne(ctx, mongo.IndexModel{Keys: bson.D{{Key: "expiresAt", Value: 1}}, Options: options.Index().SetExpireAfterSeconds(0)}); err != nil {
		return nil, err
	}
	return s, nil
}
func (s *MongoStore) FindAdmin(ctx context.Context, username string) (Admin, error) {
	var admin Admin
	err := s.admins.FindOne(ctx, bson.M{"username": username}).Decode(&admin)
	return admin, notFound(err)
}
func (s *MongoStore) FindAdminByID(ctx context.Context, id string) (Admin, error) {
	var admin Admin
	err := s.admins.FindOne(ctx, bson.M{"_id": id}).Decode(&admin)
	return admin, notFound(err)
}
func (s *MongoStore) CreateAdmin(ctx context.Context, admin Admin) error {
	// A fixed identity enforces a single first admin even under concurrent setup.
	admin.ID = "primary-admin"
	_, err := s.admins.InsertOne(ctx, admin)
	if mongo.IsDuplicateKeyError(err) {
		return ErrAdminExists
	}
	return err
}
func (s *MongoStore) CreateSession(ctx context.Context, session Session) error {
	_, err := s.sessions.InsertOne(ctx, session)
	return err
}
func (s *MongoStore) FindSession(ctx context.Context, hash string) (Session, error) {
	var session Session
	err := s.sessions.FindOne(ctx, bson.M{"_id": hash}).Decode(&session)
	return session, notFound(err)
}
func (s *MongoStore) DeleteSession(ctx context.Context, hash string) error {
	_, err := s.sessions.DeleteOne(ctx, bson.M{"_id": hash})
	return err
}
func notFound(err error) error {
	if errors.Is(err, mongo.ErrNoDocuments) {
		return ErrNotFound
	}
	return err
}
