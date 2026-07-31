package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"path"
	"strings"
	"time"

	"gorm.io/gorm"

	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
	"github.com/sunnystars/backend/internal/pkg/hash"
	"github.com/sunnystars/backend/internal/storage"
)

const (
	maxUploadBytes = 15 << 20 // 15 MiB
	// uploadURLTTL is how long a presigned PUT stays valid — long enough for
	// a slow mobile connection to finish, short enough that a leaked URL
	// (e.g. logged, cached) is useless soon after.
	uploadURLTTL = 5 * time.Minute
)

// allowedUploads maps the *sniffed* content type to the stored extension.
// The client-declared filename/extension is never trusted.
var allowedUploads = map[string]string{
	"image/jpeg":      ".jpg",
	"image/png":       ".png",
	"image/gif":       ".gif",
	"image/webp":      ".webp",
	"application/pdf": ".pdf",
}

type MediaService struct {
	db    *gorm.DB
	store storage.Storage
}

func NewMediaService(db *gorm.DB, store storage.Storage) *MediaService {
	return &MediaService{db: db, store: store}
}

func (s *MediaService) Upload(ctx context.Context, userID uint64, fh *multipart.FileHeader) (*model.Media, error) {
	if fh.Size <= 0 || fh.Size > maxUploadBytes {
		return nil, apperr.BadRequest(fmt.Sprintf("file must be between 1 byte and %d MB", maxUploadBytes>>20))
	}
	f, err := fh.Open()
	if err != nil {
		return nil, apperr.Internal(err)
	}
	defer f.Close()

	// Sniff the real content type from the first 512 bytes.
	head := make([]byte, 512)
	n, err := io.ReadFull(f, head)
	if err != nil && err != io.ErrUnexpectedEOF {
		return nil, apperr.Internal(err)
	}
	mime := strings.SplitN(http.DetectContentType(head[:n]), ";", 2)[0]
	ext, ok := allowedUploads[mime]
	if !ok {
		return nil, apperr.BadRequest("unsupported file type; allowed: jpeg, png, gif, webp, pdf")
	}
	if _, err := f.Seek(0, io.SeekStart); err != nil {
		return nil, apperr.Internal(err)
	}

	key, err := randomKey(ext)
	if err != nil {
		return nil, apperr.Internal(err)
	}

	stored, err := s.store.Put(ctx, key, io.LimitReader(f, maxUploadBytes), mime, fh.Size)
	if err != nil {
		return nil, apperr.Internal(err)
	}

	media := &model.Media{
		Disk:       stored.Disk,
		Path:       stored.Path,
		URL:        stored.URL,
		Mime:       mime,
		Size:       stored.Size,
		UploadedBy: userID,
	}
	if err := s.db.WithContext(ctx).Create(media).Error; err != nil {
		_ = s.store.Delete(ctx, key) // don't orphan the file
		return nil, apperr.Internal(err)
	}
	return media, nil
}

// randomKey builds a server-generated storage key — client filenames never
// reach the filesystem or bucket, and the client cannot influence where its
// own upload lands.
func randomKey(ext string) (string, error) {
	token, err := hash.RandomToken()
	if err != nil {
		return "", err
	}
	return path.Join(time.Now().Format("2006/01"), token+ext), nil
}

// PresignUpload reserves a key and hands back a URL the client PUTs bytes to
// directly, so the request body never passes through this server. The Media
// row is created immediately in "pending" status: it exists so the key is
// tracked (and can be swept up if the upload never happens), but AfterFind
// withholds a URL for it until ConfirmUpload verifies the object landed.
func (s *MediaService) PresignUpload(ctx context.Context, userID uint64, mime string, size int64) (*model.Media, string, error) {
	if size <= 0 || size > maxUploadBytes {
		return nil, "", apperr.BadRequest(fmt.Sprintf("file must be between 1 byte and %d MB", maxUploadBytes>>20))
	}
	ext, ok := allowedUploads[mime]
	if !ok {
		return nil, "", apperr.BadRequest("unsupported file type; allowed: jpeg, png, gif, webp, pdf")
	}
	key, err := randomKey(ext)
	if err != nil {
		return nil, "", apperr.Internal(err)
	}
	uploadURL, err := s.store.PresignPut(ctx, key, mime, size, uploadURLTTL)
	if err != nil {
		if errors.Is(err, storage.ErrPresignUnsupported) {
			return nil, "", apperr.BadRequest("direct upload is not available; use POST /media")
		}
		return nil, "", apperr.Internal(err)
	}

	media := &model.Media{
		Disk:       s.store.Driver(),
		Path:       key,
		Mime:       mime,
		Size:       size,
		UploadedBy: userID,
		Status:     model.MediaPending,
	}
	if err := s.db.WithContext(ctx).Create(media).Error; err != nil {
		return nil, "", apperr.Internal(err)
	}
	return media, uploadURL, nil
}

// ConfirmUpload checks that a client's direct PUT actually landed as
// declared and flips the row to "ready". The server never saw the bytes
// itself, so HeadObject against the bucket is the only server-side
// verification a presigned-upload flow can do; it replaces the content
// sniffing the old multipart path did inline.
func (s *MediaService) ConfirmUpload(ctx context.Context, id, userID uint64) (*model.Media, error) {
	var media model.Media
	if err := s.db.WithContext(ctx).First(&media, id).Error; err != nil {
		return nil, apperr.NotFound("media not found")
	}
	if media.UploadedBy != userID {
		return nil, apperr.Forbidden("you can only confirm your own uploads")
	}
	if media.Status == model.MediaReady {
		return &media, nil
	}

	info, err := s.store.Head(ctx, media.Path)
	if err != nil {
		return nil, apperr.BadRequest("upload not found — PUT the file to the presigned URL before confirming")
	}
	if info.Mime != "" && info.Mime != media.Mime {
		_ = s.db.WithContext(ctx).Delete(&media).Error
		_ = s.store.Delete(ctx, media.Path)
		return nil, apperr.BadRequest("uploaded content-type does not match the presigned request")
	}
	if info.Size <= 0 || info.Size > maxUploadBytes {
		_ = s.db.WithContext(ctx).Delete(&media).Error
		_ = s.store.Delete(ctx, media.Path)
		return nil, apperr.BadRequest("uploaded file size is invalid")
	}

	media.Size = info.Size
	media.Status = model.MediaReady
	if err := s.db.WithContext(ctx).Model(&media).Updates(map[string]any{
		"size":   media.Size,
		"status": media.Status,
	}).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	if err := media.AfterFind(nil); err != nil {
		return nil, apperr.Internal(err)
	}
	return &media, nil
}

func (s *MediaService) Delete(ctx context.Context, id, actorID uint64, isAdmin bool) error {
	var media model.Media
	if err := s.db.WithContext(ctx).First(&media, id).Error; err != nil {
		return apperr.NotFound("media not found")
	}
	if !isAdmin && media.UploadedBy != actorID {
		return apperr.Forbidden("you can only delete your own uploads")
	}
	if err := s.db.WithContext(ctx).Delete(&media).Error; err != nil {
		return apperr.Internal(err)
	}
	// Soft-deleted row keeps the audit trail; remove the binary itself.
	if err := s.store.Delete(ctx, media.Path); err != nil {
		return apperr.Internal(err)
	}
	return nil
}

// OpenByPath returns the media row and a reader for access-checked streaming.
func (s *MediaService) OpenByPath(ctx context.Context, p string) (*model.Media, io.ReadCloser, error) {
	var media model.Media
	if err := s.db.WithContext(ctx).Where("path = ?", p).First(&media).Error; err != nil {
		return nil, nil, apperr.NotFound("media not found")
	}
	rc, err := s.store.Open(ctx, media.Path)
	if err != nil {
		return nil, nil, apperr.NotFound("media not found")
	}
	return &media, rc, nil
}
