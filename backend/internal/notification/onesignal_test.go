package notification

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// capture stands in for the OneSignal API and records what was posted.
func capture(t *testing.T) (*OneSignalClient, *[]pushPayload, *[]string) {
	t.Helper()
	var got []pushPayload
	var auth []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var p pushPayload
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			t.Errorf("decode payload: %v", err)
		}
		got = append(got, p)
		auth = append(auth, r.Header.Get("Authorization"))
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":"x","recipients":1}`))
	}))
	t.Cleanup(srv.Close)

	c := NewOneSignalClient("app-id", "api-key")
	c.endpoint = srv.URL
	return c, &got, &auth
}

// Each locale group must receive its own translation, with English kept as the
// fallback OneSignal requires.
func TestSendLocalizedUsesPerLocaleText(t *testing.T) {
	c, got, _ := capture(t)

	_, err := c.SendLocalized(context.Background(),
		map[string][]string{"en": {"1"}, "sv": {"2", "3"}},
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
		if len(p.IncludeAliases["external_id"]) == 2 { // the Swedish group
			if p.Headings["sv"] != "Incheckad" {
				t.Errorf("Swedish heading = %q", p.Headings["sv"])
			}
		}
	}
}

// Users are targeted by external id on the push channel, not by device ids,
// so iOS devices whose subscription id was never reported still get the push.
func TestSendTargetsExternalIDs(t *testing.T) {
	c, got, auth := capture(t)

	res, err := c.SendLocalized(context.Background(),
		map[string][]string{"en": {"42"}},
		map[string]Text{"en": {Title: "Hi", Body: "There"}}, map[string]any{"screen": "diary"})
	if err != nil {
		t.Fatal(err)
	}
	p := (*got)[0]
	if ids := p.IncludeAliases["external_id"]; len(ids) != 1 || ids[0] != "42" {
		t.Errorf("include_aliases = %v, want external_id [42]", p.IncludeAliases)
	}
	if p.TargetChannel != "push" {
		t.Errorf("target_channel = %q, want push", p.TargetChannel)
	}
	if !p.MutableContent || p.IOSBadgeType != "Increase" {
		t.Errorf("missing iOS fields: mutable=%v badge=%q", p.MutableContent, p.IOSBadgeType)
	}
	if (*auth)[0] != "Basic api-key" {
		t.Errorf("legacy key auth = %q", (*auth)[0])
	}
	if len(res) != 1 || res[0].Recipients != 1 {
		t.Errorf("result = %+v, want recipients 1", res)
	}
}

// New-style v2 keys use the api.onesignal.com host with a "Key" header.
func TestV2KeyUsesNewEndpoint(t *testing.T) {
	c := NewOneSignalClient("app-id", "os_v2_app_abc")
	if c.endpoint != oneSignalEndpoint {
		t.Errorf("endpoint = %q, want %q", c.endpoint, oneSignalEndpoint)
	}
	if c.authHeader() != "Key os_v2_app_abc" {
		t.Errorf("auth = %q", c.authHeader())
	}
}

// A recipient whose locale has no translation must still get a readable push.
func TestSendLocalizedFallsBackToEnglish(t *testing.T) {
	c, got, _ := capture(t)

	_, err := c.SendLocalized(context.Background(),
		map[string][]string{"ar": {"1"}},
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
	if _, err := c.SendLocalized(context.Background(), map[string][]string{"en": {"1"}},
		map[string]Text{"en": {Title: "t", Body: "b"}}, nil); err != nil {
		t.Errorf("disabled send returned %v, want nil", err)
	}
}
