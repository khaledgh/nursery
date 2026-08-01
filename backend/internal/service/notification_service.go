package service

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/rs/zerolog"
	"gorm.io/gorm"

	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/notification"
)

// NotificationService is the production Notifier: every send writes an
// in-app notification row and (if configured) a OneSignal push. Sends are
// fire-and-forget — they never fail or slow the triggering request.
type NotificationService struct {
	db        *gorm.DB
	onesignal *notification.OneSignalClient
	log       zerolog.Logger
}

func NewNotificationService(db *gorm.DB, onesignal *notification.OneSignalClient, log zerolog.Logger) *NotificationService {
	return &NotificationService{db: db, onesignal: onesignal, log: log}
}

const sendTimeout = 15 * time.Second

func (s *NotificationService) NotifyGuardians(_ context.Context, childID uint64, category, title, body string, data map[string]any) {
	go s.deliver(func(ctx context.Context) ([]uint64, error) {
		var ids []uint64
		err := s.db.WithContext(ctx).Model(&model.Guardian{}).
			Joins("JOIN users ON users.id = guardians.parent_user_id AND users.status = 'active'").
			Where("guardians.child_id = ?", childID).
			Distinct().Pluck("guardians.parent_user_id", &ids).Error
		return ids, err
	}, category, title, body, data)
}

// NotifyClassroomGuardians resolves the whole classroom in one query. The
// per-child loop it replaces sent one HTTP request per child and notified a
// parent once for each of their children in the room.
func (s *NotificationService) NotifyClassroomGuardians(_ context.Context, classroomID uint64, category, title, body string, data map[string]any) {
	go s.deliver(func(ctx context.Context) ([]uint64, error) {
		var ids []uint64
		err := s.db.WithContext(ctx).Model(&model.Guardian{}).
			Joins("JOIN children ON children.id = guardians.child_id").
			Joins("JOIN users ON users.id = guardians.parent_user_id AND users.status = 'active'").
			Where("children.classroom_id = ?", classroomID).
			Distinct().Pluck("guardians.parent_user_id", &ids).Error
		return ids, err
	}, category, title, body, data)
}

func (s *NotificationService) NotifyUser(_ context.Context, userID uint64, category, title, body string, data map[string]any) {
	go s.deliver(func(ctx context.Context) ([]uint64, error) {
		return []uint64{userID}, nil
	}, category, title, body, data)
}

func (s *NotificationService) NotifyRole(_ context.Context, role string, category, title, body string, data map[string]any) {
	go s.deliver(func(ctx context.Context) ([]uint64, error) {
		var ids []uint64
		q := s.db.WithContext(ctx).Model(&model.User{}).Where("status = 'active'")
		if role != "" {
			q = q.Where("role = ?", role)
		}
		err := q.Pluck("id", &ids).Error
		return ids, err
	}, category, title, body, data)
}

// deliver runs in its own goroutine with a detached context so an aborted
// HTTP request doesn't cancel the send mid-flight.
func (s *NotificationService) deliver(recipients func(context.Context) ([]uint64, error), category, title, body string, data map[string]any) {
	defer func() {
		if r := recover(); r != nil {
			s.log.Error().Any("panic", r).Msg("notification delivery panicked")
		}
	}()
	ctx, cancel := context.WithTimeout(context.Background(), sendTimeout)
	defer cancel()

	userIDs, err := recipients(ctx)
	if err != nil {
		s.log.Error().Err(err).Msg("notification recipient lookup failed")
		return
	}
	if len(userIDs) == 0 {
		return
	}

	now := time.Now()
	dataJSON, _ := json.Marshal(data)
	rows := make([]model.Notification, 0, len(userIDs))
	for _, uid := range userIDs {
		rows = append(rows, model.Notification{
			UserID: uid, Category: category, Title: title, Body: body,
			DataJSON: dataJSON, SentAt: &now,
		})
	}
	if err := s.db.WithContext(ctx).CreateInBatches(rows, 200).Error; err != nil {
		s.log.Error().Err(err).Msg("failed to store in-app notifications")
	}

	if !s.onesignal.Enabled() {
		return
	}

	// Filter userIDs based on user_notification_settings preferences
	var pushUserIDs []uint64
	for _, uid := range userIDs {
		var setting model.UserNotificationSetting
		err := s.db.WithContext(ctx).Where("user_id = ?", uid).First(&setting).Error
		if err == nil {
			if !setting.PushEnabled {
				continue
			}
			switch category {
			case model.CategoryMessages:
				if !setting.MessagesEnabled {
					continue
				}
			case model.CategoryUpdates:
				if !setting.AnnouncementsEnabled {
					continue
				}
			case model.CategoryReminders:
				if !setting.RemindersEnabled {
					continue
				}
			case model.CategoryEvents:
				if !setting.EventsEnabled {
					continue
				}
			}
		}
		pushUserIDs = append(pushUserIDs, uid)
	}

	if len(pushUserIDs) == 0 {
		return
	}

	// Grouped by locale so OneSignal delivers in the recipient's language rather
	// than labelling every push as English.
	var devices []struct {
		OneSignalPlayerID string
		Locale            string
	}
	if err := s.db.WithContext(ctx).Model(&model.DeviceToken{}).
		Select("one_signal_player_id", "locale").
		Where("user_id IN ?", pushUserIDs).
		Scan(&devices).Error; err != nil {
		s.log.Error().Err(err).Msg("device token lookup failed")
		return
	}
	byLocale := make(map[string][]string, 2)
	for _, d := range devices {
		byLocale[d.Locale] = append(byLocale[d.Locale], d.OneSignalPlayerID)
	}
	if len(byLocale) == 0 {
		return
	}
	// Bodies are not translated yet, so every locale gets the same text; the
	// grouping is what lets that change without touching this call.
	texts := map[string]notification.Text{"en": {Title: title, Body: body}}
	if err := s.onesignal.SendLocalized(ctx, byLocale, texts, data); err != nil {
		s.log.Error().Err(err).Msg("onesignal push failed")
	}
}

func (s *NotificationService) GetUserSettings(ctx context.Context, userID uint64) (*model.UserNotificationSetting, error) {
	var setting model.UserNotificationSetting
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).First(&setting).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			setting = model.UserNotificationSetting{
				UserID:               userID,
				PushEnabled:          true,
				MessagesEnabled:      true,
				AnnouncementsEnabled: true,
				RemindersEnabled:     true,
				EventsEnabled:        true,
			}
			_ = s.db.WithContext(ctx).Create(&setting).Error
			return &setting, nil
		}
		return nil, err
	}
	return &setting, nil
}

func (s *NotificationService) UpdateUserSettings(ctx context.Context, setting *model.UserNotificationSetting) error {
	return s.db.WithContext(ctx).
		Where("user_id = ?", setting.UserID).
		Assign(setting).
		FirstOrCreate(setting).Error
}

