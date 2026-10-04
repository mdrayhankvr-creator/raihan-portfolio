package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"raihan-portfolio/backend/repository"
)

type Resource[T, Input any] struct {
	Store    repository.Repository[T]
	Validate func(Input, string, time.Time) (T, error)
	Logger   *slog.Logger
}

func JSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func Error(w http.ResponseWriter, status int, message string) {
	JSON(w, status, map[string]string{"error": message})
}

func (h Resource[T, Input]) List(w http.ResponseWriter, r *http.Request) {
	published := r.URL.Query().Get("published")
	if published != "" && published != "true" && published != "false" {
		Error(w, 400, "published query must be true or false")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	records, err := h.Store.List(ctx, published == "true")
	if err != nil {
		h.databaseError(w, "list", err)
		return
	}
	if records == nil {
		records = []T{}
	}
	JSON(w, http.StatusOK, records)
}

func (h Resource[T, Input]) Create(w http.ResponseWriter, r *http.Request) {
	record, ok := h.decode(w, r, bson.NewObjectID().Hex())
	if !ok {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	if err := h.Store.Create(ctx, record); err != nil {
		h.databaseError(w, "create", err)
		return
	}
	JSON(w, http.StatusCreated, record)
}

func (h Resource[T, Input]) Update(w http.ResponseWriter, r *http.Request) {
	id, ok := resourceID(w, r)
	if !ok {
		return
	}
	record, ok := h.decode(w, r, id)
	if !ok {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	updated, err := h.Store.Update(ctx, id, record)
	if err != nil {
		h.databaseError(w, "update", err)
		return
	}
	JSON(w, http.StatusOK, updated)
}

func (h Resource[T, Input]) Delete(w http.ResponseWriter, r *http.Request) {
	id, ok := resourceID(w, r)
	if !ok {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	if err := h.Store.Delete(ctx, id); err != nil {
		h.databaseError(w, "delete", err)
		return
	}
	JSON(w, http.StatusOK, map[string]string{"id": id, "message": "Deleted"})
}

func (h Resource[T, Input]) decode(w http.ResponseWriter, r *http.Request, id string) (T, bool) {
	var zero T
	contentType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || contentType != "application/json" {
		Error(w, 400, "Content-Type must be application/json")
		return zero, false
	}
	r.Body = http.MaxBytesReader(w, r.Body, 64*1024)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	var input *Input
	if err := decoder.Decode(&input); err != nil || input == nil {
		Error(w, 400, "Invalid JSON body, field type, unknown field, or body exceeds 64 KiB")
		return zero, false
	}
	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		Error(w, 400, "Body must contain exactly one JSON object")
		return zero, false
	}
	record, err := h.Validate(*input, id, time.Now().UTC().Truncate(time.Millisecond))
	if err != nil {
		Error(w, 400, err.Error())
		return zero, false
	}
	return record, true
}

func resourceID(w http.ResponseWriter, r *http.Request) (string, bool) {
	id, err := bson.ObjectIDFromHex(r.PathValue("id"))
	if err != nil {
		Error(w, 400, "Invalid record ID")
		return "", false
	}
	return id.Hex(), true
}

func (h Resource[T, Input]) databaseError(w http.ResponseWriter, operation string, err error) {
	if errors.Is(err, repository.ErrNotFound) {
		Error(w, 404, "Record not found")
		return
	}
	// Driver errors can contain connection details; log only safe classifications.
	kind := "database_error"
	if errors.Is(err, context.DeadlineExceeded) {
		kind = "timeout"
	}
	if errors.Is(err, context.Canceled) {
		kind = "canceled"
	}
	h.Logger.Error("Content operation failed", "operation", operation, "kind", kind)
	Error(w, 500, "Database operation failed. Please try again.")
}

func Health(ping func(context.Context) error, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()
		if err := ping(ctx); err != nil {
			logger.Error("Database health check failed")
			Error(w, 500, "Database unavailable")
			return
		}
		JSON(w, 200, map[string]string{"status": "ok", "database": "connected"})
	}
}
