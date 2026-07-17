package hash

import (
	"strings"
	"testing"
)

func TestPasswordRoundTrip(t *testing.T) {
	h, err := Password("correct horse battery staple")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	if !VerifyPassword(h, "correct horse battery staple") {
		t.Fatal("expected matching password to verify")
	}
	if VerifyPassword(h, "wrong password") {
		t.Fatal("expected non-matching password to fail")
	}
}

func TestPasswordRejectsOver72Bytes(t *testing.T) {
	if _, err := Password(strings.Repeat("a", 73)); err == nil {
		t.Fatal("expected >72 byte password to be rejected, not silently truncated")
	}
}

func TestRandomTokenUniqueness(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 100; i++ {
		tok, err := RandomToken()
		if err != nil {
			t.Fatalf("token: %v", err)
		}
		if len(tok) < 40 {
			t.Fatalf("token too short: %d chars", len(tok))
		}
		if seen[tok] {
			t.Fatal("duplicate token generated")
		}
		seen[tok] = true
	}
}

func TestToken256Deterministic(t *testing.T) {
	if Token256("abc") != Token256("abc") {
		t.Fatal("hash must be deterministic")
	}
	if Token256("abc") == Token256("abd") {
		t.Fatal("different inputs must hash differently")
	}
	if len(Token256("abc")) != 64 {
		t.Fatal("expected 64 hex chars")
	}
}
