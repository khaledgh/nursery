package main

import (
	"strings"
	"testing"
	"time"

	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/storage"
)

// End-to-end shape check for the R2 path: a media row read back must expose a
// presigned, time-limited URL — direct reads from the bucket are the point of
// this driver now, but an UNSIGNED bucket URL must never reach a client, since
// that would let anyone with the link read a private child photo forever.
func TestS3MediaRowGetsPresignedNotBareBucketURL(t *testing.T) {
	store := storage.NewS3StorageWithPresignForTest("little-talent-media",
		"https://acct.r2.cloudflarestorage.com", "auto", time.Hour)

	old := model.MediaURLBuilder
	defer func() { model.MediaURLBuilder = old }()
	model.MediaURLBuilder = store.URL

	// The row as written at upload time, then read back through the hook.
	m := &model.Media{
		Disk:   "s3",
		Path:   "2026/07/secret-child-photo.jpg",
		Status: model.MediaReady,
		URL:    "https://acct.r2.cloudflarestorage.com/little-talent-media/2026/07/secret-child-photo.jpg",
	}
	if err := m.AfterFind(nil); err != nil {
		t.Fatal(err)
	}

	if !strings.Contains(m.URL, "r2.cloudflarestorage.com") {
		t.Fatalf("expected a direct bucket URL, got %s", m.URL)
	}
	if !strings.Contains(m.URL, "X-Amz-Signature=") || !strings.Contains(m.URL, "X-Amz-Expires=") {
		t.Fatalf("media URL served to client is not presigned: %s", m.URL)
	}
}

// A pending row (presigned-upload reserved but never confirmed) must not get
// a URL at all — the object may not exist yet, or worse, could be whatever a
// third party raced to PUT to the reserved key before confirmation ran.
func TestS3MediaRowPendingGetsNoURL(t *testing.T) {
	store := storage.NewS3StorageWithPresignForTest("little-talent-media",
		"https://acct.r2.cloudflarestorage.com", "auto", time.Hour)

	old := model.MediaURLBuilder
	defer func() { model.MediaURLBuilder = old }()
	model.MediaURLBuilder = store.URL

	m := &model.Media{
		Disk:   "s3",
		Path:   "2026/07/not-yet-uploaded.jpg",
		Status: model.MediaPending,
	}
	if err := m.AfterFind(nil); err != nil {
		t.Fatal(err)
	}
	if m.URL != "" {
		t.Fatalf("pending row should not resolve a URL, got %s", m.URL)
	}
}
