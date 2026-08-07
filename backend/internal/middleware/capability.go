package middleware

import (
	"github.com/labstack/echo/v4"

	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/response"
)

// RequireCapability blocks a route when the nursery's plan doesn't include the
// module. The UI also hides these, but hiding is not enforcement — this is.
func RequireCapability(check func(c echo.Context, capability string) (bool, error), capability string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			claims := Claims(c)
			if claims == nil {
				return response.Err(c, 401, "unauthorized", "missing token claims", nil)
			}
			// Superadmins are not bound by a customer's plan.
			if model.Role(claims.Role) == model.RoleSuperAdmin && claims.NurseryID == 0 {
				return next(c)
			}
			ok, err := check(c, capability)
			if err != nil {
				return err
			}
			if !ok {
				return response.Err(c, 403, "capability_disabled",
					"this feature is not included in the current plan", nil)
			}
			return next(c)
		}
	}
}
