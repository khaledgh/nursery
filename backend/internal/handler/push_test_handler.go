package handler

import (
	"github.com/labstack/echo/v4"

	"github.com/sunnystars/backend/internal/dto"
	mw "github.com/sunnystars/backend/internal/middleware"
	"github.com/sunnystars/backend/internal/pkg/response"
	"github.com/sunnystars/backend/internal/service"
)

// PushTestHandler lets the superadmin send a diagnostic push to one user and
// see OneSignal's raw answer (recipients, errors) — the fastest way to tell a
// device-registration problem from an APNs/FCM configuration problem.
type PushTestHandler struct {
	notifications *service.NotificationService
}

func NewPushTestHandler(n *service.NotificationService) *PushTestHandler {
	return &PushTestHandler{notifications: n}
}

func (h *PushTestHandler) Register(protected *echo.Group) {
	protected.Group("/superadmin", mw.RequireSuperAdmin()).POST("/push/test", h.Send)
}

type pushTestRequest struct {
	UserID uint64 `json:"user_id" validate:"required"`
}

func (h *PushTestHandler) Send(c echo.Context) error {
	req, err := dto.Bind[pushTestRequest](c)
	if err != nil {
		return err
	}
	res, err := h.notifications.TestPush(c.Request().Context(), req.UserID)
	if err != nil {
		return err
	}
	return response.OK(c, res)
}
