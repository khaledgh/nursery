package notification

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// capture stands in for the OneSignal API and records what was posted.
func capture(t *testing.T) (*OneSignalClient, *[]pushPayload) {
	t.Helper()
	var got []pushPayload
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var p pushPayload
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			t.Errorf("decode payload: %v", err)
		}
		got = append(got, p)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":"x"}`))
	}))
	t.Cleanup(srv.Close)

	c := NewOneSignalClient("app-id", "api-key")
	c.endpoint = srv.URL
	return c, &got
}

// Each locale group must receive its own translation, with English kept as the
// fallback OneSignal requires.
func TestSendLocalizedUsesPerLocaleText(t *testing.T) {
	c, got := capture(t)

	err := c.SendLocalized(context.Background(),
		map[string][]string{"en": {"p1"}, "sv": {"p2", "p3"}},
		map[string]Text{
			"en": {Title: "Checked in", Body: "Arrived safely"},
			"sv": {Title: "Incheckad", Body: "Kom fram"},
		}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(*got) != 2 {
		t.Fatalf("sent %d requests, want one per locale", len(*got))
	}

	for _, p := range *got {
		if p.Headings["en"] != "Checked in" {
			t.Errorf("missing English fallback: %v", p.Headings)
		}
		if len(p.IncludePlayerIDs) == 2 { // the Swedish group
			if p.Headings["sv"] != "Incheckad" {
				t.Errorf("Swedish heading = %q", p.Headings["sv"])
			}
		}
	}
}

// A device whose locale has no translation must still get a readable push.
func TestSendLocalizedFallsBackToEnglish(t *testing.T) {
	c, got := capture(t)

	err := c.SendLocalized(context.Background(),
		map[string][]string{"ar": {"p1"}},
		map[string]Text{"en": {Title: "Checked in", Body: "Arrived safely"}}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(*got) != 1 {
		t.Fatalf("sent %d requests, want 1", len(*got))
	}
	if (*got)[0].Headings["en"] != "Checked in" {
		t.Errorf("lost the fallback text: %v", (*got)[0].Headings)
	}
}

func TestNormalizeLang(t *testing.T) {
	for in, want := range map[string]string{
		"sv":    "sv",
		"sv-SE": "sv",
		"ar_EG": "ar",
		"EN":    "en",
		"":      "en",
		"x":     "en",
		"weird": "en",
	} {
		if got := normalizeLang(in); got != want {
			t.Errorf("normalizeLang(%q) = %q, want %q", in, got, want)
		}
	}
}

// An unconfigured client must stay a silent no-op rather than erroring.
func TestDisabledClientSendsNothing(t *testing.T) {
	c := NewOneSignalClient("", "")
	if c.Enabled() {
		t.Fatal("client without credentials reports enabled")
	}
	if err := c.SendToPlayers(context.Background(), []string{"p1"}, "t", "b", nil); err != nil {
		t.Errorf("disabled send returned %v, want nil", err)
	}
}
