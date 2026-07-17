// Package response provides the consistent { data, meta } / { error } envelope
// used by every endpoint.
package response

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

type Meta struct {
	Page    int   `json:"page"`
	PerPage int   `json:"per_page"`
	Total   int64 `json:"total"`
}

type envelope struct {
	Data any   `json:"data"`
	Meta *Meta `json:"meta,omitempty"`
}

type errorBody struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Fields  map[string]string `json:"fields,omitempty"`
}

type errorEnvelope struct {
	Error errorBody `json:"error"`
}

func OK(c echo.Context, data any) error {
	return c.JSON(http.StatusOK, envelope{Data: data})
}

func Created(c echo.Context, data any) error {
	return c.JSON(http.StatusCreated, envelope{Data: data})
}

func NoContent(c echo.Context) error {
	return c.NoContent(http.StatusNoContent)
}

func List(c echo.Context, data any, meta Meta) error {
	return c.JSON(http.StatusOK, envelope{Data: data, Meta: &meta})
}

func Err(c echo.Context, status int, code, message string, fields map[string]string) error {
	return c.JSON(status, errorEnvelope{Error: errorBody{Code: code, Message: message, Fields: fields}})
}
