package service

import (
	"context"
	"errors"
	"io"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
	"github.com/sunnystars/backend/internal/storage"
)

// fakeStorage stands in for the real S3/R2 driver so these tests exercise
// MediaService's own logic (validation, state transitions) without any
// network I/O or AWS credentials.
type fakeStorage struct {
	putURL     string
	getURL     string
	head       *storage.ObjectInfo
	headErr    error
	deleted    []string
	presignErr error
}

func (f *fakeStorage) Put(ctx context.Context, key string, r io.Reader, mime string, size int64) (*storage.StoredFile, error) {
	return &storage.StoredFile{Disk: "s3", Path: key, URL: f.getURL, Size: size}, nil
}
func (f *fakeStorage) Delete(ctx context.Context, key string) error {
	f.deleted = append(f.deleted, key)
	return nil
}
func (f *fakeStorage) Open(ctx context.Context, key string) (io.ReadCloser, error) {
	return nil, errors.New("not implemented")
}
func (f *fakeStorage) URL(key string) string { return f.getURL }
func (f *fakeStorage) Driver() string        { return "s3" }
func (f *fakeStorage) PresignPut(ctx context.Context, key, mime string, size int64, ttl time.Duration) (string, error) {
	if f.presignErr != nil {
		return "", f.presignErr
	}
	return f.putURL, nil
}
func (f *fakeStorage) PresignGet(ctx context.Context, key string, ttl time.Duration) (string, error) {
	return f.getURL, nil
}
func (f *fakeStorage) Head(ctx context.Context, key string) (*storage.ObjectInfo, error) {
	if f.headErr != nil {
		return nil, f.headErr
	}
	return f.head, nil
}

// testDB wires sqlmock to a real (non-DryRun) GORM session so Create/First/
// Updates round-trip through actual SQL the way MediaService issues it.
func testDB(t *testing.T) (*gorm.DB, sqlmock.Sqlmock) {
	t.Helper()
	conn, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { conn.Close() })
	db, err := gorm.Open(mysql.New(mysql.Config{
		Conn:                      conn,
		SkipInitializeWithVersion: true,
	}), &gorm.Config{Logger: logger.Discard})
	if err != nil {
		t.Fatalf("gorm open: %v", err)
	}
	return db, mock
}

func TestPresignUploadRejectsUnsupportedMime(t *testing.T) {
	db, _ := testDB(t)
	svc := NewMediaService(db, &fakeStorage{})

	_, _, err := svc.PresignUpload(context.Background(), 1, "application/zip", 1024)
	var ae *apperr.Error
	if !errors.As(err, &ae) || ae.Code != apperr.CodeBadRequest {
		t.Fatalf("expected bad_request for unsupported mime, got %v", err)
	}
}

func TestPresignUploadRejectsOversizedFile(t *testing.T) {
	db, _ := testDB(t)
	svc := NewMediaService(db, &fakeStorage{})

	_, _, err := svc.PresignUpload(context.Background(), 1, "image/jpeg", maxUploadBytes+1)
	var ae *apperr.Error
	if !errors.As(err, &ae) || ae.Code != apperr.CodeBadRequest {
		t.Fatalf("expected bad_request for oversized file, got %v", err)
	}
}

// A successful presign must create a pending row and return the URL the
// client PUTs bytes to — the row exists before any bytes exist so the
// reserved key can be swept up if the client never finishes.
func TestPresignUploadCreatesPendingRow(t *testing.T) {
	db, mock := testDB(t)
	store := &fakeStorage{putURL: "https://bucket.r2.cloudflarestorage.com/put?sig=abc"}
	svc := NewMediaService(db, store)

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO `media`")).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	media, uploadURL, err := svc.PresignUpload(context.Background(), 7, "image/jpeg", 2048)
	if err != nil {
		t.Fatalf("PresignUpload: %v", err)
	}
	if uploadURL != store.putURL {
		t.Fatalf("expected upload URL %q, got %q", store.putURL, uploadURL)
	}
	if media.Status != model.MediaPending {
		t.Fatalf("expected pending status, got %q", media.Status)
	}
	if media.UploadedBy != 7 {
		t.Fatalf("expected uploader 7, got %d", media.UploadedBy)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// ConfirmUpload must reject a mismatched content-type and clean up both the
// row and the object rather than trusting the client's original declaration —
// the server never saw the bytes, so HeadObject's report is authoritative.
func TestConfirmUploadRejectsMimeMismatch(t *testing.T) {
	db, mock := testDB(t)
	store := &fakeStorage{head: &storage.ObjectInfo{Size: 2048, Mime: "application/pdf"}}
	svc := NewMediaService(db, store)

	rows := sqlmock.NewRows([]string{"id", "disk", "path", "mime", "size", "uploaded_by", "status"}).
		AddRow(1, "s3", "2026/07/token.jpg", "image/jpeg", 2048, 7, model.MediaPending)
	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `media`")).WillReturnRows(rows)
	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("UPDATE `media`")).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	_, err := svc.ConfirmUpload(context.Background(), 1, 7)
	var ae *apperr.Error
	if !errors.As(err, &ae) || ae.Code != apperr.CodeBadRequest {
		t.Fatalf("expected bad_request for mime mismatch, got %v", err)
	}
	if len(store.deleted) != 1 || store.deleted[0] != "2026/07/token.jpg" {
		t.Fatalf("expected orphaned object to be deleted, deleted=%v", store.deleted)
	}
}

// A user must not be able to confirm someone else's upload — the row exists
// (key was reserved) but ownership is still checked exactly like Delete does.
func TestConfirmUploadRejectsWrongOwner(t *testing.T) {
	db, mock := testDB(t)
	svc := NewMediaService(db, &fakeStorage{})

	rows := sqlmock.NewRows([]string{"id", "disk", "path", "mime", "size", "uploaded_by", "status"}).
		AddRow(1, "s3", "2026/07/token.jpg", "image/jpeg", 2048, 7, model.MediaPending)
	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `media`")).WillReturnRows(rows)

	_, err := svc.ConfirmUpload(context.Background(), 1, 999)
	var ae *apperr.Error
	if !errors.As(err, &ae) || ae.Code != apperr.CodeForbidden {
		t.Fatalf("expected forbidden for wrong owner, got %v", err)
	}
}
