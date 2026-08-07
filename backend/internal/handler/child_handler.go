package handler

import (
	"strconv"

	"github.com/labstack/echo/v4"

	"github.com/sunnystars/backend/internal/dto"
	mw "github.com/sunnystars/backend/internal/middleware"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
	"github.com/sunnystars/backend/internal/pkg/response"
	"github.com/sunnystars/backend/internal/service"
)

type ChildHandler struct {
	children *service.ChildService
}

func NewChildHandler(children *service.ChildService) *ChildHandler {
	return &ChildHandler{children: children}
}

func (h *ChildHandler) Register(protected *echo.Group) {
	protected.GET("/children", h.List)
	protected.GET("/children/:id", h.Get)
	protected.GET("/children/:id/media", h.ListMedia)

	admin := protected.Group("/admin", mw.RequireRole(model.RoleAdmin))
	admin.POST("/children", h.Create)
	// Static path first: /children/deleted must not be captured by /children/:id.
	admin.GET("/children/deleted", h.ListDeleted)
	admin.PUT("/children/:id", h.Update)
	admin.DELETE("/children/:id", h.Delete)
	admin.POST("/children/:id/restore", h.Restore)
	admin.DELETE("/children/:id/purge", h.Purge)
	admin.POST("/children/:id/guardians", h.AddGuardian)
	admin.DELETE("/children/:id/guardians/:parentId", h.RemoveGuardian)
}

// List returns children scoped to the caller: parents see their own,
// teachers their classrooms, admins everyone.
func (h *ChildHandler) List(c echo.Context) error {
	var q dto.PageQuery
	if err := c.Bind(&q); err != nil {
		return apperr.BadRequest("invalid query parameters")
	}
	q.Normalize()
	children, total, err := h.children.List(c.Request().Context(), q, mw.Role(c), mw.UserID(c))
	if err != nil {
		return err
	}
	return response.List(c, children, response.Meta{Page: q.Page, PerPage: q.PerPage, Total: total})
}

func (h *ChildHandler) Get(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	child, err := h.children.Get(c.Request().Context(), mw.Role(c), mw.UserID(c), id)
	if err != nil {
		return err
	}
	return response.OK(c, child)
}

func (h *ChildHandler) Create(c echo.Context) error {
	req, err := dto.Bind[dto.CreateChildRequest](c)
	if err != nil {
		return err
	}
	child, err := h.children.Create(c.Request().Context(), req, mw.UserID(c), c.RealIP())
	if err != nil {
		return err
	}
	return response.Created(c, child)
}

func (h *ChildHandler) Update(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.UpdateChildRequest](c)
	if err != nil {
		return err
	}
	child, err := h.children.Update(c.Request().Context(), id, req, mw.UserID(c), c.RealIP())
	if err != nil {
		return err
	}
	return response.OK(c, child)
}

// Delete soft-deletes a child. ?force=true acknowledges the unpaid-invoice
// warning the first call returns.
func (h *ChildHandler) Delete(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	force := c.QueryParam("force") == "true"
	if err := h.children.Delete(c.Request().Context(), id, mw.AuditActor(c), c.RealIP(), force); err != nil {
		return err
	}
	return response.NoContent(c)
}

// ListDeleted backs the "recently removed" screen, where an admin can restore
// a child or free the seat permanently.
func (h *ChildHandler) ListDeleted(c echo.Context) error {
	var q dto.PageQuery
	if err := c.Bind(&q); err != nil {
		return apperr.BadRequest("invalid query parameters")
	}
	q.Normalize()
	children, total, err := h.children.ListDeleted(c.Request().Context(), q)
	if err != nil {
		return err
	}
	return response.List(c, children, response.Meta{Page: q.Page, PerPage: q.PerPage, Total: total})
}

func (h *ChildHandler) Restore(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	if err := h.children.Restore(c.Request().Context(), id, mw.AuditActor(c), c.RealIP()); err != nil {
		return err
	}
	return response.NoContent(c)
}

func (h *ChildHandler) Purge(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	if err := h.children.Purge(c.Request().Context(), id, mw.AuditActor(c), c.RealIP()); err != nil {
		return err
	}
	return response.NoContent(c)
}

func (h *ChildHandler) AddGuardian(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.AddGuardianRequest](c)
	if err != nil {
		return err
	}
	g, err := h.children.AddGuardian(c.Request().Context(), id, req, mw.UserID(c), c.RealIP())
	if err != nil {
		return err
	}
	return response.Created(c, g)
}

func (h *ChildHandler) RemoveGuardian(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	parentID, err := strconv.ParseUint(c.Param("parentId"), 10, 64)
	if err != nil || parentID == 0 {
		return apperr.BadRequest("invalid parent id")
	}
	if err := h.children.RemoveGuardian(c.Request().Context(), id, parentID, mw.UserID(c), c.RealIP()); err != nil {
		return err
	}
	return response.NoContent(c)
}

func (h *ChildHandler) ListMedia(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	var q dto.PageQuery
	if err := c.Bind(&q); err != nil {
		return apperr.BadRequest("invalid query parameters")
	}
	q.Normalize()
	media, total, err := h.children.ListMedia(c.Request().Context(), mw.Role(c), mw.UserID(c), id, q)
	if err != nil {
		return err
	}
	return response.List(c, media, response.Meta{Page: q.Page, PerPage: q.PerPage, Total: total})
}
