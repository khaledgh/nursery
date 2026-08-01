package main

import (
	"fmt"
	"log"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"

	"github.com/sunnystars/backend/internal/config"
	"github.com/sunnystars/backend/internal/model"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Load config failed: %v", err)
	}

	db, err := gorm.Open(mysql.Open(cfg.DB.DSN()), &gorm.Config{})
	if err != nil {
		log.Fatalf("Connect to DB failed: %v", err)
	}

	var devices []model.DeviceToken
	if err := db.Find(&devices).Error; err != nil {
		log.Fatalf("Find devices failed: %v", err)
	}

	fmt.Println("--- Registered Devices ---")
	for _, d := range devices {
		fmt.Printf("User ID: %d, Player ID: %s, Platform: %s, Locale: %s, Last Seen: %v\n", d.UserID, d.OneSignalPlayerID, d.Platform, d.Locale, d.LastSeenAt)
	}

	var settings []model.UserNotificationSetting
	if err := db.Find(&settings).Error; err != nil {
		log.Fatalf("Find settings failed: %v", err)
	}

	fmt.Println("\n--- User Notification Settings ---")
	for _, s := range settings {
		fmt.Printf("User ID: %d, Push: %t, Msg: %t, Ann: %t, Rem: %t, Evt: %t\n", s.UserID, s.PushEnabled, s.MessagesEnabled, s.AnnouncementsEnabled, s.RemindersEnabled, s.EventsEnabled)
	}
}
