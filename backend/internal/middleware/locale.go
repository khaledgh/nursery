package middleware

import (
	"strings"

	"github.com/labstack/echo/v4"
)

const ctxLocale = "locale"

// ActiveLocales is implemented by the i18n service; it returns the set of
// active locale codes plus the default code (cached, refreshed on change).
type ActiveLocales interface {
	Active() (codes map[string]bool, def string)
}

// Locale resolves the request locale: explicit ?locale= wins, then the
// Accept-Language header, then the platform default. Only active locales
// are honoured.
func Locale(locales ActiveLocales) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			active, def := locales.Active()
			resolved := def

			if q := normalize(c.QueryParam("locale")); q != "" && active[q] {
				resolved = q
			} else if header := c.Request().Header.Get("Accept-Language"); header != "" {
				for _, part := range strings.Split(header, ",") {
					code := normalize(strings.SplitN(strings.TrimSpace(part), ";", 2)[0])
					if active[code] {
						resolved = code
						break
					}
				}
			}

			c.Set(ctxLocale, resolved)
			c.Response().Header().Set("Content-Language", resolved)
			return next(c)
		}
	}
}

// normalize maps "en-US" → "en" and lowercases.
func normalize(tag string) string {
	tag = strings.ToLower(strings.TrimSpace(tag))
	if i := strings.IndexAny(tag, "-_"); i > 0 {
		tag = tag[:i]
	}
	return tag
}

// RequestLocale returns the locale resolved for this request.
func RequestLocale(c echo.Context) string {
	loc, _ := c.Get(ctxLocale).(string)
	return loc
}
