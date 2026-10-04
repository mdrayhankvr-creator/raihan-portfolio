package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"raihan-portfolio/backend/auth"
	"raihan-portfolio/backend/config"
	"raihan-portfolio/backend/repository"
	"time"
)

func main() {
	if err := setup(); err != nil {
		fmt.Fprintln(os.Stderr, err.Error())
		os.Exit(1)
	}
	fmt.Println("First admin initialized. No existing account was overwritten. Remove ADMIN_PASSWORD from your environment/configuration.")
}
func setup() error {
	cfg, err := config.LoadDatabase()
	if err != nil {
		return err
	}
	username, password := os.Getenv("ADMIN_USERNAME"), os.Getenv("ADMIN_PASSWORD")
	if username == "" || password == "" {
		return errors.New("set ADMIN_USERNAME and ADMIN_PASSWORD locally before running create-admin")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	client, err := repository.Connect(ctx, cfg.MongoURI)
	if err != nil {
		return err
	}
	defer func() {
		cleanup, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = client.Disconnect(cleanup)
	}()
	store, err := auth.NewMongoStore(ctx, client.Database(cfg.Database))
	if err != nil {
		return errors.New("cannot prepare authentication collections")
	}
	if err := auth.InitializeAdmin(ctx, store, username, password); err != nil {
		if errors.Is(err, auth.ErrAdminExists) {
			return err
		}
		if len(password) < 12 || len(password) > 72 {
			return errors.New("ADMIN_PASSWORD must contain 12 or more characters and at most 72 UTF-8 bytes")
		}
		return errors.New("admin initialization failed; verify username/password requirements and database access")
	}
	return nil
}
