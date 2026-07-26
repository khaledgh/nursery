package dto

import (
	"errors"
	"testing"

	"github.com/sunnystars/backend/internal/pkg/apperr"
)

// fieldsFor validates v and returns the per-field messages.
func fieldsFor(t *testing.T, v any) map[string]string {
	t.Helper()
	err := NewValidator().Validate(v)
	if err == nil {
		t.Fatal("expected validation to fail")
	}
	var ae *apperr.Error
	if !errors.As(err, &ae) {
		t.Fatalf("expected *apperr.Error, got %T", err)
	}
	return ae.Fields
}

// Clients match errors to inputs by name, so keys must be the name that was
// sent over the wire — not the Go field name.
func TestValidateUsesJSONTagNames(t *testing.T) {
	type body struct {
		FirstName string  `json:"first_name" validate:"required"`
		AvatarID  *uint64 `json:"avatar_id" validate:"required"`
	}
	fields := fieldsFor(t, &body{})

	for _, key := range []string{"first_name", "avatar_id"} {
		if _, ok := fields[key]; !ok {
			t.Errorf("missing key %q; got %v", key, fields)
		}
	}
	for _, stale := range []string{"firstname", "FirstName", "avatarid"} {
		if _, ok := fields[stale]; ok {
			t.Errorf("Go field name %q leaked into the response", stale)
		}
	}
}

// Query DTOs carry only a `query` tag; a json-only lookup would fall back to
// the Go name and produce "PerPage".
func TestValidateUsesQueryTagNames(t *testing.T) {
	type query struct {
		PerPage int    `query:"per_page" validate:"min=1"`
		Role    string `query:"role" validate:"oneof=admin teacher parent"`
	}
	fields := fieldsFor(t, &query{PerPage: 0, Role: "wizard"})

	if _, ok := fields["per_page"]; !ok {
		t.Errorf("expected key per_page, got %v", fields)
	}
	if _, ok := fields["PerPage"]; ok {
		t.Error("Go field name PerPage leaked into the response")
	}
}

// datetime previously fell through to "is invalid", which told the user
// nothing about the expected format.
func TestDatetimeMessageShowsFormat(t *testing.T) {
	type body struct {
		DOB string `json:"dob" validate:"required,datetime=2006-01-02"`
	}
	fields := fieldsFor(t, &body{DOB: "not-a-date"})

	if got, want := fields["dob"], "must be in the format YYYY-MM-DD"; got != want {
		t.Errorf("dob message = %q, want %q", got, want)
	}
}

// "at least 8 characters" is wrong for a number or a list.
func TestQuantityMessageMatchesKind(t *testing.T) {
	type body struct {
		Password string   `json:"password" validate:"min=8"`
		Capacity int      `json:"capacity" validate:"min=1"`
		Tags     []string `json:"tags" validate:"min=2"`
	}
	fields := fieldsFor(t, &body{Password: "x", Capacity: 0, Tags: []string{"a"}})

	for field, want := range map[string]string{
		"password": "must be at least 8 characters",
		"capacity": "must be at least 1",
		"tags":     "must be at least 2 items",
	} {
		if got := fields[field]; got != want {
			t.Errorf("%s message = %q, want %q", field, got, want)
		}
	}
}

func TestOneOfMessageIsReadable(t *testing.T) {
	type body struct {
		Role string `json:"role" validate:"oneof=admin teacher parent"`
	}
	fields := fieldsFor(t, &body{Role: "wizard"})

	if got, want := fields["role"], "must be one of: admin, teacher, parent"; got != want {
		t.Errorf("role message = %q, want %q", got, want)
	}
}

// Go randomizes map iteration, so an unsorted summary would return a different
// message for the same request on every call.
func TestValidationSummaryIsDeterministic(t *testing.T) {
	type body struct {
		Alpha string `json:"alpha" validate:"required"`
		Bravo string `json:"bravo" validate:"required"`
		Delta string `json:"delta" validate:"required"`
		Echo  string `json:"echo" validate:"required"`
	}
	v := NewValidator()

	var first string
	for i := 0; i < 50; i++ {
		var ae *apperr.Error
		if !errors.As(v.Validate(&body{}), &ae) {
			t.Fatal("expected *apperr.Error")
		}
		if i == 0 {
			first = ae.Message
			continue
		}
		if ae.Message != first {
			t.Fatalf("summary flapped between %q and %q", first, ae.Message)
		}
	}
	if want := "alpha is required (and 3 more)"; first != want {
		t.Errorf("summary = %q, want %q", first, want)
	}
}

// A single failure reads as a whole sentence, with no "(and N more)" tail.
func TestValidationSummarySingleField(t *testing.T) {
	type body struct {
		Email string `json:"email" validate:"required,email"`
	}
	v := NewValidator()

	var ae *apperr.Error
	if !errors.As(v.Validate(&body{Email: "nope"}), &ae) {
		t.Fatal("expected *apperr.Error")
	}
	if want := "email must be a valid email address"; ae.Message != want {
		t.Errorf("summary = %q, want %q", ae.Message, want)
	}
}

// Message stays a standalone sentence while Fields carries the fragment that
// renders under the input.
func TestConflictFieldCarriesBothForms(t *testing.T) {
	err := apperr.ConflictField("email", "is already in use")

	if want := "email is already in use"; err.Message != want {
		t.Errorf("message = %q, want %q", err.Message, want)
	}
	if want := "is already in use"; err.Fields["email"] != want {
		t.Errorf("field message = %q, want %q", err.Fields["email"], want)
	}
	if err.HTTPStatus() != 409 {
		t.Errorf("status = %d, want 409", err.HTTPStatus())
	}
}
