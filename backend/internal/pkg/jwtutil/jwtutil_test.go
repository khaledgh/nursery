package jwtutil

import (
	"testing"
	"time"
)

const testSecret = "0123456789abcdef0123456789abcdef-test-secret"

func TestIssueAndVerify(t *testing.T) {
	m := NewManager(testSecret, time.Minute, "test")
	token, exp, err := m.Issue(42, "parent")
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	if time.Until(exp) > time.Minute || time.Until(exp) <= 0 {
		t.Fatalf("unexpected expiry: %v", exp)
	}
	claims, err := m.Verify(token)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if claims.UserID != 42 || claims.Role != "parent" {
		t.Fatalf("claims mismatch: %+v", claims)
	}
}

func TestVerifyRejectsExpired(t *testing.T) {
	m := NewManager(testSecret, -time.Minute, "test")
	token, _, err := m.Issue(1, "admin")
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	if _, err := m.Verify(token); err == nil {
		t.Fatal("expected expired token to be rejected")
	}
}

func TestVerifyRejectsWrongSecret(t *testing.T) {
	a := NewManager(testSecret, time.Minute, "test")
	b := NewManager("another-secret-another-secret-another-32", time.Minute, "test")
	token, _, err := a.Issue(1, "admin")
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	if _, err := b.Verify(token); err == nil {
		t.Fatal("expected token signed with a different secret to be rejected")
	}
}

func TestVerifyRejectsWrongIssuer(t *testing.T) {
	a := NewManager(testSecret, time.Minute, "issuer-a")
	b := NewManager(testSecret, time.Minute, "issuer-b")
	token, _, err := a.Issue(1, "admin")
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	if _, err := b.Verify(token); err == nil {
		t.Fatal("expected token from a different issuer to be rejected")
	}
}

func TestVerifyRejectsGarbage(t *testing.T) {
	m := NewManager(testSecret, time.Minute, "test")
	for _, tok := range []string{"", "abc", "a.b.c"} {
		if _, err := m.Verify(tok); err == nil {
			t.Fatalf("expected %q to be rejected", tok)
		}
	}
}
