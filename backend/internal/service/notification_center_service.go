package service

import (
	"context"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/sunnystars/backend/internal/dto"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
)

// NotificationCenterService backs the in-app notification list and device
// (OneSignal player id) registration.
type NotificationCenterService struct {
	db *gorm.DB
}

func NewNotificationCenterService(db *gorm.DB) *NotificationCenterService {
	return &NotificationCenterService{db: db}
}

func (s *NotificationCenterService) List(ctx context.Context, userID uint64, category string, q dto.PageQuery) ([]model.Notification, int64, error) {
	var (
		items []model.Notification
		total int64
	)
	tx := s.db.WithContext(ctx).Model(&model.Notification{}).Where("user_id = ?", userID)
	if category != "" {
		tx = tx.Where("category = ?", category)
	}
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, apperr.Internal(err)
	}
	if err := tx.Order("created_at DESC").Limit(q.PerPage).Offset(q.Offset()).Find(&items).Error; err != nil {
		return nil, 0, apperr.Internal(err)
	}
	return items, total, nil
}

func (s *NotificationCenterService) UnreadCount(ctx context.Context, userID uint64) (int64, error) {
	var n int64
	err := s.db.WithContext(ctx).Model(&model.Notification{}).
		Where("user_id = ? AND read_at IS NULL", userID).Count(&n).Error
	if err != nil {
		return 0, apperr.Internal(err)
	}
	return n, nil
}

func (s *NotificationCenterService) MarkAllRead(ctx context.Context, userID uint64) error {
	now := time.Now()
	err := s.db.WithContext(ctx).Model(&model.Notification{}).
		Where("user_id = ? AND read_at IS NULL", userID).Update("read_at", now).Error
	if err != nil {
		return apperr.Internal(err)
	}
	return nil
}

func (s *NotificationCenterService) MarkRead(ctx context.Context, userID, id uint64) error {
	now := time.Now()
	res := s.db.WithContext(ctx).Model(&model.Notification{}).
		Where("id = ? AND user_id = ?", id, userID).Update("read_at", now)
	if res.Error != nil {
		return apperr.Internal(res.Error)
	}
	if res.RowsAffected == 0 {
		return apperr.NotFound("notification not found")
	}
	return nil
}

// RegisterDevice upserts the OneSignal player id for push targeting.
func (s *NotificationCenterService) RegisterDevice(ctx context.Context, userID uint64, req *dto.RegisterDeviceRequest) error {
	now := time.Now()
	dt := &model.DeviceToken{
		UserID:            userID,
		OneSignalPlayerID: req.OneSignalPlayerID,
		Platform:          req.Platform,
		Locale:            req.Locale,
		LastSeenAt:        &now,
	}
	err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "one_signal_player_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"user_id", "platform", "locale", "last_seen_at", "updated_at"}),
	}).Create(dt).Error
	if err != nil {
		return apperr.Internal(err)
	}
	return nil
}

func (s *NotificationCenterService) UnregisterDevice(ctx context.Context, userID uint64, playerID string) error {
	return s.db.WithContext(ctx).
		Where("user_id = ? AND one_signal_player_id = ?", userID, playerID).
		Delete(&model.DeviceToken{}).Error
}
