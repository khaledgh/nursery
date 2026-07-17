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

// PlatformHandler exposes Phase 6 platform management: locales, dynamic
// translations (UI + content), settings, audit logs.
type PlatformHandler struct {
	translations *service.TranslationService
	settings     *service.SettingsService
	localeAdmin  *service.LocaleAdminService
	locales      *service.LocaleService
}

func NewPlatformHandler(translations *service.TranslationService, settings *service.SettingsService, localeAdmin *service.LocaleAdminService, locales *service.LocaleService) *PlatformHandler {
	return &PlatformHandler{translations: translations, settings: settings, localeAdmin: localeAdmin, locales: locales}
}

// RegisterPublic wires unauthenticated reads (i18n bundles for app boot).
func (h *PlatformHandler) RegisterPublic(api *echo.Group) {
	api.GET("/i18n/:locale", h.UIBundle)
}

func (h *PlatformHandler) Register(protected *echo.Group) {
	admin := protected.Group("/admin", mw.RequireRole(model.RoleAdmin))
	admin.PUT("/locales", h.UpsertLocale)
	admin.DELETE("/locales/:code", h.DeleteLocale)
	admin.GET("/translations/ui", h.ListUITranslations)
	admin.PUT("/translations/ui", h.UpsertUITranslation)
	admin.DELETE("/translations/ui/:id", h.DeleteUITranslation)
	admin.GET("/translations/content", h.ListContentTranslations)
	admin.PUT("/translations/content", h.UpsertContentTranslation)
	admin.GET("/settings", h.GetSettings)
	admin.PUT("/settings", h.UpdateSettings)
	admin.GET("/audit-logs", h.AuditLogs)
}

func (h *PlatformHandler) UIBundle(c echo.Context) error {
	locale := c.Param("locale")
	if !h.locales.IsActive(locale) {
		return apperr.NotFound("locale not found")
	}
	bundle, err := h.translations.UIBundle(c.Request().Context(), locale)
	if err != nil {
		return err
	}
	return response.OK(c, bundle)
}

func (h *PlatformHandler) UpsertLocale(c echo.Context) error {
	req, err := dto.Bind[dto.UpsertLocaleRequest](c)
	if err != nil {
		return err
	}
	loc := &model.Locale{
		Code:       req.Code,
		Name:       req.Name,
		NativeName: req.NativeName,
		Direction:  req.Direction,
		IsActive:   req.IsActive,
		IsDefault:  req.IsDefault,
		SortOrder:  req.SortOrder,
	}
	if err := h.localeAdmin.Upsert(c.Request().Context(), loc, mw.UserID(c), c.RealIP()); err != nil {
		return err
	}
	return response.OK(c, loc)
}

func (h *PlatformHandler) DeleteLocale(c echo.Context) error {
	code := c.Param("code")
	if code == "" {
		return apperr.BadRequest("invalid locale code")
	}
	if err := h.localeAdmin.Delete(c.Request().Context(), code, mw.UserID(c), c.RealIP()); err != nil {
		return err
	}
	return response.NoContent(c)
}

func (h *PlatformHandler) ListUITranslations(c echo.Context) error {
	rows, err := h.translations.ListUI(c.Request().Context(), c.QueryParam("locale"), c.QueryParam("namespace"))
	if err != nil {
		return err
	}
	return response.OK(c, rows)
}

func (h *PlatformHandler) UpsertUITranslation(c echo.Context) error {
	req, err := dto.Bind[dto.UpsertUITranslationRequest](c)
	if err != nil {
		return err
	}
	ns := req.Namespace
	if ns == "" {
		ns = "common"
	}
	if err := h.translations.UpsertUI(c.Request().Context(), req.Locale, ns, req.Key, req.Value); err != nil {
		return err
	}
	return response.NoContent(c)
}

func (h *PlatformHandler) DeleteUITranslation(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	if err := h.translations.DeleteUI(c.Request().Context(), id); err != nil {
		return err
	}
	return response.NoContent(c)
}

func (h *PlatformHandler) ListContentTranslations(c echo.Context) error {
	entity := c.QueryParam("entity")
	if entity == "" {
		return apperr.BadRequest("query parameter 'entity' is required")
	}
	entityID, _ := strconv.ParseUint(c.QueryParam("entity_id"), 10, 64)
	rows, err := h.translations.ListContent(c.Request().Context(), entity, entityID)
	if err != nil {
		return err
	}
	return response.OK(c, rows)
}

func (h *PlatformHandler) UpsertContentTranslation(c echo.Context) error {
	req, err := dto.Bind[dto.UpsertContentTranslationRequest](c)
	if err != nil {
		return err
	}
	if err := h.translations.UpsertContent(c.Request().Context(), req.EntityType, req.EntityID, req.Locale, req.Field, req.Value); err != nil {
		return err
	}
	return response.NoContent(c)
}

func (h *PlatformHandler) GetSettings(c echo.Context) error {
	settings, err := h.settings.All(c.Request().Context())
	if err != nil {
		return err
	}
	return response.OK(c, settings)
}

func (h *PlatformHandler) UpdateSettings(c echo.Context) error {
	var updates map[string]any
	if err := c.Bind(&updates); err != nil || len(updates) == 0 {
		return apperr.BadRequest("request body must be a non-empty JSON object of settings")
	}
	if err := h.settings.Update(c.Request().Context(), updates, mw.UserID(c), c.RealIP()); err != nil {
		return err
	}
	return response.NoContent(c)
}

func (h *PlatformHandler) AuditLogs(c echo.Context) error {
	var q service.AuditQuery
	if err := c.Bind(&q); err != nil {
		return apperr.BadRequest("invalid query parameters")
	}
	q.Normalize()
	logs, total, err := h.settings.AuditLogs(c.Request().Context(), q)
	if err != nil {
		return err
	}
	return response.List(c, logs, response.Meta{Page: q.Page, PerPage: q.PerPage, Total: total})
}
