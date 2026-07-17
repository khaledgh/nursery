// Package notification wraps the OneSignal REST API.
package notification

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const oneSignalEndpoint = "https://onesignal.com/api/v1/notifications"

// OneSignalClient sends push notifications. A client with empty credentials
// is a configured no-op (Enabled() == false), so the app runs without keys.
type OneSignalClient struct {
	appID  string
	apiKey string
	http   *http.Client
}

func NewOneSignalClient(appID, apiKey string) *OneSignalClient {
	return &OneSignalClient{
		appID:  appID,
		apiKey: apiKey,
		http:   &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *OneSignalClient) Enabled() bool { return c.appID != "" && c.apiKey != "" }

type pushPayload struct {
	AppID            string            `json:"app_id"`
	IncludePlayerIDs []string          `json:"include_player_ids"`
	Headings         map[string]string `json:"headings"`
	Contents         map[string]string `json:"contents"`
	Data             map[string]any    `json:"data,omitempty"`
}

// SendToPlayers pushes title/body to specific OneSignal player ids.
// localized maps locale → body translation; "en" is the fallback OneSignal requires.
func (c *OneSignalClient) SendToPlayers(ctx context.Context, playerIDs []string, title, body string, data map[string]any) error {
	if !c.Enabled() || len(playerIDs) == 0 {
		return nil
	}
	// OneSignal caps include_player_ids at 2000 per request.
	const batch = 2000
	for start := 0; start < len(playerIDs); start += batch {
		end := min(start+batch, len(playerIDs))
		payload := pushPayload{
			AppID:            c.appID,
			IncludePlayerIDs: playerIDs[start:end],
			Headings:         map[string]string{"en": title},
			Contents:         map[string]string{"en": body},
			Data:             data,
		}
		if err := c.post(ctx, payload); err != nil {
			return err
		}
	}
	return nil
}

func (c *OneSignalClient) post(ctx context.Context, payload pushPayload) error {
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, oneSignalEndpoint, bytes.NewReader(raw))
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
