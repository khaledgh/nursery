package service

import (
	"context"
	"encoding/json"
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
			Where("child_id = ?", childID).Pluck("parent_user_id", &ids).Error
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
	var playerIDs []string
	if err := s.db.WithContext(ctx).Model(&model.DeviceToken{}).
		Where("user_id IN ?", userIDs).
		Pluck("one_signal_player_id", &playerIDs).Error; err != nil {
		s.log.Error().Err(err).Msg("device token lookup failed")
		return
	}
	if err := s.onesignal.SendToPlayers(ctx, playerIDs, title, body, data); err != nil {
		s.log.Error().Err(err).Msg("onesignal push failed")
	}
}
