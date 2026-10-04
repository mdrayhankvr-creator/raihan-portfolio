package repository

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"go.mongodb.org/mongo-driver/v2/mongo/readpref"
)

var ErrNotFound = errors.New("record not found")

type Repository[T any] interface {
	List(context.Context, bool) ([]T, error)
	Create(context.Context, T) error
	Update(context.Context, string, T) (T, error)
	Delete(context.Context, string) error
}

type MongoRepository[T any] struct{ collection *mongo.Collection }

// Connect verifies the database before any HTTP listener is opened.
func Connect(ctx context.Context, uri string) (*mongo.Client, error) {
	client, err := mongo.Connect(options.Client().ApplyURI(uri).SetServerSelectionTimeout(5 * time.Second).SetConnectTimeout(5 * time.Second))
	if err != nil {
		return nil, errors.New("MongoDB client configuration is invalid")
	}
	if err := client.Ping(ctx, readpref.Primary()); err != nil {
		cleanup, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = client.Disconnect(cleanup)
		return nil, errors.New("MongoDB connection failed; check the backend URI, database access, and network")
	}
	return client, nil
}

func NewMongoRepository[T any](ctx context.Context, database *mongo.Database, name string) (*MongoRepository[T], error) {
	if err := database.CreateCollection(ctx, name); err != nil {
		var commandError mongo.CommandError
		if !errors.As(err, &commandError) || commandError.Code != 48 {
			return nil, err
		}
	}
	collection := database.Collection(name)
	_, err := collection.Indexes().CreateOne(ctx, mongo.IndexModel{Keys: bson.D{{Key: "published", Value: 1}, {Key: "createdAt", Value: 1}}})
	if err != nil {
		return nil, err
	}
	return &MongoRepository[T]{collection: collection}, nil
}

func (r *MongoRepository[T]) List(ctx context.Context, publishedOnly bool) ([]T, error) {
	filter := bson.M{}
	if publishedOnly {
		filter["published"] = true
	}
	cursor, err := r.collection.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "createdAt", Value: 1}, {Key: "_id", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	records := make([]T, 0)
	if err := cursor.All(ctx, &records); err != nil {
		return nil, err
	}
	return records, nil
}

func (r *MongoRepository[T]) Create(ctx context.Context, record T) error {
	_, err := r.collection.InsertOne(ctx, record)
	return err
}

func (r *MongoRepository[T]) Update(ctx context.Context, id string, record T) (T, error) {
	var updated T
	encoded, err := bson.Marshal(record)
	if err != nil {
		return updated, err
	}
	var fields bson.M
	if err := bson.Unmarshal(encoded, &fields); err != nil {
		return updated, err
	}
	// Clients cannot change identity or the creation timestamp.
	delete(fields, "_id")
	delete(fields, "createdAt")
	// Empty optional fields must replace previous values, including team/division.
	update := bson.M{"$set": fields}
	err = r.collection.FindOneAndUpdate(ctx, bson.M{"_id": id}, update, options.FindOneAndUpdate().SetReturnDocument(options.After)).Decode(&updated)
	if errors.Is(err, mongo.ErrNoDocuments) {
		err = ErrNotFound
	}
	return updated, err
}

func (r *MongoRepository[T]) Delete(ctx context.Context, id string) error {
	result, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return ErrNotFound
	}
	return nil
}
