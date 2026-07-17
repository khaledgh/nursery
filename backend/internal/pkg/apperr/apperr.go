// Package apperr defines the application error type carried from services up
// to the HTTP layer. Handlers translate it to a response; internal details of
// unexpected errors are never leaked to clients.
package apperr

import (
	"errors"
	"fmt"
	"net/http"
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
	case CodeConflict:
		return http.StatusConflict
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
	return &Error{Code: CodeValidation, Message: "validation failed", Fields: fields}
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
