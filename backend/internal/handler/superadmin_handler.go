package handler

import (
	"github.com/labstack/echo/v4"

	"github.com/sunnystars/backend/internal/dto"
	mw "github.com/sunnystars/backend/internal/middleware"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
	"github.com/sunnystars/backend/internal/pkg/response"
	"github.com/sunnystars/backend/internal/service"
)

type SuperAdminHandler struct {
	super *service.SuperAdminService
	subs  *service.SubscriptionService
}

func NewSuperAdminHandler(super *service.SuperAdminService, subs *service.SubscriptionService) *SuperAdminHandler {
	return &SuperAdminHandler{super: super, subs: subs}
}

// Register mounts the platform console. RequireSuperAdmin admits nobody else —
// a nursery admin must never reach cross-tenant routes.
func (h *SuperAdminHandler) Register(protected *echo.Group) {
	g := protected.Group("/superadmin", mw.RequireSuperAdmin())

	g.GET("/stats", h.Stats)
	g.GET("/nurseries", h.ListNurseries)
	g.POST("/nurseries", h.CreateNursery)
	g.GET("/nurseries/:id", h.GetNursery)
	g.PUT("/nurseries/:id", h.UpdateNursery)
	g.POST("/nurseries/:id/suspend", h.Suspend)
	g.POST("/nurseries/:id/activate", h.Activate)
	g.PUT("/nurseries/:id/subscription", h.AssignSubscription)
	g.GET("/nurseries/:id/capabilities", h.GetCapabilities)
	g.PUT("/nurseries/:id/capabilities", h.SetCapabilities)
	g.POST("/nurseries/:id/impersonate", h.Impersonate)

	g.GET("/plans", h.ListPlans)
	g.POST("/plans", h.CreatePlan)
	g.PUT("/plans/:id", h.UpdatePlan)

	g.GET("/subscription-invoices", h.ListInvoices)
	g.POST("/subscription-invoices/generate", h.GenerateInvoices)
	g.POST("/subscription-invoices/:id/mark-paid", h.MarkInvoicePaid)
}

func (h *SuperAdminHandler) Stats(c echo.Context) error {
	stats, err := h.super.Stats(c.Request().Context())
	if err != nil {
		return err
	}
	return response.OK(c, stats)
}

func (h *SuperAdminHandler) ListNurseries(c echo.Context) error {
	var q dto.PageQuery
	if err := c.Bind(&q); err != nil {
		return apperr.BadRequest("invalid query parameters")
	}
	q.Normalize()
	rows, total, err := h.super.ListNurseries(c.Request().Context(), q)
	if err != nil {
		return err
	}
	return response.List(c, rows, response.Meta{Page: q.Page, PerPage: q.PerPage, Total: total})
}

func (h *SuperAdminHandler) GetNursery(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	n, err := h.super.GetNursery(c.Request().Context(), id)
	if err != nil {
		return err
	}
	return response.OK(c, n)
}

func (h *SuperAdminHandler) CreateNursery(c echo.Context) error {
	req, err := dto.Bind[dto.CreateNurseryRequest](c)
	if err != nil {
		return err
	}
	n, err := h.super.CreateNursery(c.Request().Context(), req, mw.AuditActor(c), c.RealIP())
	if err != nil {
		return err
	}
	return response.Created(c, n)
}

func (h *SuperAdminHandler) UpdateNursery(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.UpdateNurseryRequest](c)
	if err != nil {
		return err
	}
	n, err := h.super.UpdateNursery(c.Request().Context(), id, req, mw.AuditActor(c), c.RealIP())
	if err != nil {
		return err
	}
	return response.OK(c, n)
}

func (h *SuperAdminHandler) Suspend(c echo.Context) error {
	return h.setStatus(c, model.NurserySuspended)
}

func (h *SuperAdminHandler) Activate(c echo.Context) error {
	return h.setStatus(c, model.NurseryActive)
}

func (h *SuperAdminHandler) setStatus(c echo.Context, status model.NurseryStatus) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	if err := h.super.SetNurseryStatus(c.Request().Context(), id, status, mw.AuditActor(c), c.RealIP()); err != nil {
		return err
	}
	return response.NoContent(c)
}

func (h *SuperAdminHandler) AssignSubscription(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.AssignSubscriptionRequest](c)
	if err != nil {
		return err
	}
	sub, err := h.super.AssignSubscription(c.Request().Context(), id, req, mw.AuditActor(c), c.RealIP())
	if err != nil {
		return err
	}
	return response.OK(c, sub)
}

func (h *SuperAdminHandler) GetCapabilities(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	caps, err := h.subs.Capabilities(c.Request().Context(), id)
	if err != nil {
		return err
	}
	return response.OK(c, map[string]any{"capabilities": caps, "all": model.AllCapabilities})
}

func (h *SuperAdminHandler) SetCapabilities(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.UpdateCapabilitiesRequest](c)
	if err != nil {
		return err
	}
	if err := h.super.SetCapabilities(c.Request().Context(), id, req, mw.AuditActor(c), c.RealIP()); err != nil {
		return err
	}
	return response.NoContent(c)
}

// Impersonate returns a short-lived, nursery-scoped token. Actions taken with
// it stay attributed to the superadmin in the audit log.
func (h *SuperAdminHandler) Impersonate(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	tokens, err := h.super.Impersonate(c.Request().Context(), id, mw.UserID(c), c.RealIP())
	if err != nil {
		return err
	}
	return response.OK(c, tokens)
}

func (h *SuperAdminHandler) ListPlans(c echo.Context) error {
	plans, err := h.super.ListPlans(c.Request().Context())
	if err != nil {
		return err
	}
	return response.OK(c, plans)
}

func (h *SuperAdminHandler) CreatePlan(c echo.Context) error {
	return h.savePlan(c, 0)
}

func (h *SuperAdminHandler) UpdatePlan(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	return h.savePlan(c, id)
}

func (h *SuperAdminHandler) savePlan(c echo.Context, id uint64) error {
	req, err := dto.Bind[dto.PlanRequest](c)
	if err != nil {
		return err
	}
	plan, err := h.super.SavePlan(c.Request().Context(), id, req, mw.AuditActor(c), c.RealIP())
	if err != nil {
		return err
	}
	return response.OK(c, plan)
}

func (h *SuperAdminHandler) ListInvoices(c echo.Context) error {
	var q dto.PageQuery
	if err := c.Bind(&q); err != nil {
		return apperr.BadRequest("invalid query parameters")
	}
	q.Normalize()
	invoices, total, err := h.super.ListSubscriptionInvoices(c.Request().Context(), q, c.QueryParam("status"))
	if err != nil {
		return err
	}
	return response.List(c, invoices, response.Meta{Page: q.Page, PerPage: q.PerPage, Total: total})
}

func (h *SuperAdminHandler) GenerateInvoices(c echo.Context) error {
	n, err := h.super.GenerateSubscriptionInvoices(c.Request().Context(), mw.AuditActor(c), c.RealIP())
	if err != nil {
		return err
	}
	return response.OK(c, map[string]int{"created": n})
}

func (h *SuperAdminHandler) MarkInvoicePaid(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	if err := h.super.MarkInvoicePaid(c.Request().Context(), id, mw.AuditActor(c), c.RealIP()); err != nil {
		return err
	}
	return response.NoContent(c)
}
