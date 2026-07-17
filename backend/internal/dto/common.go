package dto

import (
	"strings"

	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"

	"github.com/sunnystars/backend/internal/pkg/apperr"
)

// Validator adapts go-playground/validator to echo.Validator and converts
// failures into client-safe per-field messages.
type Validator struct {
	v *validator.Validate
}

func NewValidator() *Validator {
	v := validator.New(validator.WithRequiredStructEnabled())
	return &Validator{v: v}
}

func (cv *Validator) Validate(i any) error {
	err := cv.v.Struct(i)
	if err == nil {
		return nil
	}
	verrs, ok := err.(validator.ValidationErrors)
	if !ok {
		return apperr.BadRequest("invalid request body")
	}
	fields := make(map[string]string, len(verrs))
	for _, fe := range verrs {
		fields[strings.ToLower(fe.Field())] = ruleMessage(fe)
	}
	return apperr.Validation(fields)
}

func ruleMessage(fe validator.FieldError) string {
	switch fe.Tag() {
	case "required":
		return "is required"
	case "email":
		return "must be a valid email address"
	case "min":
		return "must be at least " + fe.Param() + " characters"
	case "max":
		return "must be at most " + fe.Param() + " characters"
	case "oneof":
		return "must be one of: " + fe.Param()
	default:
		return "is invalid"
	}
}

// Bind binds and validates a request body in one step.
func Bind[T any](c echo.Context) (*T, error) {
	req := new(T)
	if err := c.Bind(req); err != nil {
		return nil, apperr.BadRequest("malformed request body")
	}
	if err := c.Validate(req); err != nil {
		return nil, err
	}
	return req, nil
}

// PageQuery is the standard ?page=&per_page=&search=&sort= contract.
type PageQuery struct {
	Page    int    `query:"page"`
	PerPage int    `query:"per_page"`
	Search  string `query:"search"`
	Sort    string `query:"sort"`
}

func (p *PageQuery) Normalize() {
	if p.Page < 1 {
		p.Page = 1
	}
	if p.PerPage < 1 {
		p.PerPage = 20
	}
	if p.PerPage > 100 {
		p.PerPage = 100
	}
}

func (p *PageQuery) Offset() int { return (p.Page - 1) * p.PerPage }
