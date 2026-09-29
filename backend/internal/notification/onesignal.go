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

const (
	// New-style keys ("os_v2_app_…") authenticate with "Key" on api.onesignal.com;
	// legacy REST keys use "Basic" on the v1 host. Both accept include_aliases.
	oneSignalEndpoint       = "https://api.onesignal.com/notifications"
	oneSignalLegacyEndpoint = "https://onesignal.com/api/v1/notifications"
)

// OneSignalClient sends push notifications. A client with empty credentials
// is a configured no-op (Enabled() == false), so the app runs without keys.
type OneSignalClient struct {
	appID    string
	apiKey   string
	endpoint string // overridden in tests
	http     *http.Client
}

func NewOneSignalClient(appID, apiKey string) *OneSignalClient {
	endpoint := oneSignalLegacyEndpoint
	if strings.HasPrefix(apiKey, "os_v2_") {
		endpoint = oneSignalEndpoint
	}
	return &OneSignalClient{
		appID:    appID,
		apiKey:   apiKey,
		endpoint: endpoint,
		http:     &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *OneSignalClient) Enabled() bool { return c.appID != "" && c.apiKey != "" }

type pushPayload struct {
	AppID string `json:"app_id"`
	// Users are targeted by the external id the app sets with
	// OneSignal.login(userId). OneSignal resolves it to every device of that
	// user, so delivery no longer depends on the app having reported a
	// subscription id — which on iOS is often not ready at first launch.
	IncludeAliases map[string][]string `json:"include_aliases"`
	TargetChannel  string              `json:"target_channel"`
	Headings       map[string]string   `json:"headings"`
	Contents       map[string]string   `json:"contents"`
	Data           map[string]any      `json:"data,omitempty"`
	// iOS: bump the app icon badge and let the notification service extension
	// attach media.
	IOSBadgeType   string `json:"ios_badgeType"`
	IOSBadgeCount  int    `json:"ios_badgeCount"`
	MutableContent bool   `json:"mutable_content"`
	Priority       int    `json:"priority"`
}

// Text is one locale's rendering of a notification.
type Text struct {
	Title string
	Body  string
}

// Result is OneSignal's answer for one request, kept for diagnostics.
type Result struct {
	ID         string         `json:"id"`
	Recipients int            `json:"recipients"`
	Errors     any            `json:"errors,omitempty"`
	Raw        map[string]any `json:"raw"`
}

// SendLocalized sends each locale group of user ids its own translation.
// OneSignal keys content by language and needs "en" present as the fallback,
// so a locale with no translation is sent the English text.
func (c *OneSignalClient) SendLocalized(ctx context.Context, byLocale map[string][]string, texts map[string]Text, data map[string]any) ([]Result, error) {
	if !c.Enabled() {
		return nil, nil
	}
	fallback, hasFallback := texts["en"]
	if !hasFallback {
		for _, t := range texts { // any translation beats sending nothing
			fallback = t
			break
		}
	}

	var results []Result
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

		const batch = 2000
		for start := 0; start < len(ids); start += batch {
			end := min(start+batch, len(ids))
			payload := pushPayload{
				AppID:          c.appID,
				IncludeAliases: map[string][]string{"external_id": ids[start:end]},
				TargetChannel:  "push",
				Headings:       headings,
				Contents:       contents,
				Data:           data,
				IOSBadgeType:   "Increase",
				IOSBadgeCount:  1,
				MutableContent: true,
				Priority:       10,
			}
			res, err := c.post(ctx, payload)
			if err != nil {
				return results, err
			}
			results = append(results, res)
		}
	}
	return results, nil
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

func (c *OneSignalClient) authHeader() string {
	if strings.HasPrefix(c.apiKey, "os_v2_") {
		return "Key " + c.apiKey
	}
	return "Basic " + c.apiKey
}

func (c *OneSignalClient) post(ctx context.Context, payload pushPayload) (Result, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return Result{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, bytes.NewReader(raw))
	if err != nil {
		return Result{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", c.authHeader())

	res, err := c.http.Do(req)
	if err != nil {
		return Result{}, err
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(res.Body, 64<<10))
	if res.StatusCode >= 300 {
		snippet := body
		if len(snippet) > 512 {
			snippet = snippet[:512]
		}
		return Result{}, fmt.Errorf("onesignal: status %d: %s", res.StatusCode, snippet)
	}
	var out Result
	_ = json.Unmarshal(body, &out)
	_ = json.Unmarshal(body, &out.Raw)
	return out, nil
}
