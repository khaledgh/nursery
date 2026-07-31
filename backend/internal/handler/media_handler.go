package handler

import (
	"net/url"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/sunnystars/backend/internal/dto"
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
	protected.POST("/media/presign-upload", h.PresignUpload)
	protected.POST("/media/:id/confirm", h.ConfirmUpload)
	protected.DELETE("/media/:id", h.Delete)
	// Streaming is public-routed but not unauthenticated: image tags cannot send
	// a bearer token, so the signed query string is the credential. See Stream.
	public.GET("/media/stream/*", h.Stream)
}

// Upload is the legacy multipart path: bytes are relayed through this server
// to storage. Kept for the local-disk driver, which has no presign story.
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

// PresignUpload reserves a Media row and returns a URL the client PUTs the
// file to directly, so the bytes never pass through this server.
func (h *MediaHandler) PresignUpload(c echo.Context) error {
	req, err := dto.Bind[dto.PresignUploadRequest](c)
	if err != nil {
		return err
	}
	media, uploadURL, err := h.media.PresignUpload(c.Request().Context(), mw.UserID(c), req.Mime, req.Size)
	if err != nil {
		return err
	}
	return response.Created(c, map[string]any{
		"media_id":   media.ID,
		"upload_url": uploadURL,
	})
}

// ConfirmUpload verifies a client's direct PUT landed as declared and flips
// the row to ready, returning it with a live presigned read URL.
func (h *MediaHandler) ConfirmUpload(c echo.Context) error {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		return apperr.BadRequest("invalid media id")
	}
	media, err := h.media.ConfirmUpload(c.Request().Context(), id, mw.UserID(c))
	if err != nil {
		return err
	}
	return response.OK(c, media)
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
