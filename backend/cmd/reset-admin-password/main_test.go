package main

import (
	"bytes"
	"errors"
	"flag"
	"os"
	"strings"
	"testing"
)

func TestParseUsername(t *testing.T) {
	username, err := parseUsername([]string{"--username", "  RAYHANJR_22  "})
	if err != nil || username != "rayhanjr_22" {
		t.Fatal("username was not normalized")
	}
	for _, args := range [][]string{nil, {"--username"}, {"--username", "bad user"}, {"--username", "fixture.admin", "extra"}, {"--username", "fixture.admin", "--password", "must-not-be-echoed"}} {
		_, err := parseUsername(args)
		if err == nil || strings.Contains(err.Error(), "must-not-be-echoed") {
			t.Fatal("invalid arguments accepted or echoed")
		}
	}
	if _, err := parseUsername([]string{"--help"}); !errors.Is(err, flag.ErrHelp) {
		t.Fatal("help flag not supported")
	}
}

func TestPasswordConfirmation(t *testing.T) {
	cases := []struct {
		name         string
		confirmation string
		failureAt    int
		valid        bool
	}{
		{name: "matching", confirmation: "test-only-new-password", valid: true},
		{name: "mismatch", confirmation: "different-test-password"},
		{name: "first read fails", failureAt: 1},
		{name: "confirmation read fails", failureAt: 2},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			first := []byte("test-only-new-password")
			second := []byte(tc.confirmation)
			output := new(bytes.Buffer)
			calls := 0
			password, err := promptPassword(output, func() ([]byte, error) {
				calls++
				input := first
				if calls == 2 {
					input = second
				}
				if calls == tc.failureAt {
					return input, errors.New("sensitive terminal failure")
				}
				return input, nil
			})
			if (err == nil) != tc.valid || strings.Contains(output.String(), "test-only") || strings.Contains(output.String(), "different-test") {
				t.Fatal("password confirmation failed or password appeared in output")
			}
			if err != nil && strings.Contains(err.Error(), "sensitive") {
				t.Fatal("raw terminal error was exposed")
			}
			if tc.valid {
				if string(password) != "test-only-new-password" {
					t.Fatal("confirmed password changed")
				}
				clear(password)
			}
			if !bytes.Equal(first, make([]byte, len(first))) || (calls == 2 && !bytes.Equal(second, make([]byte, len(second)))) {
				t.Fatal("password buffers not cleared")
			}
		})
	}
}

func TestInvalidConfirmedPassword(t *testing.T) {
	password, err := promptPassword(new(bytes.Buffer), func() ([]byte, error) { return []byte("short"), nil })
	if err == nil || password != nil {
		t.Fatal("invalid confirmed password accepted")
	}
}

func TestRunRejectsPipedInputBeforeDatabaseAccess(t *testing.T) {
	input, err := os.Open(os.DevNull)
	if err != nil {
		t.Fatal(err)
	}
	defer input.Close()
	output := new(bytes.Buffer)
	if err := run([]string{"--username", "fixture.admin"}, input, output); err == nil || !strings.Contains(err.Error(), "interactive terminal") || output.Len() != 0 {
		t.Fatal("nonterminal input was accepted")
	}
	if err := run([]string{"--help"}, input, output); err != nil || !strings.Contains(output.String(), "Usage:") || strings.Contains(output.String(), "Admin password reset.") {
		t.Fatal("help attempted a reset or displayed false success")
	}
}
