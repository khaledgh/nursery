// Package apperr defines the application error type carried from services up
// to the HTTP layer. Handlers translate it to a response; internal details of
// unexpected errors are never leaked to clients.
package apperr

import (
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strconv"
)

type Code string

const (
	CodeBadRequest   Code = "bad_request"
	CodeUnauthorized Code = "unauthorized"
	CodeForbidden    Code = "forbidden"
	CodeNotFound     Code = "not_found"
	CodeConflict     Code = "conflict"
	CodeValidation   Code = "validation_failed"
	CodeRateLimited  Code = "rate_limited"
	CodeInternal     Code = "internal_error"
	// CodeSeatLimit is distinct from a plain conflict so the client can render
	// an upgrade prompt with the real numbers instead of a generic banner.
	CodeSeatLimit Code = "seat_limit_reached"
	// CodeSubscriptionInactive gates writes when billing has lapsed. Reads stay
	// open, so this never blocks access to existing records.
	CodeSubscriptionInactive Code = "subscription_inactive"
)

type Error struct {
	Code    Code
	Message string            // safe to show to the client
	Fields  map[string]string // per-field validation messages
	Err     error             // wrapped cause, logged but never serialized
}

func (e *Error) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %s: %v", e.Code, e.Message, e.Err)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func (e *Error) Unwrap() error { return e.Err }

func (e *Error) HTTPStatus() int {
	switch e.Code {
	case CodeBadRequest, CodeValidation:
		return http.StatusBadRequest
	case CodeUnauthorized:
		return http.StatusUnauthorized
	case CodeForbidden:
		return http.StatusForbidden
	case CodeNotFound:
		return http.StatusNotFound
	case CodeConflict, CodeSeatLimit:
		return http.StatusConflict
	case CodeSubscriptionInactive:
		return http.StatusPaymentRequired
	case CodeRateLimited:
		return http.StatusTooManyRequests
	default:
		return http.StatusInternalServerError
	}
}

func New(code Code, msg string) *Error { return &Error{Code: code, Message: msg} }

func BadRequest(msg string) *Error   { return New(CodeBadRequest, msg) }
func Unauthorized(msg string) *Error { return New(CodeUnauthorized, msg) }
func Forbidden(msg string) *Error    { return New(CodeForbidden, msg) }
func NotFound(msg string) *Error     { return New(CodeNotFound, msg) }
func Conflict(msg string) *Error     { return New(CodeConflict, msg) }

func Validation(fields map[string]string) *Error {
	return &Error{Code: CodeValidation, Message: validationSummary(fields), Fields: fields}
}

// validationSummary renders one readable line for clients that only display
// Message; Fields stays authoritative for per-input rendering. Keys are sorted
// because Go randomizes map iteration — without it the same request would
// return a different message each time.
func validationSummary(fields map[string]string) string {
	if len(fields) == 0 {
		return "validation failed"
	}
	keys := make([]string, 0, len(fields))
	for k := range fields {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	first := keys[0] + " " + fields[keys[0]]
	if len(keys) == 1 {
		return first
	}
	return fmt.Sprintf("%s (and %d more)", first, len(keys)-1)
}

// ConflictField reports a conflict caused by one request field, so clients can
// render it under that input instead of in a page-level banner.
func ConflictField(field, msg string) *Error {
	return &Error{
		Code:    CodeConflict,
		Message: field + " " + msg,
		Fields:  map[string]string{field: msg},
	}
}

// SeatLimit reports that the nursery has used every place its plan allows.
// The counts travel in Fields so the UI can offer a concrete next step —
// remove someone, or upgrade — rather than a bare refusal.
func SeatLimit(kind string, used, max int) *Error {
	return &Error{
		Code: CodeSeatLimit,
		Message: fmt.Sprintf(
			"%d of %d %s places used. Remove one or upgrade the plan to add more.",
			used, max, kind),
		Fields: map[string]string{
			"used": strconv.Itoa(used),
			"max":  strconv.Itoa(max),
			"kind": kind,
		},
	}
}

// SubscriptionInactive blocks writes for a lapsed subscription. Reads are
// deliberately unaffected.
func SubscriptionInactive(msg string) *Error {
	return New(CodeSubscriptionInactive, msg)
}

// Internal wraps an unexpected error with a generic client-safe message.
func Internal(err error) *Error {
	return &Error{Code: CodeInternal, Message: "something went wrong", Err: err}
}

// From extracts an *Error, or wraps unknown errors as internal.
func From(err error) *Error {
	var ae *Error
	if errors.As(err, &ae) {
		return ae
	}
	return Internal(err)
}
