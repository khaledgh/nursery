package service

import (
	"context"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/sunnystars/backend/internal/database"
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

func (s *NotificationCenterService) userNurseryID(ctx context.Context, userID uint64) uint64 {
	if tid, ok := database.TenantFrom(ctx); ok && tid != 0 {
		return tid
	}
	var u model.User
	if err := s.db.WithContext(database.WithCrossTenant(ctx)).
		Select("id, nursery_id").First(&u, userID).Error; err == nil {
		return u.NurseryID
	}
	return 0
}

func (s *NotificationCenterService) List(ctx context.Context, userID uint64, category string, q dto.PageQuery) ([]model.Notification, int64, error) {
	var (
		items []model.Notification
		total int64
	)
	tx := s.db.WithContext(ctx).Model(&model.Notification{}).Where("user_id = ?", userID)
	if nid := s.userNurseryID(ctx, userID); nid != 0 {
		tx = tx.Where("nursery_id = ?", nid)
	}
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
	tx := s.db.WithContext(ctx).Model(&model.Notification{}).
		Where("user_id = ? AND read_at IS NULL", userID)
	if nid := s.userNurseryID(ctx, userID); nid != 0 {
		tx = tx.Where("nursery_id = ?", nid)
	}
	if err := tx.Count(&n).Error; err != nil {
		return 0, apperr.Internal(err)
	}
	return n, nil
}

// screenScope limits unread notifications to one app section (the "screen" in
// their data) and, optionally, one child — notifications without a child_id
// (announcements, events…) apply to every child.
func (s *NotificationCenterService) unreadScope(ctx context.Context, userID, childID uint64) *gorm.DB {
	tx := s.db.WithContext(ctx).Model(&model.Notification{}).
		Where("user_id = ? AND read_at IS NULL", userID)
	if nid := s.userNurseryID(ctx, userID); nid != 0 {
		tx = tx.Where("nursery_id = ?", nid)
	}
	if childID != 0 {
		tx = tx.Where("(JSON_EXTRACT(data_json, '$.child_id') IS NULL OR JSON_EXTRACT(data_json, '$.child_id') = ?)", childID)
	}
	return tx
}

// UnreadSummary counts unread notifications per app section, for the badges
// on the home screen icons.
func (s *NotificationCenterService) UnreadSummary(ctx context.Context, userID, childID uint64) (map[string]any, error) {
	type row struct {
		Screen string
		N      int64
	}
	var rows []row
	err := s.unreadScope(ctx, userID, childID).
		Select("COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.screen')), '') AS screen, COUNT(*) AS n").
		Group("screen").Scan(&rows).Error
	if err != nil {
		return nil, apperr.Internal(err)
	}
	byScreen := map[string]int64{}
	var total int64
	for _, r := range rows {
		total += r.N
		if r.Screen != "" {
			byScreen[r.Screen] = r.N
		}
	}
	return map[string]any{"total": total, "by_screen": byScreen}, nil
}

// MarkScreenRead clears the badge of one section once the user opens it.
func (s *NotificationCenterService) MarkScreenRead(ctx context.Context, userID uint64, screen string, childID uint64) error {
	err := s.unreadScope(ctx, userID, childID).
		Where("JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.screen')) = ?", screen).
		Update("read_at", time.Now()).Error
	if err != nil {
		return apperr.Internal(err)
	}
	return nil
}

func (s *NotificationCenterService) MarkAllRead(ctx context.Context, userID uint64) error {
	now := time.Now()
	tx := s.db.WithContext(ctx).Model(&model.Notification{}).
		Where("user_id = ? AND read_at IS NULL", userID)
	if nid := s.userNurseryID(ctx, userID); nid != 0 {
		tx = tx.Where("nursery_id = ?", nid)
	}
	if err := tx.Update("read_at", now).Error; err != nil {
		return apperr.Internal(err)
	}
	return nil
}

func (s *NotificationCenterService) MarkRead(ctx context.Context, userID, id uint64) error {
	now := time.Now()
	tx := s.db.WithContext(ctx).Model(&model.Notification{}).
		Where("id = ? AND user_id = ?", id, userID)
	if nid := s.userNurseryID(ctx, userID); nid != 0 {
		tx = tx.Where("nursery_id = ?", nid)
	}
	res := tx.Update("read_at", now)
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
