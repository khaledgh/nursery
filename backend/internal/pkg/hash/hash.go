// Package hash centralizes credential hashing so cost parameters live in one place.
package hash

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"

	"golang.org/x/crypto/bcrypt"
)

// bcryptCost 12 ≈ 250ms per hash on commodity hardware — a deliberate
// brute-force brake; do not lower below bcrypt.DefaultCost.
const bcryptCost = 12

func Password(plain string) (string, error) {
	// bcrypt silently truncates at 72 bytes; reject instead of truncating.
	if len(plain) > 72 {
		return "", bcrypt.ErrPasswordTooLong
	}
	b, err := bcrypt.GenerateFromPassword([]byte(plain), bcryptCost)
	return string(b), err
}

func VerifyPassword(hashed, plain string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hashed), []byte(plain)) == nil
}

// RandomToken returns a 256-bit URL-safe random token (for refresh tokens,
// password resets). The raw value goes to the client; only Token256(raw) is stored.
func RandomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// Token256 hashes an opaque token with SHA-256 for at-rest storage. Tokens are
// already high-entropy, so a fast hash is appropriate (unlike passwords).
func Token256(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

// ConstantTimeEqual compares two strings without leaking length-position timing.
func ConstantTimeEqual(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}
