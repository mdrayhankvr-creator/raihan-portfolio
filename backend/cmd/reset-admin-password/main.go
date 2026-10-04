package main

import (
	"bytes"
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"time"

	"golang.org/x/term"
	"raihan-portfolio/backend/auth"
	"raihan-portfolio/backend/config"
	"raihan-portfolio/backend/repository"
)

func main() {
	if err := run(os.Args[1:], os.Stdin, os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func parseUsername(args []string) (string, error) {
	flags := flag.NewFlagSet("reset-admin-password", flag.ContinueOnError)
	// Unknown arguments could contain a password: never echo them in errors.
	flags.SetOutput(io.Discard)
	username := flags.String("username", "", "existing admin username")
	if err := flags.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return "", flag.ErrHelp
		}
		return "", errors.New("use only --username; passwords must be entered at the hidden prompts")
	}
	if flags.NArg() != 0 || *username == "" {
		return "", errors.New("usage: go run ./cmd/reset-admin-password --username <existing-admin>")
	}
	return auth.NormalizeUsername(*username)
}

func run(args []string, input *os.File, output io.Writer) error {
	username, err := parseUsername(args)
	if errors.Is(err, flag.ErrHelp) {
		fmt.Fprintln(output, "Usage: go run ./cmd/reset-admin-password --username <existing-admin>")
		fmt.Fprintln(output, "Enter the new password twice at the hidden terminal prompts. Existing sessions will be revoked.")
		return nil
	}
	if err != nil {
		return err
	}
	fd := int(input.Fd())
	if !term.IsTerminal(fd) {
		return errors.New("an interactive terminal is required; piped passwords are not accepted")
	}
	password, err := promptPassword(output, func() ([]byte, error) { return term.ReadPassword(fd) })
	if err != nil {
		return err
	}
	defer clear(password)
	// Load config and start timeouts after prompting, so user input never consumes
	// the MongoDB operation deadline. ADMIN_PASSWORD is not used by this command.
	cfg, err := config.LoadDatabase()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
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
		return errors.New("cannot prepare authentication collections; check database access")
	}
	if err := auth.ResetAdminPassword(ctx, store, username, password); err != nil {
		if errors.Is(err, auth.ErrNotFound) {
			return errors.New("admin not found; verify the username and configured database; no account was created")
		}
		if errors.Is(err, auth.ErrAdminChanged) {
			return auth.ErrAdminChanged
		}
		// Driver errors may contain connection details; do not print them.
		return errors.New("password reset could not be confirmed; check database access and transaction support (replica set or Atlas), then retry")
	}
	fmt.Fprintln(output, "Admin password reset. Existing sessions revoked. Account identity and permissions preserved.")
	return nil
}

func promptPassword(output io.Writer, readHidden func() ([]byte, error)) ([]byte, error) {
	fmt.Fprint(output, "New password: ")
	password, err := readHidden()
	fmt.Fprintln(output)
	if err != nil {
		clear(password)
		return nil, errors.New("cannot read hidden password input; reset cancelled")
	}
	keepPassword := false
	defer func() {
		if !keepPassword {
			clear(password)
		}
	}()
	fmt.Fprint(output, "Confirm new password: ")
	confirmation, err := readHidden()
	fmt.Fprintln(output)
	defer clear(confirmation)
	if err != nil {
		return nil, errors.New("cannot read hidden password confirmation; reset cancelled")
	}
	if !bytes.Equal(password, confirmation) {
		return nil, errors.New("passwords do not match; reset cancelled")
	}
	if err := auth.ValidatePassword(password); err != nil {
		return nil, err
	}
	keepPassword = true
	return password, nil
}
