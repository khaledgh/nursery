package middleware

import (
	"github.com/labstack/echo/v4"
)

// SecurityHeaders sets defensive HTTP headers on every response. The API
// serves JSON only, so a restrictive CSP is safe.
func SecurityHeaders() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			h := c.Response().Header()
			h.Set("X-Content-Type-Options", "nosniff")
			h.Set("X-Frame-Options", "DENY")
			h.Set("Referrer-Policy", "no-referrer")
			h.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
			h.Set("Cross-Origin-Opener-Policy", "same-origin")
			h.Set("Cross-Origin-Resource-Policy", "same-origin")
			h.Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
			h.Set("Cache-Control", "no-store")
			return next(c)
		}
	}
}
