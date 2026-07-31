// Package storage abstracts file persistence behind one interface so the
// platform can switch between local disk and S3 without touching handlers.
package storage

import (
	"context"
	"errors"
	"io"
	"time"
)

// ErrPresignUnsupported is returned by drivers that have no notion of a
// presigned URL, e.g. local disk: there is no bucket to sign a request against.
var ErrPresignUnsupported = errors.New("storage: driver does not support presigned URLs")

type StoredFile struct {
	Disk string // "local" | "s3"
	Path string // key relative to the storage root
	URL  string // public URL (or API-streamed path for local)
	Size int64
}

// ObjectInfo is what Head reports about an object already in the backend,
// used to verify a client's direct upload actually happened as declared.
type ObjectInfo struct {
	Size int64
	Mime string
}

type Storage interface {
	// Put streams r to the backend under key and returns the stored descriptor.
	Put(ctx context.Context, key string, r io.Reader, mime string, size int64) (*StoredFile, error)
	Delete(ctx context.Context, key string) error
	// Open returns a reader for access-checked streaming (local driver).
	Open(ctx context.Context, key string) (io.ReadCloser, error)
	URL(key string) string
	Driver() string
	// PresignPut returns a URL the client can PUT the object body to directly,
	// bypassing the API for the upload bytes. Drivers that cannot presign
	// (local disk) return ErrPresignUnsupported.
	PresignPut(ctx context.Context, key, mime string, size int64, ttl time.Duration) (string, error)
	// PresignGet returns a time-limited URL the client can read the object
	// from directly. Drivers that cannot presign return ErrPresignUnsupported.
	PresignGet(ctx context.Context, key string, ttl time.Duration) (string, error)
	// Head reports the size/type actually stored under key, for verifying a
	// client's direct upload landed as declared. Returns an error the caller
	// can treat as "not found" when the object does not exist.
	Head(ctx context.Context, key string) (*ObjectInfo, error)
}
