// Package storage abstracts file persistence behind one interface so the
// platform can switch between local disk and S3 without touching handlers.
package storage

import (
	"context"
	"io"
)

type StoredFile struct {
	Disk string // "local" | "s3"
	Path string // key relative to the storage root
	URL  string // public URL (or API-streamed path for local)
	Size int64
}

type Storage interface {
	// Put streams r to the backend under key and returns the stored descriptor.
	Put(ctx context.Context, key string, r io.Reader, mime string, size int64) (*StoredFile, error)
	Delete(ctx context.Context, key string) error
	// Open returns a reader for access-checked streaming (local driver).
	Open(ctx context.Context, key string) (io.ReadCloser, error)
	URL(key string) string
	Driver() string
}
