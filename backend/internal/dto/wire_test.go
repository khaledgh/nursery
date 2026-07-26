package dto

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"

	"github.com/sunnystars/backend/internal/pkg/apperr"
	"github.com/sunnystars/backend/internal/pkg/response"
)

type loginBody struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
}

func errorRoute(e *echo.Echo, path string, run func(echo.Context) error) {
	e.POST(path, func(c echo.Context) error {
		if err := run(c); err != nil {
			ae := apperr.From(err)
			return response.Err(c, ae.HTTPStatus(), string(ae.Code), ae.Message, ae.Fields)
		}
		return c.NoContent(http.StatusOK)
	})
}

type wireError struct {
	Error struct {
		Code    string            `json:"code"`
		Message string            `json:"message"`
		Fields  map[string]string `json:"fields"`
	} `json:"error"`
}

func postJSON(t *testing.T, e *echo.Echo, path, body string) (int, wireError) {
	t.Helper()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	e.ServeHTTP(rec, req)

	var got wireError
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode %s: %v", rec.Body, err)
	}
	return rec.Code, got
}

// The point of the whole change: what the client receives must name the field
// it sent and say why that field failed.
func TestValidationReachesClientWithFieldNames(t *testing.T) {
	e := echo.New()
	e.Validator = NewValidator()
	errorRoute(e, "/login", func(c echo.Context) error {
		_, err := Bind[loginBody](c)
		return err
	})

	status, got := postJSON(t, e, "/login", `{"email":"nope","password":"x"}`)

	if status != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", status)
	}
	if got.Error.Code != "validation_failed" {
		t.Errorf("code = %q, want validation_failed", got.Error.Code)
	}
	if want := "must be a valid email address"; got.Error.Fields["email"] != want {
		t.Errorf("fields.email = %q, want %q", got.Error.Fields["email"], want)
	}
	if want := "must be at least 8 characters"; got.Error.Fields["password"] != want {
		t.Errorf("fields.password = %q, want %q", got.Error.Fields["password"], want)
	}
	// Clients that read only message must no longer get the bare placeholder.
	if got.Error.Message == "validation failed" {
		t.Error("message is still the generic placeholder")
	}
}

func TestConflictFieldReachesClient(t *testing.T) {
	e := echo.New()
	errorRoute(e, "/users", func(echo.Context) error {
		return apperr.ConflictField("email", "is already in use")
	})

	status, got := postJSON(t, e, "/users", `{}`)

	if status != http.StatusConflict {
		t.Fatalf("status = %d, want 409", status)
	}
	if want := "is already in use"; got.Error.Fields["email"] != want {
		t.Errorf("fields.email = %q, want %q", got.Error.Fields["email"], want)
	}
}
