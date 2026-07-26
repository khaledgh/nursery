package storage

import (
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"
)

const testKey = "2026/07/o6LNFIvsHv4YYF6CDuGUtZBla-hbgY0fHpWKxI7WX0g.jpg"

// parse pulls exp/sig back out of a generated query the way the handler would.
func parse(t *testing.T, q string) (string, string) {
	t.Helper()
	v, err := url.ParseQuery(q)
	if err != nil {
		t.Fatalf("parse query: %v", err)
	}
	return v.Get("exp"), v.Get("sig")
}

func TestVerifyAcceptsFreshSignature(t *testing.T) {
	s := NewSigner("secret-that-is-long-enough-for-hmac", time.Hour)
	exp, sig := parse(t, s.Query(testKey))
	if err := s.Verify(testKey, exp, sig); err != nil {
		t.Fatalf("fresh signature rejected: %v", err)
	}
}

func TestVerifyRejectsExpired(t *testing.T) {
	s := NewSigner("secret-that-is-long-enough-for-hmac", -time.Second)
	exp, sig := parse(t, s.Query(testKey))
	if err := s.Verify(testKey, exp, sig); err == nil {
		t.Fatal("expired signature accepted")
	}
}

// A signature must not be transferable to another file, or one shared photo
// would unlock the whole upload directory.
func TestVerifyRejectsKeySwap(t *testing.T) {
	s := NewSigner("secret-that-is-long-enough-for-hmac", time.Hour)
	exp, sig := parse(t, s.Query(testKey))
	if err := s.Verify("2026/07/someone-elses-child.jpg", exp, sig); err == nil {
		t.Fatal("signature valid for a different key")
	}
}

// Extending exp must invalidate the signature, since exp is part of the MAC.
func TestVerifyRejectsExtendedExpiry(t *testing.T) {
	s := NewSigner("secret-that-is-long-enough-for-hmac", time.Hour)
	_, sig := parse(t, s.Query(testKey))
	far := time.Now().Add(100 * time.Hour).Unix()
	if err := s.Verify(testKey, strconv.FormatInt(far, 10), sig); err == nil {
		t.Fatal("tampered expiry accepted")
	}
}

func TestVerifyRejectsGarbage(t *testing.T) {
	s := NewSigner("secret-that-is-long-enough-for-hmac", time.Hour)
	exp, _ := parse(t, s.Query(testKey))
	for _, sig := range []string{"", "not-base64!!", strings.Repeat("A", 43)} {
		if err := s.Verify(testKey, exp, sig); err == nil {
			t.Fatalf("accepted bogus signature %q", sig)
		}
	}
	if err := s.Verify(testKey, "not-a-number", "x"); err == nil {
		t.Fatal("accepted malformed expiry")
	}
}

// URL keys contain "/" and must survive escaping as path separators.
func TestURLKeepsPathSeparators(t *testing.T) {
	s, err := NewLocalStorage(t.TempDir(), "http://localhost:8080", NewSigner("secret-that-is-long-enough-for-hmac", time.Hour))
	if err != nil {
		t.Fatalf("init: %v", err)
	}
	got := s.URL(testKey)
	if !strings.Contains(got, "/api/v1/media/stream/"+testKey) {
		t.Fatalf("key mangled in URL: %s", got)
	}
	if !strings.Contains(got, "sig=") || !strings.Contains(got, "exp=") {
		t.Fatalf("URL not signed: %s", got)
	}
}
