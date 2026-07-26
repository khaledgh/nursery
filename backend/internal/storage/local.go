package storage

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

// LocalStorage writes under a root directory. Files are never served from the
// directory directly; the media handler streams them after an access check.
type LocalStorage struct {
	root    string
	baseURL string // e.g. https://api.example.com — media URLs are baseURL/api/v1/media/:id/file
	signer  *Signer
}

func NewLocalStorage(root, baseURL string, signer *Signer) (*LocalStorage, error) {
	abs, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(abs, 0o750); err != nil {
		return nil, fmt.Errorf("storage: create upload dir: %w", err)
	}
	return &LocalStorage{root: abs, baseURL: strings.TrimRight(baseURL, "/"), signer: signer}, nil
}

// safePath joins key under root and rejects any traversal outside it.
func (s *LocalStorage) safePath(key string) (string, error) {
	cleaned := filepath.Clean(filepath.FromSlash(key))
	// Reject ".", "..", rooted paths ("/x" is not IsAbs on Windows but still
	// rooted), and drive-letter prefixes ("C:..."), all of which could land
	// outside the upload root.
	if cleaned == "." || strings.HasPrefix(cleaned, "..") || filepath.IsAbs(cleaned) ||
		strings.HasPrefix(cleaned, string(filepath.Separator)) || filepath.VolumeName(cleaned) != "" {
		return "", fmt.Errorf("storage: invalid key %q", key)
	}
	full := filepath.Join(s.root, cleaned)
	if !strings.HasPrefix(full, s.root+string(filepath.Separator)) {
		return "", fmt.Errorf("storage: key escapes root: %q", key)
	}
	return full, nil
}

func (s *LocalStorage) Put(ctx context.Context, key string, r io.Reader, mime string, size int64) (*StoredFile, error) {
	full, err := s.safePath(key)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Dir(full), 0o750); err != nil {
		return nil, err
	}
	f, err := os.OpenFile(full, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o640)
	if err != nil {
		return nil, err
	}
	written, err := io.Copy(f, r)
	closeErr := f.Close()
	if err == nil {
		err = closeErr
	}
	if err != nil {
		os.Remove(full)
		return nil, err
	}
	return &StoredFile{Disk: "local", Path: key, URL: s.URL(key), Size: written}, nil
}

func (s *LocalStorage) Delete(ctx context.Context, key string) error {
	full, err := s.safePath(key)
	if err != nil {
		return err
	}
	err = os.Remove(full)
	if os.IsNotExist(err) {
		return nil
	}
	return err
}

func (s *LocalStorage) Open(ctx context.Context, key string) (io.ReadCloser, error) {
	full, err := s.safePath(key)
	if err != nil {
		return nil, err
	}
	return os.Open(full)
}

// URL for local files points at the streaming endpoint. Image tags cannot send an
// Authorization header, so access is carried by a short-lived signature instead.
func (s *LocalStorage) URL(key string) string {
	// Escape each segment individually: "/" must stay a path separator.
	parts := strings.Split(key, "/")
	for i, p := range parts {
		parts[i] = url.PathEscape(p)
	}
	u := s.baseURL + "/api/v1/media/stream/" + strings.Join(parts, "/")
	if s.signer == nil {
		return u
	}
	// Signed over the raw key, which is what the handler recovers after routing.
	return u + "?" + s.signer.Query(key)
}

func (s *LocalStorage) Driver() string { return "local" }
