package jwtutil

import (
	"testing"
	"time"
)

const testSecret = "0123456789abcdef0123456789abcdef-test-secret"

func TestIssueAndVerify(t *testing.T) {
	m := NewManager(testSecret, time.Minute, "test")
	token, exp, err := m.Issue(42, "parent", 7)
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
	if claims.UserID != 42 || claims.Role != "parent" || claims.NurseryID != 7 {
		t.Fatalf("claims mismatch: %+v", claims)
	}
}

func TestVerifyRejectsExpired(t *testing.T) {
	m := NewManager(testSecret, -time.Minute, "test")
	token, _, err := m.Issue(1, "admin", 1)
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
	token, _, err := a.Issue(1, "admin", 1)
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
	token, _, err := a.Issue(1, "admin", 1)
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

// A token minted before multi-tenancy carries no nid. It must still verify —
// the Tenant middleware is what rejects it, so the client's refresh
// interceptor can swap it for a scoped one instead of forcing a logout.
func TestVerifyAcceptsTokenWithoutNursery(t *testing.T) {
	m := NewManager(testSecret, time.Minute, "test")
	token, _, err := m.Issue(1, "parent", 0)
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	claims, err := m.Verify(token)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if claims.NurseryID != 0 {
		t.Fatalf("NurseryID = %d, want 0", claims.NurseryID)
	}
}

// While impersonating, the audit trail must name the real superadmin rather
// than the nursery whose context they borrowed.
func TestImpersonationClaims(t *testing.T) {
	m := NewManager(testSecret, time.Minute, "test")
	token, _, err := m.IssueImpersonation(99, "superadmin", 4, 7, time.Minute)
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	claims, err := m.Verify(token)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if !claims.IsImpersonating() {
		t.Fatal("expected token to be flagged as impersonation")
	}
	if got := claims.AuditActor(); got != 7 {
		t.Fatalf("AuditActor() = %d, want 7 (the real superadmin)", got)
	}
	if claims.NurseryID != 4 {
		t.Fatalf("NurseryID = %d, want 4 (the impersonated nursery)", claims.NurseryID)
	}
}

func TestAuditActorFallsBackToSubject(t *testing.T) {
	c := &Claims{UserID: 5}
	if got := c.AuditActor(); got != 5 {
		t.Fatalf("AuditActor() = %d, want 5", got)
	}
	if c.IsImpersonating() {
		t.Fatal("a plain token must not read as impersonation")
	}
}
