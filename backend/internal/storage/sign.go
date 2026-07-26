package storage

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"strconv"
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
func (s *Signer) Query(key string) string {
	exp := time.Now().Add(s.ttl).Unix()
	return fmt.Sprintf("exp=%d&sig=%s", exp, s.sum(key, exp))
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
