package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"log/slog"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"raihan-portfolio/backend/repository"
)

func TestMissingConfigurationFails(t *testing.T) {
	t.Setenv("MONGODB_URI", "")
	var logs bytes.Buffer
	if err := run(context.Background(), slog.New(slog.NewTextHandler(&logs, nil))); err == nil {
		t.Fatal("server started without database configuration")
	}
}

func TestGracefulShutdownWithMongo(t *testing.T) {
	uri := os.Getenv("MONGODB_TEST_URI")
	if uri == "" {
		t.Skip("set MONGODB_TEST_URI to test HTTP shutdown with real MongoDB")
	}
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := listener.Addr().(*net.TCPAddr).Port
	listener.Close()
	name := "portfolio_test_" + bson.NewObjectID().Hex()
	t.Setenv("MONGODB_URI", uri)
	key := make([]byte, 32)
	_, _ = rand.Read(key)
	t.Setenv("SESSION_SECRET", base64.StdEncoding.EncodeToString(key))
	t.Setenv("MONGODB_DATABASE", name)
	t.Setenv("HOST", "127.0.0.1")
	t.Setenv("PORT", strconv.Itoa(port))
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	var logs bytes.Buffer
	finished := make(chan error, 1)
	go func() { finished <- run(ctx, slog.New(slog.NewTextHandler(&logs, nil))) }()
	client := &http.Client{Timeout: time.Second}
	ready := false
	for i := 0; i < 60; i++ {
		response, err := client.Get("http://127.0.0.1:" + strconv.Itoa(port) + "/api/health")
		if err == nil {
			response.Body.Close()
			if response.StatusCode == 200 {
				ready = true
				break
			}
		}
		time.Sleep(100 * time.Millisecond)
	}
	if !ready {
		cancel()
		<-finished
		t.Fatal("API never became ready")
	}
	cancel()
	select {
	case err := <-finished:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(12 * time.Second):
		t.Fatal("shutdown did not complete")
	}
	if !strings.Contains(logs.String(), "Portfolio API stopped") || strings.Contains(logs.String(), "disconnect failed") {
		t.Fatalf("shutdown logs: %s", logs.String())
	}
	cleanup, stop := context.WithTimeout(context.Background(), 5*time.Second)
	defer stop()
	mongo, err := repository.Connect(cleanup, uri)
	if err != nil {
		t.Fatal(err)
	}
	defer mongo.Disconnect(context.Background())
	if err := mongo.Database(name).Drop(cleanup); err != nil {
		t.Fatal(err)
	}
}
