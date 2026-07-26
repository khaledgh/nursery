package handler

import (
	"net/url"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"

	mw "github.com/sunnystars/backend/internal/middleware"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
	"github.com/sunnystars/backend/internal/pkg/response"
	"github.com/sunnystars/backend/internal/service"
	"github.com/sunnystars/backend/internal/storage"
)

type MediaHandler struct {
	media  *service.MediaService
	signer *storage.Signer
}

func NewMediaHandler(media *service.MediaService, signer *storage.Signer) *MediaHandler {
	return &MediaHandler{media: media, signer: signer}
}

func (h *MediaHandler) Register(public, protected *echo.Group) {
	protected.POST("/media", h.Upload)
	protected.DELETE("/media/:id", h.Delete)
	// Streaming is public-routed but not unauthenticated: image tags cannot send
	// a bearer token, so the signed query string is the credential. See Stream.
	public.GET("/media/stream/*", h.Stream)
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

// Stream serves local-disk files to holders of a valid signed URL. Browsers and
// React Native strip nothing from a query string but cannot add an Authorization
// header, so the signature — not a bearer token — is what authorises the read.
func (h *MediaHandler) Stream(c echo.Context) error {
	// Echo percent-decodes the wildcard, so undo it to recover the key as signed.
	key := strings.TrimPrefix(c.Param("*"), "/")
	if decoded, err := url.PathUnescape(key); err == nil {
		key = decoded
	}
	if h.signer != nil {
		q := c.QueryParams()
		if err := h.signer.Verify(key, q.Get("exp"), q.Get("sig")); err != nil {
			return apperr.Unauthorized(err.Error())
		}
	}
	media, rc, err := h.media.OpenByPath(c.Request().Context(), key)
	if err != nil {
		return err
	}
	defer rc.Close()
	c.Response().Header().Set("Content-Disposition", "inline")
	c.Response().Header().Set("X-Content-Type-Options", "nosniff")
	// Signed URLs are stable until they expire, so let clients cache the bytes.
	c.Response().Header().Set("Cache-Control", "private, max-age=3600")
	return c.Stream(200, media.Mime, rc)
}
