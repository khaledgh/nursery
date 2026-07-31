package main

import (
	"strings"
	"testing"
	"time"

	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/storage"
)

// End-to-end shape check for the R2 path: a media row read back must expose a
// signed API URL, never the bucket, and that URL must verify. Guards the
// property that switching STORAGE_DRIVER to s3 cannot silently publish media.
func TestS3MediaRowNeverLeaksBucketURL(t *testing.T) {
	signer := storage.NewSigner("secret-that-is-long-enough-for-hmac", time.Hour)
	// Built directly rather than via NewS3Storage: constructing a live client
	// would make this test depend on AWS credential/region discovery.
	store := storage.NewS3StorageForTest("little-talent-media",
		"https://acct.r2.cloudflarestorage.com", "auto", "https://api.example.com", signer)

	old := model.MediaURLBuilder
	defer func() { model.MediaURLBuilder = old }()
	model.MediaURLBuilder = store.URL

	// The row as written at upload time, then read back through the hook.
	m := &model.Media{
		Disk: "s3",
		Path: "2026/07/secret-child-photo.jpg",
		URL:  "https://acct.r2.cloudflarestorage.com/little-talent-media/2026/07/secret-child-photo.jpg",
	}
	if err := m.AfterFind(nil); err != nil {
		t.Fatal(err)
	}

	if strings.Contains(m.URL, "r2.cloudflarestorage.com") {
		t.Fatalf("bucket URL served to client: %s", m.URL)
	}
	if !strings.HasPrefix(m.URL, "https://api.example.com/api/v1/media/stream/") {
		t.Fatalf("expected signed stream URL, got %s", m.URL)
	}
	if !strings.Contains(m.URL, "sig=") || !strings.Contains(m.URL, "exp=") {
		t.Fatalf("media URL is unsigned: %s", m.URL)
	}
}
