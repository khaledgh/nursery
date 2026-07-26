package dto

import (
	"reflect"
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
	// Report the name the client actually sent. Without this, validator uses the
	// Go field name, so "date_of_birth" comes back as "DateOfBirth" and clients
	// cannot match the error to the input that produced it. Query DTOs carry
	// only a `query` tag, hence the fallback chain.
	v.RegisterTagNameFunc(func(fld reflect.StructField) string {
		for _, tag := range []string{"json", "query", "form", "param"} {
			name := strings.SplitN(fld.Tag.Get(tag), ",", 2)[0]
			if name == "-" {
				continue
			}
			if name != "" {
				return name
			}
		}
		return "" // validator falls back to the Go field name
	})
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
		// Not lowercased: RegisterTagNameFunc already yields the wire name, and
		// forcing case here would corrupt any camelCase tag.
		fields[fe.Field()] = ruleMessage(fe)
	}
	return apperr.Validation(fields)
}

func ruleMessage(fe validator.FieldError) string {
	switch fe.Tag() {
	case "required":
		return "is required"
	case "email":
		return "must be a valid email address"
	case "url":
		return "must be a valid URL"
	case "datetime":
		return "must be in the format " + humanLayout(fe.Param())
	case "min":
		return "must be " + quantity(fe, "at least")
	case "max":
		return "must be " + quantity(fe, "at most")
	case "len":
		return "must be exactly " + quantity(fe, "")
	case "gt":
		return "must be greater than " + fe.Param()
	case "gte":
		return "must be at least " + fe.Param()
	case "lt":
		return "must be less than " + fe.Param()
	case "lte":
		return "must be at most " + fe.Param()
	case "oneof":
		return "must be one of: " + strings.ReplaceAll(fe.Param(), " ", ", ")
	case "eqfield":
		return "must match " + fe.Param()
	default:
		return "is invalid"
	}
}

// quantity words a size limit for the field's kind: "8 characters" for strings,
// "2 items" for collections, bare numbers otherwise.
func quantity(fe validator.FieldError, prefix string) string {
	unit := ""
	switch fe.Kind() {
	case reflect.String:
		unit = " characters"
	case reflect.Slice, reflect.Array, reflect.Map:
		unit = " items"
	}
	if prefix == "" {
		return fe.Param() + unit
	}
	return prefix + " " + fe.Param() + unit
}

// humanLayout renders a Go time layout the way a user would type it, since
// "2006-01-02" is meaningless to anyone outside the Go ecosystem.
func humanLayout(layout string) string {
	r := strings.NewReplacer(
		"2006", "YYYY", "01", "MM", "02", "DD",
		"15", "HH", "04", "MM", "05", "SS",
		"Z07:00", "Z",
	)
	return r.Replace(layout)
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
