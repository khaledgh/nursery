// Package jwtutil issues and verifies the short-lived access tokens.
// Refresh tokens are opaque random strings handled by the auth service,
// not JWTs — they are stored hashed and individually revocable.
package jwtutil

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID uint64 `json:"uid"`
	Role   string `json:"role"`
	// NurseryID scopes every query made with this token. Zero for superadmins,
	// who are not bound to a tenant. Tokens minted before multi-tenancy lack it
	// entirely; the Tenant middleware rejects those so the client's refresh
	// interceptor transparently re-mints one.
	NurseryID uint64 `json:"nid,omitempty"`
	// ActingAs carries the real superadmin id while impersonating a nursery, so
	// the audit trail records who actually performed an action.
	ActingAs uint64 `json:"act,omitempty"`
	jwt.RegisteredClaims
}

// IsImpersonating reports whether this token was minted for a superadmin
// operating inside a customer's nursery.
func (c *Claims) IsImpersonating() bool { return c.ActingAs != 0 }

// AuditActor returns the user id that should be recorded against an action:
// the real superadmin when impersonating, otherwise the token's own subject.
func (c *Claims) AuditActor() uint64 {
	if c.ActingAs != 0 {
		return c.ActingAs
	}
	return c.UserID
}

type Manager struct {
	secret    []byte
	accessTTL time.Duration
	issuer    string
}

func NewManager(secret string, accessTTL time.Duration, issuer string) *Manager {
	return &Manager{secret: []byte(secret), accessTTL: accessTTL, issuer: issuer}
}

// Issue mints an access token. nurseryID is 0 for superadmins only.
func (m *Manager) Issue(userID uint64, role string, nurseryID uint64) (string, time.Time, error) {
	return m.issue(userID, role, nurseryID, 0, m.accessTTL)
}

// IssueImpersonation mints a short-lived token letting a superadmin act inside
// one nursery. actingAs records the real superadmin for the audit trail.
func (m *Manager) IssueImpersonation(userID uint64, role string, nurseryID, actingAs uint64, ttl time.Duration) (string, time.Time, error) {
	return m.issue(userID, role, nurseryID, actingAs, ttl)
}

func (m *Manager) issue(userID uint64, role string, nurseryID, actingAs uint64, ttl time.Duration) (string, time.Time, error) {
	now := time.Now()
	exp := now.Add(ttl)
	claims := Claims{
		UserID:    userID,
		Role:      role,
		NurseryID: nurseryID,
		ActingAs:  actingAs,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    m.issuer,
			Subject:   fmt.Sprintf("%d", userID),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
		},
	}
	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(m.secret)
	return signed, exp, err
}

// Verify parses and validates a token, pinning the signing algorithm to
// HS256 to rule out algorithm-confusion attacks.
func (m *Manager) Verify(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{},
		func(t *jwt.Token) (any, error) { return m.secret, nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(m.issuer),
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token claims")
	}
	return claims, nil
}
