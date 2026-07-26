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
			h.Set("Referrer-Policy", "no-referrer")
			h.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
			h.Set("Cross-Origin-Opener-Policy", "same-origin")
			h.Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains")

			if strings.HasPrefix(c.Request().URL.Path, mediaStreamPrefix) {
				// The dashboard and app load these images from another origin, so
				// same-origin CORP would make the browser discard a 200 response
				// ("ERR_BLOCKED_BY_RESPONSE.NotSameOrigin"). cross-origin here only
				// permits embedding; the signed URL still gates who can fetch it.
				h.Set("Cross-Origin-Resource-Policy", "cross-origin")
				// Caching is left to the stream handler, which allows a private
				// cache for the lifetime of the signature.
			} else {
				h.Set("Cross-Origin-Resource-Policy", "same-origin")
				h.Set("Cache-Control", "no-store")
			}
			return next(c)
		}
	}
}
