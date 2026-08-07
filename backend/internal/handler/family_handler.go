package handler

import (
	"github.com/labstack/echo/v4"

	"github.com/sunnystars/backend/internal/dto"
	mw "github.com/sunnystars/backend/internal/middleware"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/response"
	"github.com/sunnystars/backend/internal/service"
)

type FamilyHandler struct {
	families *service.FamilyService
}

func NewFamilyHandler(families *service.FamilyService) *FamilyHandler {
	return &FamilyHandler{families: families}
}

func (h *FamilyHandler) Register(protected *echo.Group) {
	admin := protected.Group("/admin", mw.RequireRole(model.RoleAdmin))
	admin.POST("/families", h.CreateFamily)
	admin.GET("/parents/:id", h.GetParent)
}

// CreateFamily replaces the old three-modal, two-page sequence with one call.
func (h *FamilyHandler) CreateFamily(c echo.Context) error {
	req, err := dto.Bind[dto.CreateFamilyRequest](c)
	if err != nil {
		return err
	}
	out, err := h.families.CreateFamily(c.Request().Context(), req, mw.AuditActor(c), c.RealIP())
	if err != nil {
		return err
	}
	return response.Created(c, out)
}

// GetParent returns a parent with their children and payment summary.
func (h *FamilyHandler) GetParent(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	detail, err := h.families.GetParent(c.Request().Context(), id)
	if err != nil {
		return err
	}
	return response.OK(c, detail)
}
