package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"raihan-portfolio/backend/auth"
	"syscall"
	"time"

	"raihan-portfolio/backend/config"
	"raihan-portfolio/backend/models"
	"raihan-portfolio/backend/repository"
	"raihan-portfolio/backend/routes"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := run(ctx, logger); err != nil {
		logger.Error(err.Error())
		os.Exit(1)
	}
}

func run(ctx context.Context, logger *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	startup, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	client, err := repository.Connect(startup, cfg.MongoURI)
	if err != nil {
		return err
	}
	defer func() {
		cleanup, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := client.Disconnect(cleanup); err != nil {
			logger.Error("MongoDB disconnect failed")
		}
	}()
	database := client.Database(cfg.Database)
	adminStore, err := auth.NewMongoStore(startup, database)
	if err != nil {
		return errors.New("cannot prepare admin/session collections; check database permissions")
	}
	sessions, err := auth.New(adminStore, auth.Options{Key: cfg.SessionKey, TTL: cfg.SessionTTL, Secure: cfg.CookieSecure}, logger)
	if err != nil {
		return err
	}
	projects, err := repository.NewMongoRepository[models.Project](startup, database, "projects")
	if err != nil {
		return errors.New("cannot prepare projects collection; check database permissions")
	}
	achievements, err := repository.NewMongoRepository[models.Achievement](startup, database, "achievements")
	if err != nil {
		return errors.New("cannot prepare achievements collection; check database permissions")
	}
	server := &http.Server{
		Addr:              cfg.Address,
		Handler:           routes.New(projects, achievements, func(ctx context.Context) error { return client.Ping(ctx, nil) }, cfg.Origins, logger, sessions, cfg.Production),
		ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 15 * time.Second, IdleTimeout: 60 * time.Second,
	}
	failures := make(chan error, 1)
	go func() { failures <- server.ListenAndServe() }()
	logger.Info("Portfolio API starting", "address", cfg.Address, "authentication", "cookie sessions")
	select {
	case err := <-failures:
		if !errors.Is(err, http.ErrServerClosed) {
			return errors.New("HTTP server failed; check HOST, PORT, and port availability")
		}
	case <-ctx.Done():
		logger.Info("Shutting down HTTP server")
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdown); err != nil {
			_ = server.Close()
			return errors.New("HTTP shutdown exceeded its timeout")
		}
	}
	logger.Info("Portfolio API stopped")
	return nil
}
