// Package notification wraps the OneSignal REST API.
package notification

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const oneSignalEndpoint = "https://onesignal.com/api/v1/notifications"

// OneSignalClient sends push notifications. A client with empty credentials
// is a configured no-op (Enabled() == false), so the app runs without keys.
type OneSignalClient struct {
	appID    string
	apiKey   string
	endpoint string // overridden in tests
	http     *http.Client
}

func NewOneSignalClient(appID, apiKey string) *OneSignalClient {
	return &OneSignalClient{
		appID:    appID,
		apiKey:   apiKey,
		endpoint: oneSignalEndpoint,
		http:     &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *OneSignalClient) Enabled() bool { return c.appID != "" && c.apiKey != "" }

type pushPayload struct {
	AppID             string            `json:"app_id"`
	IncludePlayerIDs  []string          `json:"include_player_ids"`
	Headings          map[string]string `json:"headings"`
	Contents          map[string]string `json:"contents"`
	Data              map[string]any    `json:"data,omitempty"`
	Priority          int               `json:"priority"`
	AndroidVisibility int               `json:"android_visibility"`
	ContentAvailable  bool              `json:"content_available"`
}

// SendToPlayers pushes title/body to specific OneSignal player ids.
func (c *OneSignalClient) SendToPlayers(ctx context.Context, playerIDs []string, title, body string, data map[string]any) error {
	return c.SendLocalized(ctx, map[string][]string{"en": playerIDs}, map[string]Text{"en": {Title: title, Body: body}}, data)
}

// Text is one locale's rendering of a notification.
type Text struct {
	Title string
	Body  string
}

// SendLocalized sends each locale group its own translation. OneSignal keys
// content by language and needs "en" present as the fallback, so a locale with
// no translation is sent the English text rather than nothing.
func (c *OneSignalClient) SendLocalized(ctx context.Context, byLocale map[string][]string, texts map[string]Text, data map[string]any) error {
	if !c.Enabled() {
		return nil
	}
	fallback, hasFallback := texts["en"]
	if !hasFallback {
		for _, t := range texts { // any translation beats sending nothing
			fallback = t
			break
		}
	}

	for locale, ids := range byLocale {
		if len(ids) == 0 {
			continue
		}
		text, ok := texts[locale]
		if !ok {
			text = fallback
		}
		lang := normalizeLang(locale)
		headings := map[string]string{"en": fallback.Title}
		contents := map[string]string{"en": fallback.Body}
		if lang != "en" {
			headings[lang] = text.Title
			contents[lang] = text.Body
		}

		// OneSignal caps include_player_ids at 2000 per request.
		const batch = 2000
		for start := 0; start < len(ids); start += batch {
			end := min(start+batch, len(ids))
			payload := pushPayload{
				AppID:             c.appID,
				IncludePlayerIDs:  ids[start:end],
				Headings:          headings,
				Contents:          contents,
				Data:              data,
				Priority:          10,
				AndroidVisibility: 1,
				ContentAvailable:  true,
			}
			if err := c.post(ctx, payload); err != nil {
				return err
			}
		}
	}
	return nil
}

// normalizeLang reduces a stored locale ("sv-SE", "AR") to the two-letter code
// OneSignal expects. An empty or malformed value falls back to English.
func normalizeLang(locale string) string {
	if i := strings.IndexAny(locale, "-_"); i > 0 {
		locale = locale[:i]
	}
	locale = strings.ToLower(strings.TrimSpace(locale))
	if len(locale) != 2 {
		return "en"
	}
	return locale
}

func (c *OneSignalClient) post(ctx context.Context, payload pushPayload) error {
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Basic "+c.apiKey)

	res, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		snippet, _ := io.ReadAll(io.LimitReader(res.Body, 512))
		return fmt.Errorf("onesignal: status %d: %s", res.StatusCode, snippet)
	}
	return nil
}
