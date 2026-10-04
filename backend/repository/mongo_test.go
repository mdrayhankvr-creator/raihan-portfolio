package repository

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"raihan-portfolio/backend/models"
)

func TestMongoConnectionFailures(t *testing.T) {
	for _, uri := range []string{"invalid", "mongodb://127.0.0.1:1/?directConnection=true"} {
		ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
		client, err := Connect(ctx, uri)
		cancel()
		if err == nil || client != nil {
			t.Fatal("connection failure was not propagated")
		}
	}
}

func TestMongoPersistence(t *testing.T) {
	uri := os.Getenv("MONGODB_TEST_URI")
	if uri == "" {
		t.Skip("set MONGODB_TEST_URI to run against real MongoDB; no test double is used here")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	client, err := Connect(ctx, uri)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = client.Disconnect(context.Background()) }()
	name := "portfolio_test_" + bson.NewObjectID().Hex()
	database := client.Database(name)
	defer func() {
		cleanup, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := database.Drop(cleanup); err != nil {
			t.Error(err)
		}
	}()
	p, err := NewMongoRepository[models.Project](ctx, database, "projects")
	if err != nil {
		t.Fatal(err)
	}
	a, err := NewMongoRepository[models.Achievement](ctx, database, "achievements")
	if err != nil {
		t.Fatal(err)
	}
	// Preparation can run repeatedly without overwriting any content.
	if _, err := NewMongoRepository[models.Project](ctx, database, "projects"); err != nil {
		t.Fatal(err)
	}
	if items, err := p.List(ctx, false); err != nil || len(items) != 0 {
		t.Fatalf("new collection: %v, %v", items, err)
	}
	now := time.Now().UTC().Truncate(time.Millisecond)
	published := true
	project, _ := models.NewProject(models.ProjectInput{ProjectFields: models.ProjectFields{Title: "Test service", Description: "Integration fixture", Status: "In Progress", TechnologyLabel: "Proposed stack", Technologies: []string{"Go"}}, Published: &published}, bson.NewObjectID().Hex(), now)
	achievement, _ := models.NewAchievement(models.AchievementInput{AchievementFields: models.AchievementFields{Title: "Test event", Event: "Test event", Year: 2026, Result: "Finalist", Team: "Test team", Division: "Test division"}, Published: &published}, bson.NewObjectID().Hex(), now)
	if err := p.Create(ctx, project); err != nil {
		t.Fatal(err)
	}
	if err := a.Create(ctx, achievement); err != nil {
		t.Fatal(err)
	}
	if items, err := p.List(ctx, true); err != nil || len(items) != 1 {
		t.Fatalf("published query: %v, %v", items, err)
	}
	project.Title, project.Published, project.UpdatedAt, project.CreatedAt = "Updated", false, now.Add(time.Second), time.Time{}
	updated, err := p.Update(ctx, project.ID, project)
	if err != nil || !updated.CreatedAt.Equal(now) || !updated.UpdatedAt.Equal(now.Add(time.Second)) || updated.Published {
		t.Fatalf("update metadata: %+v, %v", updated, err)
	}
	if items, err := p.List(ctx, true); err != nil || len(items) != 0 {
		t.Fatalf("unpublish: %v, %v", items, err)
	}
	achievement.Team, achievement.Division = "", ""
	if updated, err := a.Update(ctx, achievement.ID, achievement); err != nil || updated.Team != "" || updated.Division != "" {
		t.Fatalf("clear optional fields: %+v, %v", updated, err)
	}
	// A second independent connection must read the committed update.
	reader, err := Connect(ctx, uri)
	if err != nil {
		t.Fatal(err)
	}
	defer reader.Disconnect(context.Background())
	var stored models.Project
	if err := reader.Database(name).Collection("projects").FindOne(ctx, bson.M{"_id": project.ID}).Decode(&stored); err != nil || stored.Title != "Updated" || stored.Published {
		t.Fatalf("persistent independent read: %+v, %v", stored, err)
	}
	if err := p.Delete(ctx, project.ID); err != nil {
		t.Fatal(err)
	}
	if err := a.Delete(ctx, achievement.ID); err != nil {
		t.Fatal(err)
	}
	if err := p.Delete(ctx, project.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("missing delete: %v", err)
	}
	if _, err := p.Update(ctx, project.ID, project); !errors.Is(err, ErrNotFound) {
		t.Fatalf("missing update: %v", err)
	}
	if err := reader.Database(name).Collection("projects").FindOne(ctx, bson.M{"_id": project.ID}).Err(); !errors.Is(err, mongo.ErrNoDocuments) {
		t.Fatalf("deleted record survived: %v", err)
	}
}
