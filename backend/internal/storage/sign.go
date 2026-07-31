package storage

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// Media URLs are consumed by <img> and React Native <Image>, neither of which can
// attach an Authorization header. Instead of dropping auth, the stream endpoint
// takes a short-lived HMAC signature in the query string: the URL itself is the
// capability, and it expires.
type Signer struct {
	secret []byte
	ttl    time.Duration
}

func NewSigner(secret string, ttl time.Duration) *Signer {
	return &Signer{secret: []byte(secret), ttl: ttl}
}

// sum is the raw HMAC over the exact bytes that must not be tampered with: the
// storage key and the expiry. Binding both means a signature for one file cannot
// be replayed for another, nor have its deadline extended.
func (s *Signer) sum(key string, exp int64) string {
	m := hmac.New(sha256.New, s.secret)
	fmt.Fprintf(m, "%s\n%d", key, exp)
	return base64.RawURLEncoding.EncodeToString(m.Sum(nil))
}

// Query returns the "exp=...&sig=..." pair to append to a media URL.
//
// The deadline is rounded up to a whole TTL window rather than being computed
// from the exact current time. Two reads of the same file therefore produce a
// byte-identical URL for the life of that window, which is what lets the mobile
// image cache hit: expo-image keys its cache on the full URI, so a signature
// that changed on every read would force a re-download of every image.
func (s *Signer) Query(key string) string {
	exp := s.expiry()
	return fmt.Sprintf("exp=%d&sig=%s", exp, s.sum(key, exp))
}

func (s *Signer) expiry() int64 {
	now := time.Now()
	ttl := int64(s.ttl / time.Second)
	// A non-positive TTL means "already expired" and must stay that way; only
	// round when there is a real window to round to.
	if ttl <= 0 {
		return now.Add(s.ttl).Unix()
	}
	// Round up to a TTL boundary so repeated reads of the same key produce an
	// identical URL. Adding a second window guarantees a read landing just
	// before a boundary still gets a usefully long lifetime.
	return (now.Unix()/ttl + 2) * ttl
}

// StreamURL builds the signed, API-relative URL that serves key. Both storage
// drivers return this: media is access-checked by the API, never fetched from
// the bucket directly, so the URL shape must not depend on the backend.
func StreamURL(baseURL, key string, signer *Signer) string {
	// Escape each segment individually: "/" must stay a path separator.
	parts := strings.Split(key, "/")
	for i, p := range parts {
		parts[i] = url.PathEscape(p)
	}
	u := strings.TrimRight(baseURL, "/") + "/api/v1/media/stream/" + strings.Join(parts, "/")
	if signer == nil {
		return u
	}
	// Signed over the raw key, which is what the handler recovers after routing.
	return u + "?" + signer.Query(key)
}

// Verify reports whether sig matches key and the deadline has not passed.
func (s *Signer) Verify(key, expRaw, sig string) error {
	exp, err := strconv.ParseInt(expRaw, 10, 64)
	if err != nil {
		return fmt.Errorf("malformed expiry")
	}
	// Compare before the clock check so a bad signature and an expired one take
	// the same path; constant-time to avoid leaking the expected value.
	if !hmac.Equal([]byte(sig), []byte(s.sum(key, exp))) {
		return fmt.Errorf("invalid signature")
	}
	if time.Now().Unix() > exp {
		return fmt.Errorf("link expired")
	}
	return nil
}
