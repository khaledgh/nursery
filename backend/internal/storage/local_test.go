package storage

import (
	"context"
	"io"
	"strings"
	"testing"
)

func newTestStorage(t *testing.T) *LocalStorage {
	t.Helper()
	s, err := NewLocalStorage(t.TempDir(), "http://localhost:8080", nil)
	if err != nil {
		t.Fatalf("init: %v", err)
	}
	return s
}

func TestPutOpenDelete(t *testing.T) {
	s := newTestStorage(t)
	ctx := context.Background()

	stored, err := s.Put(ctx, "2026/06/test.txt", strings.NewReader("hello"), "text/plain", 5)
	if err != nil {
		t.Fatalf("put: %v", err)
	}
	if stored.Size != 5 || stored.Disk != "local" {
		t.Fatalf("unexpected descriptor: %+v", stored)
	}

	rc, err := s.Open(ctx, "2026/06/test.txt")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	data, _ := io.ReadAll(rc)
	rc.Close()
	if string(data) != "hello" {
		t.Fatalf("content mismatch: %q", data)
	}

	if err := s.Delete(ctx, "2026/06/test.txt"); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := s.Open(ctx, "2026/06/test.txt"); err == nil {
		t.Fatal("expected open after delete to fail")
	}
}

func TestRejectsPathTraversal(t *testing.T) {
	s := newTestStorage(t)
	ctx := context.Background()
	hostile := []string{
		"../escape.txt",
		"..\\escape.txt",
		"a/../../escape.txt",
		"/absolute.txt",
		"C:\\Windows\\system32\\evil",
		".",
		"",
	}
	for _, key := range hostile {
		if _, err := s.Put(ctx, key, strings.NewReader("x"), "text/plain", 1); err == nil {
			t.Errorf("Put accepted hostile key %q", key)
		}
		if rc, err := s.Open(ctx, key); err == nil {
			rc.Close()
			t.Errorf("Open accepted hostile key %q", key)
		}
	}
}

func TestPutRefusesOverwrite(t *testing.T) {
	s := newTestStorage(t)
	ctx := context.Background()
	if _, err := s.Put(ctx, "a/file.txt", strings.NewReader("one"), "text/plain", 3); err != nil {
		t.Fatalf("first put: %v", err)
	}
	if _, err := s.Put(ctx, "a/file.txt", strings.NewReader("two"), "text/plain", 3); err == nil {
		t.Fatal("expected second put to the same key to fail (O_EXCL)")
	}
}
