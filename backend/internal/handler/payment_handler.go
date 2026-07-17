package handler

import (
	"io"

	"github.com/labstack/echo/v4"

	"github.com/sunnystars/backend/internal/dto"
	mw "github.com/sunnystars/backend/internal/middleware"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
	"github.com/sunnystars/backend/internal/pkg/response"
	"github.com/sunnystars/backend/internal/service"
)

type PaymentHandler struct {
	payments *service.PaymentService
}

func NewPaymentHandler(payments *service.PaymentService) *PaymentHandler {
	return &PaymentHandler{payments: payments}
}

// Register wires authenticated payment routes; the webhook is registered
// separately on the public group (gateway calls carry no JWT).
func (h *PaymentHandler) Register(protected *echo.Group) {
	protected.GET("/invoices", h.List)
	protected.GET("/invoices/:id", h.Get)
	protected.POST("/invoices/:id/pay", h.Pay)

	admin := protected.Group("/admin", mw.RequireRole(model.RoleAdmin))
	admin.POST("/invoices", h.Create)
	admin.POST("/invoices/:id/cancel", h.Cancel)
}

func (h *PaymentHandler) RegisterWebhook(public *echo.Group) {
	public.POST("/webhooks/swish", h.SwishWebhook)
}

func (h *PaymentHandler) List(c echo.Context) error {
	var q dto.ListInvoicesQuery
	if err := c.Bind(&q); err != nil {
		return apperr.BadRequest("invalid query parameters")
	}
	if err := c.Validate(&q); err != nil {
		return err
	}
	q.Normalize()
	invoices, total, err := h.payments.ListInvoices(c.Request().Context(), mw.Role(c), mw.UserID(c), q)
	if err != nil {
		return err
	}
	return response.List(c, invoices, response.Meta{Page: q.Page, PerPage: q.PerPage, Total: total})
}

func (h *PaymentHandler) Get(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	inv, err := h.payments.GetInvoice(c.Request().Context(), mw.Role(c), mw.UserID(c), id)
	if err != nil {
		return err
	}
	return response.OK(c, inv)
}

func (h *PaymentHandler) Create(c echo.Context) error {
	req, err := dto.Bind[dto.CreateInvoiceRequest](c)
	if err != nil {
		return err
	}
	inv, err := h.payments.CreateInvoice(c.Request().Context(), req, mw.UserID(c), c.RealIP())
	if err != nil {
		return err
	}
	return response.Created(c, inv)
}

func (h *PaymentHandler) Cancel(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	inv, err := h.payments.CancelInvoice(c.Request().Context(), id, mw.UserID(c), c.RealIP())
	if err != nil {
		return err
	}
	return response.OK(c, inv)
}

func (h *PaymentHandler) Pay(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.PayInvoiceRequest](c)
	if err != nil {
		return err
	}
	res, err := h.payments.Pay(c.Request().Context(), mw.Role(c), mw.UserID(c), id, req, c.RealIP())
	if err != nil {
		return err
	}
	return response.OK(c, res)
}

// SwishWebhook receives gateway callbacks. The body is treated as untrusted
// input: only the reference is read, then the status is re-fetched from the
// gateway before any change is applied.
func (h *PaymentHandler) SwishWebhook(c echo.Context) error {
	body, err := io.ReadAll(io.LimitReader(c.Request().Body, 64<<10))
	if err != nil {
		return apperr.BadRequest("unreadable body")
	}
	ref := service.ExtractCallbackRef(body)
	if err := h.payments.HandleCallback(c.Request().Context(), ref); err != nil {
		return err
	}
	return response.NoContent(c)
}
