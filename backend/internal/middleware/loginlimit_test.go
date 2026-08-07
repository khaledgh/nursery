package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"

	"github.com/sunnystars/backend/internal/pkg/apperr"
)

// attempt drives one login request through the limiter, with the handler
// returning the given status.
func attempt(t *testing.T, l *LoginLimiter, body string, handlerStatus int) int {
	t.Helper()
	e := echo.New()
	e.POST("/auth/login", func(c echo.Context) error {
		return c.NoContent(handlerStatus)
	}, l.Middleware())

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/auth/login", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	e.ServeHTTP(rec, req)
	return rec.Code
}

// attemptViaError drives a request through a handler that *returns* an error
// instead of writing a status, which is how every real handler in this app
// behaves — Echo's central error handler renders it afterwards.
//
// Regression test for a bug the original unit tests could not catch: the
// limiter read c.Response().Status, which is still an uncommitted 200 at that
// point, so it counted every failed login as a success and never locked
// anything out. Caught by exercising the live API, not by these tests.
func attemptViaError(t *testing.T, l *LoginLimiter, body string, handlerErr error) int {
	t.Helper()
	e := echo.New()
	e.HTTPErrorHandler = func(err error, c echo.Context) {
		if c.Response().Committed {
			return
		}
		_ = c.NoContent(apperr.From(err).HTTPStatus())
	}
	e.POST("/auth/login", func(c echo.Context) error {
		if handlerErr != nil {
			return handlerErr
		}
		return c.NoContent(http.StatusOK)
	}, l.Middleware())

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/auth/login", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	e.ServeHTTP(rec, req)
	return rec.Code
}

func TestLimiterCountsErrorsReturnedByHandler(t *testing.T) {
	l := NewLoginLimiter()
	body := `{"login_id":"sunny-1042","password":"WrongPassword1"}`
	unauthorized := apperr.Unauthorized("invalid credentials")

	for i := 0; i < maxFailures; i++ {
		if code := attemptViaError(t, l, body, unauthorized); code != http.StatusUnauthorized {
			t.Fatalf("attempt %d: code = %d, want 401", i+1, code)
		}
	}
	if code := attemptViaError(t, l, body, unauthorized); code != http.StatusTooManyRequests {
		t.Fatalf("code = %d, want 429 — returned errors must count as failures", code)
	}
}

// A validation failure is the user's typo, not a credential guess, so it must
// not consume the budget.
func TestLimiterIgnoresValidationFailures(t *testing.T) {
	l := NewLoginLimiter()
	body := `{"login_id":"sunny-1042","password":"short"}`
	invalid := apperr.Validation(map[string]string{"password": "must be at least 8 characters"})

	for i := 0; i < maxFailures*2; i++ {
		if code := attemptViaError(t, l, body, invalid); code == http.StatusTooManyRequests {
			t.Fatalf("locked out at attempt %d by validation errors alone", i+1)
		}
	}
}

// The attack this exists to stop: login ids are short and sequential, so an
// attacker can walk the id space. The per-IP limiter does not cover a
// distributed sweep against one account.
func TestLimiterBlocksAfterRepeatedFailures(t *testing.T) {
	l := NewLoginLimiter()
	body := `{"login_id":"sunny-1042","password":"wrong"}`

	for i := 0; i < maxFailures; i++ {
		if code := attempt(t, l, body, http.StatusUnauthorized); code != http.StatusUnauthorized {
			t.Fatalf("attempt %d: code = %d, want 401", i+1, code)
		}
	}
	if code := attempt(t, l, body, http.StatusUnauthorized); code != http.StatusTooManyRequests {
		t.Fatalf("code = %d, want 429 once the identifier is locked out", code)
	}
}

// Lockout is per identifier: one account under attack must not lock everyone
// else out of the nursery.
func TestLimiterIsolatesIdentifiers(t *testing.T) {
	l := NewLoginLimiter()
	victim := `{"login_id":"sunny-1042","password":"wrong"}`
	bystander := `{"login_id":"sunny-2000","password":"wrong"}`

	for i := 0; i < maxFailures+1; i++ {
		attempt(t, l, victim, http.StatusUnauthorized)
	}
	if code := attempt(t, l, bystander, http.StatusUnauthorized); code == http.StatusTooManyRequests {
		t.Fatal("an unrelated identifier must not be locked out")
	}
}

// A successful sign-in clears the counter, so someone who mistypes a few times
// and then gets it right is not penalised on their next visit.
func TestSuccessResetsFailureCount(t *testing.T) {
	l := NewLoginLimiter()
	body := `{"login_id":"sunny-1042","password":"x"}`

	for i := 0; i < maxFailures-1; i++ {
		attempt(t, l, body, http.StatusUnauthorized)
	}
	attempt(t, l, body, http.StatusOK)

	for i := 0; i < maxFailures-1; i++ {
		if code := attempt(t, l, body, http.StatusUnauthorized); code == http.StatusTooManyRequests {
			t.Fatalf("locked out at attempt %d after a successful sign-in reset", i+1)
		}
	}
}

// Email logins (the admin panel) get the same protection.
func TestLimiterCoversEmailLogins(t *testing.T) {
	l := NewLoginLimiter()
	body := `{"email":"admin@example.com","password":"wrong"}`

	for i := 0; i < maxFailures; i++ {
		attempt(t, l, body, http.StatusUnauthorized)
	}
	if code := attempt(t, l, body, http.StatusUnauthorized); code != http.StatusTooManyRequests {
		t.Fatalf("code = %d, want 429", code)
	}
}

// Identifiers are case-insensitive, so varying case must not reset the count.
func TestLimiterNormalisesIdentifierCase(t *testing.T) {
	l := NewLoginLimiter()
	for i := 0; i < maxFailures; i++ {
		attempt(t, l, `{"login_id":"Sunny-1042","password":"x"}`, http.StatusUnauthorized)
	}
	code := attempt(t, l, `{"login_id":"sunny-1042","password":"x"}`, http.StatusUnauthorized)
	if code != http.StatusTooManyRequests {
		t.Fatalf("code = %d, want 429 — case changes must not dodge the limiter", code)
	}
}

// The middleware reads the body to find the identifier; the handler must still
// be able to bind it afterwards.
func TestLimiterLeavesBodyReadable(t *testing.T) {
	l := NewLoginLimiter()
	e := echo.New()

	var seen struct {
		LoginID string `json:"login_id"`
	}
	e.POST("/auth/login", func(c echo.Context) error {
		if err := c.Bind(&seen); err != nil {
			return c.NoContent(http.StatusBadRequest)
		}
		return c.NoContent(http.StatusOK)
	}, l.Middleware())

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/auth/login",
		strings.NewReader(`{"login_id":"sunny-7","password":"secret12"}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d, want 200 — the handler could not read the body", rec.Code)
	}
	if seen.LoginID != "sunny-7" {
		t.Fatalf("handler saw login_id = %q, want sunny-7", seen.LoginID)
	}
}

// A malformed or identifier-less body must pass through rather than 500.
func TestLimiterIgnoresBodiesWithoutAnIdentifier(t *testing.T) {
	l := NewLoginLimiter()
	for _, body := range []string{`{}`, `not json`, `{"password":"x"}`} {
		if code := attempt(t, l, body, http.StatusUnauthorized); code != http.StatusUnauthorized {
			t.Fatalf("body %q: code = %d, want the handler's own 401", body, code)
		}
	}
}
