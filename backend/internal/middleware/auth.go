package middleware

import (
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/jwtutil"
	"github.com/sunnystars/backend/internal/pkg/response"
)

const (
	ctxClaims = "auth_claims"
)

// JWT validates the Bearer access token and stores its claims in the context.
func JWT(jwts *jwtutil.Manager) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			header := c.Request().Header.Get(echo.HeaderAuthorization)
			const prefix = "Bearer "
			if !strings.HasPrefix(header, prefix) {
				return response.Err(c, 401, "unauthorized", "missing bearer token", nil)
			}
			claims, err := jwts.Verify(strings.TrimPrefix(header, prefix))
			if err != nil {
				return response.Err(c, 401, "unauthorized", "invalid or expired token", nil)
			}
			c.Set(ctxClaims, claims)
			return next(c)
		}
	}
}

// RequireRole gates a route group to the given roles. Must run after JWT.
func RequireRole(roles ...model.Role) echo.MiddlewareFunc {
	allowed := make(map[model.Role]bool, len(roles))
	for _, r := range roles {
		allowed[r] = true
	}
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			claims := Claims(c)
			if claims == nil {
				return response.Err(c, 403, "forbidden", "insufficient permissions", nil)
			}
			// Superadmin outranks every nursery role, so it passes any gate
			// without each of the existing RequireRole call sites having to
			// list it. Tenant scoping still applies while impersonating.
			if model.Role(claims.Role) == model.RoleSuperAdmin {
				return next(c)
			}
			if !allowed[model.Role(claims.Role)] {
				return response.Err(c, 403, "forbidden", "insufficient permissions", nil)
			}
			return next(c)
		}
	}
}

// RequireSuperAdmin gates the platform console. Unlike RequireRole this admits
// nobody else — a nursery admin must never reach cross-tenant routes.
func RequireSuperAdmin() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			claims := Claims(c)
			if claims == nil || model.Role(claims.Role) != model.RoleSuperAdmin {
				return response.Err(c, 403, "forbidden", "insufficient permissions", nil)
			}
			// An impersonation token is scoped to one nursery; it must not be
			// replayed against the console it was minted from.
			if claims.IsImpersonating() {
				return response.Err(c, 403, "forbidden", "impersonation tokens cannot access the console", nil)
			}
			return next(c)
		}
	}
}

// Claims returns the verified token claims, or nil outside an authenticated route.
func Claims(c echo.Context) *jwtutil.Claims {
	claims, _ := c.Get(ctxClaims).(*jwtutil.Claims)
	return claims
}

// UserID returns the authenticated user id (0 if unauthenticated).
func UserID(c echo.Context) uint64 {
	if claims := Claims(c); claims != nil {
		return claims.UserID
	}
	return 0
}

// Role returns the authenticated user's role ("" if unauthenticated).
func Role(c echo.Context) model.Role {
	if claims := Claims(c); claims != nil {
		return model.Role(claims.Role)
	}
	return ""
}
