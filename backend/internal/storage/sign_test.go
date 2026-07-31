package storage

import (
	"context"
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

// Repeated reads must yield a byte-identical URL, or expo-image's cache (keyed
// on the full URI) misses and every render re-downloads the image.
func TestQueryIsStableAcrossReads(t *testing.T) {
	s := NewSigner("secret-that-is-long-enough-for-hmac", time.Hour)
	first := s.Query(testKey)
	for i := 0; i < 5; i++ {
		if got := s.Query(testKey); got != first {
			t.Fatalf("signature churned between reads: %s != %s", got, first)
		}
	}
}

// The S3/R2 driver's legacy fallback (no presign client wired up) must hand
// back the signed API stream URL, not a bucket URL, to remain safe on
// drivers/tests that never construct a live client.
func TestS3URLFallsBackToSignedStreamURL(t *testing.T) {
	signer := NewSigner("secret-that-is-long-enough-for-hmac", time.Hour)
	s := NewS3StorageForTest("media", "https://acct.r2.cloudflarestorage.com", "auto", "https://api.example.com", signer)

	got := s.URL(testKey)
	if strings.Contains(got, "r2.cloudflarestorage.com") || strings.Contains(got, "amazonaws.com") {
		t.Fatalf("bucket URL leaked to client: %s", got)
	}
	if !strings.HasPrefix(got, "https://api.example.com/api/v1/media/stream/") {
		t.Fatalf("not an API stream URL: %s", got)
	}
	exp, sig := parse(t, strings.SplitN(got, "?", 2)[1])
	if err := s.signer.Verify(testKey, exp, sig); err != nil {
		t.Fatalf("s3 URL carries an invalid signature: %v", err)
	}
}

// The direct-to-R2 path must hand back a SigV4-presigned GET straight to the
// bucket (that's the whole point — the API no longer proxies reads), and
// that URL must actually carry a signature and expiry, not a bare object URL.
func TestS3URLIsPresignedWhenClientIsLive(t *testing.T) {
	s := NewS3StorageWithPresignForTest("media", "https://acct.r2.cloudflarestorage.com", "auto", time.Hour)

	got := s.URL(testKey)
	if !strings.Contains(got, "acct.r2.cloudflarestorage.com") {
		t.Fatalf("expected a direct bucket URL, got: %s", got)
	}
	if !strings.Contains(got, "X-Amz-Signature=") || !strings.Contains(got, "X-Amz-Expires=") {
		t.Fatalf("URL is not presigned: %s", got)
	}
}

// URL() must reuse a cached presigned GET for repeated reads of the same key
// within the TTL window, or expo-image (which caches by full URI) would
// re-download the same photo on every render.
func TestS3URLIsCachedAcrossReads(t *testing.T) {
	s := NewS3StorageWithPresignForTest("media", "https://acct.r2.cloudflarestorage.com", "auto", time.Hour)

	first := s.URL(testKey)
	for i := 0; i < 5; i++ {
		if got := s.URL(testKey); got != first {
			t.Fatalf("presigned URL churned between reads: %s != %s", got, first)
		}
	}
}

// PresignGet always re-signs, unlike URL()'s cache — the confirm step wants a
// guaranteed-fresh signature, not a possibly-stale cached one.
func TestS3PresignPutAndGetAreSigned(t *testing.T) {
	s := NewS3StorageWithPresignForTest("media", "https://acct.r2.cloudflarestorage.com", "auto", time.Hour)

	put, err := s.PresignPut(context.Background(), testKey, "image/jpeg", 1024, 5*time.Minute)
	if err != nil {
		t.Fatalf("PresignPut: %v", err)
	}
	if !strings.Contains(put, "X-Amz-Signature=") {
		t.Fatalf("PresignPut result not signed: %s", put)
	}

	get, err := s.PresignGet(context.Background(), testKey, time.Hour)
	if err != nil {
		t.Fatalf("PresignGet: %v", err)
	}
	if !strings.Contains(get, "X-Amz-Signature=") {
		t.Fatalf("PresignGet result not signed: %s", get)
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
