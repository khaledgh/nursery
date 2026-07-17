package handler

import (
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"

	mw "github.com/sunnystars/backend/internal/middleware"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
	"github.com/sunnystars/backend/internal/pkg/response"
	"github.com/sunnystars/backend/internal/service"
)

type MediaHandler struct {
	media *service.MediaService
}

func NewMediaHandler(media *service.MediaService) *MediaHandler {
	return &MediaHandler{media: media}
}

func (h *MediaHandler) Register(protected *echo.Group) {
	protected.POST("/media", h.Upload)
	protected.DELETE("/media/:id", h.Delete)
	protected.GET("/media/stream/*", h.Stream)
}

func (h *MediaHandler) Upload(c echo.Context) error {
	fh, err := c.FormFile("file")
	if err != nil {
		return apperr.BadRequest("multipart field 'file' is required")
	}
	media, err := h.media.Upload(c.Request().Context(), mw.UserID(c), fh)
	if err != nil {
		return err
	}
	return response.Created(c, media)
}

func (h *MediaHandler) Delete(c echo.Context) error {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		return apperr.BadRequest("invalid media id")
	}
	isAdmin := mw.Role(c) == model.RoleAdmin
	if err := h.media.Delete(c.Request().Context(), id, mw.UserID(c), isAdmin); err != nil {
		return err
	}
	return response.NoContent(c)
}

// Stream serves local-disk files to authenticated users only.
func (h *MediaHandler) Stream(c echo.Context) error {
	key := strings.TrimPrefix(c.Param("*"), "/")
	media, rc, err := h.media.OpenByPath(c.Request().Context(), key)
	if err != nil {
		return err
	}
	defer rc.Close()
	c.Response().Header().Set("Content-Disposition", "inline")
	c.Response().Header().Set("X-Content-Type-Options", "nosniff")
	return c.Stream(200, media.Mime, rc)
}
