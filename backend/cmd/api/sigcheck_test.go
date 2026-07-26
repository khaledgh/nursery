package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sunnystars/backend/internal/storage"
)

// End-to-end shape check: a signed URL must survive routing and verify, an
// unsigned one must not.
func TestSignedURLRoundTrip(t *testing.T) {
	signer := storage.NewSigner("secret-that-is-long-enough-for-hmac", time.Hour)
	local, err := storage.NewLocalStorage(t.TempDir(), "http://api.example.com", signer)
	if err != nil {
		t.Fatal(err)
	}
	key := "2026/07/o6LNFIvsHv4YYF6CDuGUtZBla-hbgY0fHpWKxI7WX0g.jpg"
	full := local.URL(key)

	e := echo.New()
	var gotKey string
	var verifyErr error
	e.GET("/api/v1/media/stream/*", func(c echo.Context) error {
		gotKey = strings.TrimPrefix(c.Param("*"), "/")
		q := c.QueryParams()
		verifyErr = signer.Verify(gotKey, q.Get("exp"), q.Get("sig"))
		return c.NoContent(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, strings.TrimPrefix(full, "http://api.example.com"), nil)
	e.ServeHTTP(httptest.NewRecorder(), req)

	if gotKey != key {
		t.Fatalf("key not recovered through routing:\n got %q\nwant %q", gotKey, key)
	}
	if verifyErr != nil {
		t.Fatalf("signed URL failed verification: %v", verifyErr)
	}

	// Same path with the query stripped is what an <img> would hit if unsigned.
	req2 := httptest.NewRequest(http.MethodGet, "/api/v1/media/stream/"+key, nil)
	e.ServeHTTP(httptest.NewRecorder(), req2)
	if verifyErr == nil {
		t.Fatal("unsigned request passed verification")
	}
}
