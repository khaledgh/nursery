package handler

import (
	"github.com/labstack/echo/v4"

	"github.com/sunnystars/backend/internal/dto"
	mw "github.com/sunnystars/backend/internal/middleware"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/response"
	"github.com/sunnystars/backend/internal/service"
)

type NurseryProfileHandler struct {
	svc *service.NurseryProfileService
}

func NewNurseryProfileHandler(svc *service.NurseryProfileService) *NurseryProfileHandler {
	return &NurseryProfileHandler{svc: svc}
}

// Register mounts the nursery admin's own profile (name, logo, currency, watermark).
func (h *NurseryProfileHandler) Register(protected *echo.Group) {
	g := protected.Group("/admin", mw.RequireRole(model.RoleAdmin))
	g.GET("/nursery-profile", h.Get)
	g.PUT("/nursery-profile", h.Update)
}

func (h *NurseryProfileHandler) Get(c echo.Context) error {
	p, err := h.svc.Get(c.Request().Context())
	if err != nil {
		return err
	}
	return response.OK(c, p)
}

func (h *NurseryProfileHandler) Update(c echo.Context) error {
	req, err := dto.Bind[service.UpdateNurseryProfileRequest](c)
	if err != nil {
		return err
	}
	p, err := h.svc.Update(c.Request().Context(), req, mw.AuditActor(c), c.RealIP())
	if err != nil {
		return err
	}
	return response.OK(c, p)
}
