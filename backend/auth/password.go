package auth

import (
	"bytes"
	"context"
	"errors"
	"golang.org/x/crypto/bcrypt"
	"regexp"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

const PasswordCost = 12

var usernamePattern = regexp.MustCompile(`^[a-z0-9._-]{3,64}$`)

func NormalizeUsername(value string) (string, error) {
	value = strings.ToLower(strings.TrimSpace(value))
	if !usernamePattern.MatchString(value) {
		return "", errors.New("username must contain 3-64 ASCII letters, digits, dots, underscores, or hyphens")
	}
	return value, nil
}
func InitializeAdmin(ctx context.Context, store Store, username, password string) error {
	username, err := NormalizeUsername(username)
	if err != nil {
		return err
	}
	if err := ValidatePassword([]byte(password)); err != nil {
		return err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), PasswordCost)
	if err != nil {
		return errors.New("password hashing failed")
	}
	return store.CreateAdmin(ctx, Admin{Username: username, PasswordHash: hash, Role: "admin", CreatedAt: time.Now().UTC()})
}

// ValidatePassword is shared by first-admin initialization and the local reset CLI.
func ValidatePassword(password []byte) error {
	if !utf8.Valid(password) || utf8.RuneCount(password) < 12 || len(password) > 72 || len(bytes.TrimSpace(password)) == 0 || bytes.IndexFunc(password, unicode.IsControl) >= 0 {
		return errors.New("ADMIN_PASSWORD must contain at least 12 characters, at most 72 UTF-8 bytes, and no control characters")
	}
	return nil
}
