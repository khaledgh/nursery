package handler

import (
	"github.com/labstack/echo/v4"

	"github.com/sunnystars/backend/internal/dto"
	mw "github.com/sunnystars/backend/internal/middleware"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/response"
	"github.com/sunnystars/backend/internal/service"
)

type DevelopmentHandler struct {
	dev *service.DevelopmentService
}

func NewDevelopmentHandler(dev *service.DevelopmentService) *DevelopmentHandler {
	return &DevelopmentHandler{dev: dev}
}

func (h *DevelopmentHandler) Register(protected *echo.Group) {
	protected.GET("/milestone-categories", h.ListCategories)
	protected.GET("/achievement-templates", h.ListTemplates)
	protected.GET("/children/:id/milestones", h.ListMilestones)
	protected.GET("/children/:id/achievements", h.ListAchievements)
	protected.GET("/children/:id/reports", h.ListReports)

	staff := protected.Group("", mw.RequireRole(model.RoleTeacher, model.RoleAdmin))
	staff.PUT("/children/:id/milestones", h.Assess)
	staff.POST("/children/:id/achievements", h.Award)
	staff.PUT("/children/:id/reports", h.UpsertReport)

	admin := protected.Group("/admin", mw.RequireRole(model.RoleAdmin))
	admin.POST("/milestone-categories", h.CreateCategory)
	admin.PUT("/milestone-categories/:id", h.UpdateCategory)
	admin.DELETE("/milestone-categories/:id", h.DeleteCategory)
	admin.POST("/achievement-templates", h.CreateTemplate)
}

func (h *DevelopmentHandler) ListCategories(c echo.Context) error {
	cats, err := h.dev.ListCategories(c.Request().Context())
	if err != nil {
		return err
	}
	return response.OK(c, cats)
}

func (h *DevelopmentHandler) CreateCategory(c echo.Context) error {
	req, err := dto.Bind[dto.UpsertMilestoneCategoryRequest](c)
	if err != nil {
		return err
	}
	cat, err := h.dev.CreateCategory(c.Request().Context(), req, mw.UserID(c), c.RealIP())
	if err != nil {
		return err
	}
	return response.Created(c, cat)
}

func (h *DevelopmentHandler) UpdateCategory(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.UpsertMilestoneCategoryRequest](c)
	if err != nil {
		return err
	}
	cat, err := h.dev.UpdateCategory(c.Request().Context(), id, req, mw.UserID(c), c.RealIP())
	if err != nil {
		return err
	}
	return response.OK(c, cat)
}

func (h *DevelopmentHandler) DeleteCategory(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	if err := h.dev.DeleteCategory(c.Request().Context(), id, mw.UserID(c), c.RealIP()); err != nil {
		return err
	}
	return response.NoContent(c)
}

func (h *DevelopmentHandler) ListTemplates(c echo.Context) error {
	ts, err := h.dev.ListAchievementTemplates(c.Request().Context())
	if err != nil {
		return err
	}
	return response.OK(c, ts)
}

func (h *DevelopmentHandler) CreateTemplate(c echo.Context) error {
	req, err := dto.Bind[dto.UpsertAchievementTemplateRequest](c)
	if err != nil {
		return err
	}
	t, err := h.dev.CreateAchievementTemplate(c.Request().Context(), req, mw.UserID(c), c.RealIP())
	if err != nil {
		return err
	}
	return response.Created(c, t)
}

func (h *DevelopmentHandler) ListMilestones(c echo.Context) error {
	childID, err := paramID(c)
	if err != nil {
		return err
	}
	ms, err := h.dev.ListMilestones(c.Request().Context(), mw.Role(c), mw.UserID(c), childID)
	if err != nil {
		return err
	}
	return response.OK(c, ms)
}

func (h *DevelopmentHandler) Assess(c echo.Context) error {
	childID, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.AssessMilestoneRequest](c)
	if err != nil {
		return err
	}
	m, err := h.dev.Assess(c.Request().Context(), mw.Role(c), mw.UserID(c), childID, req, c.RealIP())
	if err != nil {
		return err
	}
	return response.OK(c, m)
}

func (h *DevelopmentHandler) ListAchievements(c echo.Context) error {
	childID, err := paramID(c)
	if err != nil {
		return err
	}
	as, err := h.dev.ListAchievements(c.Request().Context(), mw.Role(c), mw.UserID(c), childID)
	if err != nil {
		return err
	}
	return response.OK(c, as)
}

func (h *DevelopmentHandler) Award(c echo.Context) error {
	childID, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.AwardAchievementRequest](c)
	if err != nil {
		return err
	}
	a, err := h.dev.Award(c.Request().Context(), mw.Role(c), mw.UserID(c), childID, req, c.RealIP())
	if err != nil {
		return err
	}
	return response.Created(c, a)
}

func (h *DevelopmentHandler) ListReports(c echo.Context) error {
	childID, err := paramID(c)
	if err != nil {
		return err
	}
	q, err := bindRange(c)
	if err != nil {
		return err
	}
	reports, total, err := h.dev.ListReports(c.Request().Context(), mw.Role(c), mw.UserID(c), childID, q)
	if err != nil {
		return err
	}
	return response.List(c, reports, response.Meta{Page: q.Page, PerPage: q.PerPage, Total: total})
}

func (h *DevelopmentHandler) UpsertReport(c echo.Context) error {
	childID, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.UpsertDailyReportRequest](c)
	if err != nil {
		return err
	}
	report, err := h.dev.UpsertReport(c.Request().Context(), mw.Role(c), mw.UserID(c), childID, req, c.RealIP())
	if err != nil {
		return err
	}
	return response.OK(c, report)
}
