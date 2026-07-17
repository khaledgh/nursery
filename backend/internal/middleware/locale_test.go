package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
)

type fakeLocales struct{}

func (fakeLocales) Active() (map[string]bool, string) {
	return map[string]bool{"en": true, "ar": true, "sv": true}, "en"
}

func resolve(t *testing.T, target string, acceptLanguage string) string {
	t.Helper()
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, target, nil)
	if acceptLanguage != "" {
		req.Header.Set("Accept-Language", acceptLanguage)
	}
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	var got string
	h := Locale(fakeLocales{})(func(c echo.Context) error {
		got = RequestLocale(c)
		return nil
	})
	if err := h(c); err != nil {
		t.Fatalf("handler: %v", err)
	}
	return got
}

func TestLocaleResolution(t *testing.T) {
	cases := []struct {
		name, target, header, want string
	}{
		{"default when nothing sent", "/", "", "en"},
		{"query param wins", "/?locale=ar", "sv", "ar"},
		{"inactive query falls back to header", "/?locale=de", "sv", "sv"},
		{"header first match", "/", "fr,sv;q=0.8,en;q=0.5", "sv"},
		{"region tag normalized", "/", "ar-SA", "ar"},
		{"unknown header falls back to default", "/", "de-DE,fr;q=0.9", "en"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := resolve(t, tc.target, tc.header); got != tc.want {
				t.Fatalf("want %q, got %q", tc.want, got)
			}
		})
	}
}
