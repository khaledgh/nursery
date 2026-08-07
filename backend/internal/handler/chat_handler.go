package handler

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"

	mw "github.com/sunnystars/backend/internal/middleware"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/service"
)

type ChatHandler struct {
	chat *service.ChatService
}

func NewChatHandler(chat *service.ChatService) *ChatHandler {
	return &ChatHandler{chat: chat}
}

func (h *ChatHandler) RegisterRoutes(g *echo.Group) {
	g.GET("/chat/conversations", h.GetConversations)
	g.POST("/chat/conversations", h.GetOrCreateConversation)
	g.GET("/chat/conversations/:id/messages", h.GetMessages)
	g.POST("/chat/conversations/:id/messages", h.SendMessage)
	g.PUT("/chat/conversations/:id/read", h.MarkAsRead)
}

func (h *ChatHandler) GetConversations(c echo.Context) error {
	userID := mw.UserID(c)
	if userID == 0 {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}

	convs, err := h.chat.GetConversations(c.Request().Context(), userID, mw.Role(c))
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]any{"data": convs})
}

type createConvReq struct {
	RecipientUserID uint64                 `json:"recipient_user_id"`
	Type            model.ConversationType `json:"type"`
	ChildID         *uint64                `json:"child_id"`
}

func (h *ChatHandler) GetOrCreateConversation(c echo.Context) error {
	userID := mw.UserID(c)
	if userID == 0 {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}

	var req createConvReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if req.Type == "" {
		req.Type = model.ConversationParentTeacher
	}

	conv, err := h.chat.GetOrCreateConversation(c.Request().Context(), userID, req.RecipientUserID, req.Type, req.ChildID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]any{"data": conv})
}

func (h *ChatHandler) GetMessages(c echo.Context) error {
	userID := mw.UserID(c)
	if userID == 0 {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}

	convID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid conversation id")
	}

	page, _ := strconv.Atoi(c.QueryParam("page"))
	limit, _ := strconv.Atoi(c.QueryParam("limit"))

	msgs, err := h.chat.GetMessages(c.Request().Context(), convID, userID, mw.Role(c), page, limit)
	if err != nil {
		return err
	}

	return c.JSON(http.StatusOK, map[string]any{"data": msgs})
}

type sendMsgReq struct {
	Body    string  `json:"body"`
	MediaID *uint64 `json:"media_id"`
}

func (h *ChatHandler) SendMessage(c echo.Context) error {
	userID := mw.UserID(c)
	if userID == 0 {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}

	convID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid conversation id")
	}

	var req sendMsgReq
	if err := c.Bind(&req); err != nil || req.Body == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "message body required")
	}

	msg, err := h.chat.SendMessage(c.Request().Context(), convID, userID, mw.Role(c), req.Body, req.MediaID)
	if err != nil {
		return err
	}

	return c.JSON(http.StatusCreated, map[string]any{"data": msg})
}

func (h *ChatHandler) MarkAsRead(c echo.Context) error {
	userID := mw.UserID(c)
	if userID == 0 {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}

	convID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid conversation id")
	}

	if err := h.chat.MarkAsRead(c.Request().Context(), convID, userID, mw.Role(c)); err != nil {
		return err
	}

	return c.JSON(http.StatusOK, map[string]any{"status": "ok"})
}
