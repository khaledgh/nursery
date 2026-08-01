package main

import (
	"context"
	"fmt"
	"log"

	"github.com/sunnystars/backend/internal/config"
	"github.com/sunnystars/backend/internal/notification"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Load config failed: %v", err)
	}

	fmt.Printf("Loaded ONESIGNAL_APP_ID: %q\n", cfg.OneSig.AppID)
	if cfg.OneSig.AppID == "" || cfg.OneSig.APIKey == "" {
		log.Fatal("ONESIGNAL_APP_ID or ONESIGNAL_API_KEY is empty in backend .env!")
	}

	client := notification.NewOneSignalClient(cfg.OneSig.AppID, cfg.OneSig.APIKey)
	playerID := "f35e313e-20eb-4c1f-a949-c7fc3b906381"

	fmt.Printf("Sending test notification to Player ID: %s...\n", playerID)
	err = client.SendToPlayers(context.Background(), []string{playerID}, "Test Push Alert", "This is a direct test of the notification system!", map[string]any{
		"url":    "/notifications",
		"screen": "notifications",
	})

	if err != nil {
		log.Fatalf("OneSignal API Error: %v", err)
	}

	fmt.Println("OneSignal API accepted the request successfully!")
}
