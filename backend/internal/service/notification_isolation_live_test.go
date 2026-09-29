package service

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/sunnystars/backend/internal/database"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/notification"
)

// A notification sent by one nursery must never reach another nursery's users,
// even if the caller hands over a foreign user id.
//
// Requires TEST_DSN pointing at a disposable database, e.g.
//
//	TEST_DSN='root:@tcp(127.0.0.1:3306)/nursery_notify_isolation?parseTime=true'
func TestNotificationsStayInsideTheSendingNursery(t *testing.T) {
	dsn := os.Getenv("TEST_DSN")
	if dsn == "" {
		t.Skip("TEST_DSN not set")
	}
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{Logger: logger.Discard})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.Notification{}, &model.UserNotificationSetting{}); err != nil {
		t.Fatal(err)
	}
	db.Exec("DELETE FROM notifications")
	db.Exec("DELETE FROM users")

	mine := model.User{NurseryID: 1, Name: "Mine", Email: "a@x.io", PasswordHash: "x", Role: model.RoleParent, Status: model.UserActive}
	other := model.User{NurseryID: 2, Name: "Other", Email: "b@x.io", PasswordHash: "x", Role: model.RoleParent, Status: model.UserActive}
	if err := db.Create(&mine).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&other).Error; err != nil {
		t.Fatal(err)
	}

	svc := NewNotificationService(db, notification.NewOneSignalClient("", ""), zerolog.Nop())
	ctx := database.WithTenant(context.Background(), 1)
	svc.deliver(ctx, func(context.Context) ([]uint64, error) {
		return []uint64{mine.ID, other.ID}, nil // a buggy caller passes a foreign user
	}, model.CategoryUpdates, "Hello", "Nursery 1 news", nil)

	deadline := time.Now().Add(3 * time.Second)
	var rows []model.Notification
	for time.Now().Before(deadline) {
		db.Find(&rows)
		if len(rows) > 0 {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	if len(rows) != 1 || rows[0].UserID != mine.ID || rows[0].NurseryID != 1 {
		t.Fatalf("got %d notification(s) %+v; want exactly one for the nursery-1 user", len(rows), rows)
	}
}
