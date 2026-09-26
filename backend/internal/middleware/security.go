package middleware

import (
	"strings"

	"github.com/labstack/echo/v4"
)

// mediaStreamPrefix serves images rather than JSON, so it needs different
// cross-origin and caching rules from the rest of the API.
const mediaStreamPrefix = "/api/v1/media/stream/"

// SecurityHeaders sets defensive HTTP headers on every response. Everything
// except media streaming is JSON, where a restrictive CSP is safe.
func SecurityHeaders() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			h := c.Response().Header()
			h.Set("X-Content-Type-Options", "nosniff")
			h.Set("X-Frame-Options", "DENY")
			h.Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains")

			p := c.Request().URL.Path
			if strings.HasPrefix(p, "/api") {
				h.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
				h.Set("Cross-Origin-Opener-Policy", "same-origin")
				if strings.HasPrefix(p, mediaStreamPrefix) {
					h.Set("Cross-Origin-Resource-Policy", "cross-origin")
				} else {
					h.Set("Cross-Origin-Resource-Policy", "same-origin")
					h.Set("Cache-Control", "no-store")
				}
			} else {
				// Admin frontend SPA & static assets
				h.Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https: http:; connect-src 'self' ws: wss: https: http:; frame-ancestors 'none'")
				h.Set("Cross-Origin-Resource-Policy", "cross-origin")
			}
			return next(c)
		}
	}
}
