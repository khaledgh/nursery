package service

import (
	"context"
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

const maxUploadBytes = 15 << 20 // 15 MiB

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

	// Random server-generated key — client filenames never reach the filesystem.
	token, err := hash.RandomToken()
	if err != nil {
		return nil, apperr.Internal(err)
	}
	key := path.Join(time.Now().Format("2006/01"), token+ext)

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
