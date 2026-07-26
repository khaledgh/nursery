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

type EngagementHandler struct {
	eng    *service.EngagementService
	center *service.NotificationCenterService
}

func NewEngagementHandler(eng *service.EngagementService, center *service.NotificationCenterService) *EngagementHandler {
	return &EngagementHandler{eng: eng, center: center}
}

func (h *EngagementHandler) Register(protected *echo.Group) {
	// Events
	protected.GET("/events", h.ListEvents)
	protected.GET("/events/:id", h.GetEvent)
	protected.GET("/events/:id/media", h.ListEventMedia)
	protected.POST("/events/:id/rsvp", h.RSVP)
	protected.POST("/events/:id/feedback", h.Feedback)

	// Announcements
	protected.GET("/announcements", h.ListAnnouncements)
	protected.GET("/announcements/:id", h.GetAnnouncement)
	protected.POST("/announcements/:id/ack", h.Acknowledge)
	protected.POST("/announcements/:id/archive", h.Archive)
	protected.POST("/announcements/:id/unarchive", h.Unarchive)

	// Community
	protected.GET("/community/posts", h.ListPosts)
	protected.POST("/community/posts", h.CreatePost)
	protected.DELETE("/community/posts/:id", h.DeletePost)
	protected.POST("/community/posts/:id/comments", h.Comment)
	protected.DELETE("/community/comments/:id", h.DeleteComment)
	protected.POST("/community/posts/:id/like", h.ToggleLike)
	protected.POST("/meetups/:id/rsvp", h.MeetupRSVP)

	// Reminders
	protected.GET("/reminders", h.ListReminders)

	// Notification center + devices
	protected.GET("/notifications", h.ListNotifications)
	protected.GET("/notifications/unread-count", h.UnreadCount)
	protected.POST("/notifications/read-all", h.MarkAllRead)
	protected.POST("/notifications/:id/read", h.MarkRead)
	protected.POST("/devices", h.RegisterDevice)
	protected.DELETE("/devices/:playerId", h.UnregisterDevice)

	// Staff writes
	staff := protected.Group("", mw.RequireRole(model.RoleTeacher, model.RoleAdmin))
	staff.POST("/events", h.CreateEvent)
	staff.PUT("/events/:id/status", h.UpdateEventStatus)
	staff.POST("/events/:id/media", h.AddEventMedia)
	staff.POST("/announcements", h.CreateAnnouncement)
	staff.POST("/announcements/:id/publish", h.PublishAnnouncement)
	staff.POST("/reminders", h.CreateReminder)
	staff.DELETE("/reminders/:id", h.DeleteReminder)
}

// --- events ---

func (h *EngagementHandler) ListEvents(c echo.Context) error {
	var q dto.PageQuery
	if err := c.Bind(&q); err != nil {
		return apperr.BadRequest("invalid query parameters")
	}
	q.Normalize()
	events, total, err := h.eng.ListEvents(c.Request().Context(), mw.RequestLocale(c), c.QueryParam("tab"), q)
	if err != nil {
		return err
	}
	return response.List(c, events, response.Meta{Page: q.Page, PerPage: q.PerPage, Total: total})
}

func (h *EngagementHandler) GetEvent(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	ev, err := h.eng.GetEventForUser(c.Request().Context(), id, mw.RequestLocale(c), mw.UserID(c))
	if err != nil {
		return err
	}
	return response.OK(c, ev)
}

func (h *EngagementHandler) CreateEvent(c echo.Context) error {
	req, err := dto.Bind[dto.CreateEventRequest](c)
	if err != nil {
		return err
	}
	ev, err := h.eng.CreateEvent(c.Request().Context(), req, mw.UserID(c), c.RealIP())
	if err != nil {
		return err
	}
	return response.Created(c, ev)
}

func (h *EngagementHandler) UpdateEventStatus(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.UpdateEventStatusRequest](c)
	if err != nil {
		return err
	}
	ev, err := h.eng.UpdateEventStatus(c.Request().Context(), id, req.Status, mw.UserID(c), c.RealIP())
	if err != nil {
		return err
	}
	return response.OK(c, ev)
}

func (h *EngagementHandler) RSVP(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.RSVPRequest](c)
	if err != nil {
		return err
	}
	rsvp, err := h.eng.RSVP(c.Request().Context(), mw.Role(c), mw.UserID(c), id, req)
	if err != nil {
		return err
	}
	return response.OK(c, rsvp)
}

func (h *EngagementHandler) Feedback(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.EventFeedbackRequest](c)
	if err != nil {
		return err
	}
	fb, err := h.eng.EventFeedback(c.Request().Context(), mw.UserID(c), id, req)
	if err != nil {
		return err
	}
	return response.OK(c, fb)
}

func (h *EngagementHandler) ListEventMedia(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	media, err := h.eng.ListEventMedia(c.Request().Context(), id)
	if err != nil {
		return err
	}
	return response.OK(c, media)
}

func (h *EngagementHandler) AddEventMedia(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.AddEventMediaRequest](c)
	if err != nil {
		return err
	}
	em, err := h.eng.AddEventMedia(c.Request().Context(), id, mw.UserID(c), req, c.RealIP())
	if err != nil {
		return err
	}
	return response.Created(c, em)
}

// --- announcements ---

func (h *EngagementHandler) ListAnnouncements(c echo.Context) error {
	var q dto.PageQuery
	if err := c.Bind(&q); err != nil {
		return apperr.BadRequest("invalid query parameters")
	}
	q.Normalize()
	items, total, err := h.eng.ListAnnouncements(c.Request().Context(), mw.UserID(c), mw.RequestLocale(c), c.QueryParam("tab"), q)
	if err != nil {
		return err
	}
	return response.List(c, items, response.Meta{Page: q.Page, PerPage: q.PerPage, Total: total})
}

func (h *EngagementHandler) GetAnnouncement(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	ann, err := h.eng.GetAnnouncement(c.Request().Context(), mw.UserID(c), id, mw.RequestLocale(c))
	if err != nil {
		return err
	}
	return response.OK(c, ann)
}

func (h *EngagementHandler) Acknowledge(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	if err := h.eng.Acknowledge(c.Request().Context(), mw.UserID(c), id); err != nil {
		return err
	}
	return response.NoContent(c)
}

func (h *EngagementHandler) Archive(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	if err := h.eng.SetArchived(c.Request().Context(), mw.UserID(c), id, true); err != nil {
		return err
	}
	return response.NoContent(c)
}

func (h *EngagementHandler) Unarchive(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	if err := h.eng.SetArchived(c.Request().Context(), mw.UserID(c), id, false); err != nil {
		return err
	}
	return response.NoContent(c)
}

func (h *EngagementHandler) CreateAnnouncement(c echo.Context) error {
	req, err := dto.Bind[dto.CreateAnnouncementRequest](c)
	if err != nil {
		return err
	}
	ann, err := h.eng.CreateAnnouncement(c.Request().Context(), req, mw.UserID(c), c.RealIP())
	if err != nil {
		return err
	}
	return response.Created(c, ann)
}

func (h *EngagementHandler) PublishAnnouncement(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	ann, err := h.eng.Publish(c.Request().Context(), id, mw.UserID(c), c.RealIP())
	if err != nil {
		return err
	}
	return response.OK(c, ann)
}

// --- community ---

func (h *EngagementHandler) ListPosts(c echo.Context) error {
	var q dto.PageQuery
	if err := c.Bind(&q); err != nil {
		return apperr.BadRequest("invalid query parameters")
	}
	q.Normalize()
	posts, total, err := h.eng.ListPosts(c.Request().Context(), q)
	if err != nil {
		return err
	}
	return response.List(c, posts, response.Meta{Page: q.Page, PerPage: q.PerPage, Total: total})
}

func (h *EngagementHandler) CreatePost(c echo.Context) error {
	req, err := dto.Bind[dto.CreateCommunityPostRequest](c)
	if err != nil {
		return err
	}
	post, err := h.eng.CreatePost(c.Request().Context(), mw.Role(c), mw.UserID(c), req, c.RealIP())
	if err != nil {
		return err
	}
	return response.Created(c, post)
}

func (h *EngagementHandler) DeletePost(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	if err := h.eng.DeletePost(c.Request().Context(), mw.Role(c), mw.UserID(c), id, c.RealIP()); err != nil {
		return err
	}
	return response.NoContent(c)
}

func (h *EngagementHandler) Comment(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.CreateCommentRequest](c)
	if err != nil {
		return err
	}
	comment, err := h.eng.Comment(c.Request().Context(), mw.UserID(c), id, req.Body)
	if err != nil {
		return err
	}
	return response.Created(c, comment)
}

func (h *EngagementHandler) DeleteComment(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	if err := h.eng.DeleteComment(c.Request().Context(), mw.Role(c), mw.UserID(c), id, c.RealIP()); err != nil {
		return err
	}
	return response.NoContent(c)
}

func (h *EngagementHandler) ToggleLike(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	liked, err := h.eng.ToggleLike(c.Request().Context(), mw.UserID(c), id)
	if err != nil {
		return err
	}
	return response.OK(c, map[string]bool{"liked": liked})
}

func (h *EngagementHandler) MeetupRSVP(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.MeetupRSVPRequest](c)
	if err != nil {
		return err
	}
	rsvp, err := h.eng.MeetupRSVP(c.Request().Context(), mw.UserID(c), id, req.Response)
	if err != nil {
		return err
	}
	return response.OK(c, rsvp)
}

// --- reminders ---

func (h *EngagementHandler) ListReminders(c echo.Context) error {
	reminders, err := h.eng.ListReminders(c.Request().Context(), mw.Role(c), mw.UserID(c), mw.RequestLocale(c))
	if err != nil {
		return err
	}
	return response.OK(c, reminders)
}

func (h *EngagementHandler) CreateReminder(c echo.Context) error {
	req, err := dto.Bind[dto.CreateReminderRequest](c)
	if err != nil {
		return err
	}
	r, err := h.eng.CreateReminder(c.Request().Context(), req, mw.UserID(c), c.RealIP())
	if err != nil {
		return err
	}
	return response.Created(c, r)
}

func (h *EngagementHandler) DeleteReminder(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	if err := h.eng.DeleteReminder(c.Request().Context(), id, mw.UserID(c), c.RealIP()); err != nil {
		return err
	}
	return response.NoContent(c)
}

// --- notification center ---

func (h *EngagementHandler) ListNotifications(c echo.Context) error {
	var q dto.PageQuery
	if err := c.Bind(&q); err != nil {
		return apperr.BadRequest("invalid query parameters")
	}
	q.Normalize()
	items, total, err := h.center.List(c.Request().Context(), mw.UserID(c), c.QueryParam("category"), q)
	if err != nil {
		return err
	}
	return response.List(c, items, response.Meta{Page: q.Page, PerPage: q.PerPage, Total: total})
}

func (h *EngagementHandler) UnreadCount(c echo.Context) error {
	n, err := h.center.UnreadCount(c.Request().Context(), mw.UserID(c))
	if err != nil {
		return err
	}
	return response.OK(c, map[string]int64{"unread": n})
}

func (h *EngagementHandler) MarkAllRead(c echo.Context) error {
	if err := h.center.MarkAllRead(c.Request().Context(), mw.UserID(c)); err != nil {
		return err
	}
	return response.NoContent(c)
}

func (h *EngagementHandler) MarkRead(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	if err := h.center.MarkRead(c.Request().Context(), mw.UserID(c), id); err != nil {
		return err
	}
	return response.NoContent(c)
}

func (h *EngagementHandler) RegisterDevice(c echo.Context) error {
	req, err := dto.Bind[dto.RegisterDeviceRequest](c)
	if err != nil {
		return err
	}
	if err := h.center.RegisterDevice(c.Request().Context(), mw.UserID(c), req); err != nil {
		return err
	}
	return response.NoContent(c)
}

func (h *EngagementHandler) UnregisterDevice(c echo.Context) error {
	playerID := c.Param("playerId")
	if playerID == "" {
		return apperr.BadRequest("invalid player id")
	}
	if err := h.center.UnregisterDevice(c.Request().Context(), mw.UserID(c), playerID); err != nil {
		return err
	}
	return response.NoContent(c)
}
