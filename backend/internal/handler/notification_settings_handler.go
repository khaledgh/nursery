package handler

import (
	"net/http"

	"github.com/labstack/echo/v4"

	mw "github.com/sunnystars/backend/internal/middleware"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/service"
)

type NotificationSettingsHandler struct {
	notifService *service.NotificationService
}

func NewNotificationSettingsHandler(notifService *service.NotificationService) *NotificationSettingsHandler {
	return &NotificationSettingsHandler{notifService: notifService}
}

func (h *NotificationSettingsHandler) RegisterRoutes(g *echo.Group) {
	g.GET("/notification-settings", h.GetSettings)
	g.PUT("/notification-settings", h.UpdateSettings)
}

func (h *NotificationSettingsHandler) GetSettings(c echo.Context) error {
	userID := mw.UserID(c)
	if userID == 0 {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}

	setting, err := h.notifService.GetUserSettings(c.Request().Context(), userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]any{"data": setting})
}

type updateNotifSettingReq struct {
	PushEnabled          bool `json:"push_enabled"`
	MessagesEnabled      bool `json:"messages_enabled"`
	AnnouncementsEnabled bool `json:"announcements_enabled"`
	RemindersEnabled     bool `json:"reminders_enabled"`
	EventsEnabled        bool `json:"events_enabled"`
}

func (h *NotificationSettingsHandler) UpdateSettings(c echo.Context) error {
	userID := mw.UserID(c)
	if userID == 0 {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}

	var req updateNotifSettingReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	setting := &model.UserNotificationSetting{
		UserID:               userID,
		PushEnabled:          req.PushEnabled,
		MessagesEnabled:      req.MessagesEnabled,
		AnnouncementsEnabled: req.AnnouncementsEnabled,
		RemindersEnabled:     req.RemindersEnabled,
		EventsEnabled:        req.EventsEnabled,
	}

	if err := h.notifService.UpdateUserSettings(c.Request().Context(), setting); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]any{"data": setting})
}
