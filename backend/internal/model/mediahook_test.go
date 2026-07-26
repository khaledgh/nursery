package model

import "testing"

// The album must render photos that are not tagged to any child, so a nil
// ChildID has to survive serialization as null rather than being dropped.
func TestEventMediaAllowsNilChild(t *testing.T) {
	em := EventMedia{EventID: 1, MediaID: 2}
	if em.ChildID != nil {
		t.Fatalf("expected untagged media to have nil ChildID, got %v", *em.ChildID)
	}
}

// AfterFind must rebuild the URL for local media, which is what the album
// renders. If it leaves URL empty the client filter drops the photo.
func TestAfterFindRebuildsLocalURL(t *testing.T) {
	old := MediaURLBuilder
	defer func() { MediaURLBuilder = old }()
	MediaURLBuilder = func(p string) string { return "https://api.test/api/v1/media/stream/" + p + "?sig=x" }

	m := &Media{Disk: "local", Path: "2026/07/a.jpg", URL: "http://localhost:8080/stale"}
	if err := m.AfterFind(nil); err != nil {
		t.Fatal(err)
	}
	if m.URL != "https://api.test/api/v1/media/stream/2026/07/a.jpg?sig=x" {
		t.Fatalf("URL not rebuilt: %s", m.URL)
	}
}

// A media row with no Path (or an s3 row) must keep whatever URL it has.
func TestAfterFindLeavesNonLocalAlone(t *testing.T) {
	old := MediaURLBuilder
	defer func() { MediaURLBuilder = old }()
	MediaURLBuilder = func(string) string { return "REBUILT" }

	m := &Media{Disk: "s3", Path: "2026/07/a.jpg", URL: "https://cdn.example/a.jpg"}
	if err := m.AfterFind(nil); err != nil {
		t.Fatal(err)
	}
	if m.URL != "https://cdn.example/a.jpg" {
		t.Fatalf("s3 URL was overwritten: %s", m.URL)
	}
}
