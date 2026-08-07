package middleware

import (
	"github.com/labstack/echo/v4"

	"github.com/sunnystars/backend/internal/database"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/response"
)

// Tenant puts the caller's nursery on the request context so the GORM tenancy
// callbacks can scope every query. Must run after JWT.
//
// Superadmins carry no nursery and get a cross-tenant context instead; the
// /superadmin routes are the only ones that should rely on that.
func Tenant() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			claims := Claims(c)
			if claims == nil {
				return response.Err(c, 401, "unauthorized", "missing token claims", nil)
			}

			ctx := c.Request().Context()
			if model.Role(claims.Role) == model.RoleSuperAdmin && claims.NurseryID == 0 {
				ctx = database.WithCrossTenant(ctx)
			} else {
				if claims.NurseryID == 0 {
					// Pre-multi-tenancy token. Refusing it (rather than guessing a
					// nursery) makes the client's refresh interceptor mint a new
					// one carrying nid — a silent upgrade, no forced logout.
					return response.Err(c, 401, "token_stale", "token predates multi-tenancy; refresh required", nil)
				}
				ctx = database.WithTenant(ctx, claims.NurseryID)
			}

			c.SetRequest(c.Request().WithContext(ctx))
			return next(c)
		}
	}
}

// NurseryID returns the caller's nursery (0 for superadmins).
func NurseryID(c echo.Context) uint64 {
	if claims := Claims(c); claims != nil {
		return claims.NurseryID
	}
	return 0
}

// AuditActor returns the user id to record against an action — the real
// superadmin when impersonating, otherwise the caller.
func AuditActor(c echo.Context) uint64 {
	if claims := Claims(c); claims != nil {
		return claims.AuditActor()
	}
	return 0
}
