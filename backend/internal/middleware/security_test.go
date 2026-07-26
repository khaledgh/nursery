package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
)

func headersFor(t *testing.T, path string) http.Header {
	t.Helper()
	e := echo.New()
	e.Use(SecurityHeaders())
	e.GET("/*", func(c echo.Context) error { return c.NoContent(http.StatusOK) })
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	return rec.Header()
}

// same-origin CORP makes the browser discard an otherwise successful image
// response when the dashboard is on another origin.
func TestMediaStreamAllowsCrossOriginEmbedding(t *testing.T) {
	h := headersFor(t, "/api/v1/media/stream/2026/07/a.jpg?exp=1&sig=x")
	if got := h.Get("Cross-Origin-Resource-Policy"); got != "cross-origin" {
		t.Fatalf("CORP = %q, want cross-origin", got)
	}
	// no-store here would defeat the stream handler's private cache.
	if got := h.Get("Cache-Control"); got == "no-store" {
		t.Fatal("media responses must not be no-store")
	}
}

// The relaxed rules must not leak onto the JSON API.
func TestJSONRoutesStayLocked(t *testing.T) {
	h := headersFor(t, "/api/v1/events")
	if got := h.Get("Cross-Origin-Resource-Policy"); got != "same-origin" {
		t.Fatalf("CORP = %q, want same-origin", got)
	}
	if got := h.Get("Cache-Control"); got != "no-store" {
		t.Fatalf("Cache-Control = %q, want no-store", got)
	}
}

// A path merely containing the segment elsewhere must not be treated as media.
func TestPrefixIsNotSubstringMatch(t *testing.T) {
	h := headersFor(t, "/api/v1/events?next=/api/v1/media/stream/x.jpg")
	if got := h.Get("Cross-Origin-Resource-Policy"); got != "same-origin" {
		t.Fatalf("CORP = %q, want same-origin", got)
	}
}

func TestBaselineHeadersAlwaysSet(t *testing.T) {
	for _, path := range []string{"/api/v1/events", "/api/v1/media/stream/a.jpg"} {
		h := headersFor(t, path)
		for _, key := range []string{
			"X-Content-Type-Options",
			"X-Frame-Options",
			"Referrer-Policy",
			"Strict-Transport-Security",
		} {
			if h.Get(key) == "" {
				t.Errorf("%s: missing %s", path, key)
			}
		}
	}
}
