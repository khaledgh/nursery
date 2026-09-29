package service

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"time"

	"github.com/rs/zerolog"
	"gorm.io/gorm"

	"github.com/sunnystars/backend/internal/database"
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

func (s *NotificationService) NotifyGuardians(ctx context.Context, childID uint64, category, title, body string, data map[string]any) {
	nurseryID, _ := database.TenantFrom(ctx)
	go s.deliver(ctx, func(ctx context.Context) ([]uint64, error) {
		var ids []uint64
		q := s.db.WithContext(ctx).Model(&model.Guardian{}).
			Joins("JOIN users ON users.id = guardians.parent_user_id AND users.status = 'active'").
			Where("guardians.child_id = ?", childID)
		if nurseryID != 0 {
			q = q.Where("users.nursery_id = ?", nurseryID)
		}
		err := q.Distinct().Pluck("guardians.parent_user_id", &ids).Error
		return ids, err
	}, category, title, body, data)
}

// NotifyClassroomGuardians resolves the whole classroom in one query. The
// per-child loop it replaces sent one HTTP request per child and notified a
// parent once for each of their children in the room.
func (s *NotificationService) NotifyClassroomGuardians(ctx context.Context, classroomID uint64, category, title, body string, data map[string]any) {
	nurseryID, _ := database.TenantFrom(ctx)
	go s.deliver(ctx, func(ctx context.Context) ([]uint64, error) {
		var ids []uint64
		q := s.db.WithContext(ctx).Model(&model.Guardian{}).
			Joins("JOIN children ON children.id = guardians.child_id").
			Joins("JOIN users ON users.id = guardians.parent_user_id AND users.status = 'active'").
			Where("children.classroom_id = ?", classroomID)
		if nurseryID != 0 {
			q = q.Where("users.nursery_id = ?", nurseryID)
		}
		err := q.Distinct().Pluck("guardians.parent_user_id", &ids).Error
		return ids, err
	}, category, title, body, data)
}

func (s *NotificationService) NotifyUser(ctx context.Context, userID uint64, category, title, body string, data map[string]any) {
	go s.deliver(ctx, func(ctx context.Context) ([]uint64, error) {
		return []uint64{userID}, nil
	}, category, title, body, data)
}

func (s *NotificationService) NotifyRole(ctx context.Context, role string, category, title, body string, data map[string]any) {
	nurseryID, _ := database.TenantFrom(ctx)
	if nurseryID == 0 && data != nil {
		if nidRaw, ok := data["nursery_id"]; ok {
			if nid, ok := nidRaw.(uint64); ok && nid != 0 {
				nurseryID = nid
				ctx = database.WithTenant(ctx, nid)
			}
		}
	}

	go s.deliver(ctx, func(ctx context.Context) ([]uint64, error) {
		var ids []uint64
		q := s.db.WithContext(ctx).Model(&model.User{}).Where("status = 'active'")
		if nurseryID != 0 {
			q = q.Where("nursery_id = ?", nurseryID)
		} else {
			// CRITICAL SAFETY GUARD: If there is no nursery scope at all, do NOT broadcast
			// across all nurseries. Refuse to leak notifications cross-tenant.
			s.log.Warn().Str("category", category).Str("title", title).
				Msg("NotifyRole called without a nursery scope; dropping broadcast to prevent cross-tenant notification leak")
			return nil, nil
		}
		if role != "" {
			q = q.Where("role = ?", role)
		}
		err := q.Pluck("id", &ids).Error
		return ids, err
	}, category, title, body, data)
}

// deliver runs in its own goroutine with a detached context so an aborted
// HTTP request doesn't cancel the send mid-flight.
//
// caller supplies the tenant scope: detaching from the request context would
// also drop the nursery, and an unscoped recipient lookup here would fan a
// broadcast out across every nursery on the platform.
func (s *NotificationService) deliver(caller context.Context, recipients func(context.Context) ([]uint64, error), category, title, body string, data map[string]any) {
	defer func() {
		if r := recover(); r != nil {
			s.log.Error().Any("panic", r).Msg("notification delivery panicked")
		}
	}()
	ctx, cancel := context.WithTimeout(database.CarryTenant(context.Background(), caller), sendTimeout)
	defer cancel()

	userIDs, err := recipients(ctx)
	if err != nil {
		s.log.Error().Err(err).Msg("notification recipient lookup failed")
		return
	}
	s.log.Debug().
		Str("category", category).
		Interface("user_ids", userIDs).
		Msg("Resolved notification recipients")

	if len(userIDs) == 0 {
		s.log.Debug().Msg("No recipients found for notification, skipping delivery")
		return
	}

	nurseryID, _ := database.TenantFrom(ctx)
	// Tenant isolation, enforced here for every notification path: when a
	// nursery sends something, only that nursery's users (the accounts issued
	// from its login-ID range) may receive it, whatever the caller passed in.
	if nurseryID != 0 {
		var allowed []uint64
		if err := s.db.WithContext(database.WithCrossTenant(ctx)).Model(&model.User{}).
			Where("id IN ? AND nursery_id = ?", userIDs, nurseryID).
			Pluck("id", &allowed).Error; err != nil {
			s.log.Error().Err(err).Msg("notification tenant check failed; not sending")
			return
		}
		if dropped := len(userIDs) - len(allowed); dropped > 0 {
			s.log.Warn().Uint64("nursery_id", nurseryID).Int("dropped", dropped).
				Msg("dropped notification recipients outside the sending nursery")
		}
		userIDs = allowed
		if len(userIDs) == 0 {
			return
		}
	}
	now := time.Now()
	dataJSON, _ := json.Marshal(data)

	// Build map of userID -> NurseryID to guarantee exact tenant stamping
	userNurseryMap := make(map[uint64]uint64, len(userIDs))
	if nurseryID != 0 {
		for _, uid := range userIDs {
			userNurseryMap[uid] = nurseryID
		}
	} else {
		type userNursery struct {
			ID        uint64
			NurseryID uint64
		}
		var unList []userNursery
		_ = s.db.WithContext(database.WithCrossTenant(ctx)).
			Model(&model.User{}).Where("id IN ?", userIDs).
			Select("id, nursery_id").Find(&unList).Error
		for _, un := range unList {
			userNurseryMap[un.ID] = un.NurseryID
		}
	}

	rows := make([]model.Notification, 0, len(userIDs))
	for _, uid := range userIDs {
		targetNurseryID := userNurseryMap[uid]
		rows = append(rows, model.Notification{
			TenantBase: model.TenantBase{NurseryID: targetNurseryID},
			UserID:     uid, Category: category, Title: title, Body: body,
			DataJSON: dataJSON, SentAt: &now,
		})
	}
	if err := s.db.WithContext(ctx).CreateInBatches(rows, 200).Error; err != nil {
		s.log.Error().Err(err).Msg("failed to store in-app notifications")
	}

	if !s.onesignal.Enabled() {
		s.log.Debug().Msg("OneSignal client is disabled (missing credentials), skipping push delivery")
		return
	}

	// Preferences are fetched in one query rather than one per recipient. The
	// loop this replaces issued a SELECT per user, which is tolerable for a
	// classroom but not for a nursery-wide broadcast — and far worse now that
	// several nurseries share the connection pool.
	settingsByUser := make(map[uint64]model.UserNotificationSetting, len(userIDs))
	var prefs []model.UserNotificationSetting
	if err := s.db.WithContext(ctx).
		Where("user_id IN ?", userIDs).Find(&prefs).Error; err != nil {
		s.log.Error().Err(err).Msg("notification preference lookup failed")
	}
	for _, p := range prefs {
		settingsByUser[p.UserID] = p
	}

	var pushUserIDs []uint64
	for _, uid := range userIDs {
		setting, found := settingsByUser[uid]
		// A missing row means the user has never changed their preferences,
		// which is opt-out semantics: everything stays enabled.
		if found {
			if !setting.PushEnabled {
				s.log.Debug().Uint64("user_id", uid).Msg("Skipping push: PushEnabled is false")
				continue
			}
			switch category {
			case model.CategoryMessages:
				if !setting.MessagesEnabled {
					s.log.Debug().Uint64("user_id", uid).Msg("Skipping push: MessagesEnabled is false")
					continue
				}
			case model.CategoryUpdates:
				if !setting.AnnouncementsEnabled {
					s.log.Debug().Uint64("user_id", uid).Msg("Skipping push: AnnouncementsEnabled is false")
					continue
				}
			case model.CategoryReminders:
				if !setting.RemindersEnabled {
					s.log.Debug().Uint64("user_id", uid).Msg("Skipping push: RemindersEnabled is false")
					continue
				}
			case model.CategoryEvents:
				if !setting.EventsEnabled {
					s.log.Debug().Uint64("user_id", uid).Msg("Skipping push: EventsEnabled is false")
					continue
				}
			}
		}
		pushUserIDs = append(pushUserIDs, uid)
	}

	s.log.Debug().
		Interface("push_user_ids", pushUserIDs).
		Msg("Filtered user IDs for push delivery")

	if len(pushUserIDs) == 0 {
		s.log.Debug().Msg("All recipient user IDs were filtered out, skipping push delivery")
		return
	}

	s.pushToUsers(ctx, pushUserIDs, title, body, data)
}

// pushToUsers sends to users by external id (set by the app via
// OneSignal.login), grouped by each user's language.
func (s *NotificationService) pushToUsers(ctx context.Context, userIDs []uint64, title, body string, data map[string]any) []notification.Result {
	var users []struct {
		ID     uint64
		Locale string
	}
	if err := s.db.WithContext(database.WithCrossTenant(ctx)).Model(&model.User{}).
		Select("id", "locale").Where("id IN ?", userIDs).Scan(&users).Error; err != nil {
		s.log.Error().Err(err).Msg("push recipient lookup failed")
		return nil
	}
	byLocale := make(map[string][]string, 2)
	for _, u := range users {
		byLocale[u.Locale] = append(byLocale[u.Locale], strconv.FormatUint(u.ID, 10))
	}
	if len(byLocale) == 0 {
		return nil
	}
	// Bodies are not translated yet, so every locale gets the same text; the
	// grouping is what lets that change without touching this call.
	texts := map[string]notification.Text{"en": {Title: title, Body: body}}
	results, err := s.onesignal.SendLocalized(ctx, byLocale, texts, data)
	if err != nil {
		s.log.Error().Err(err).Msg("onesignal push failed")
		return results
	}
	for _, r := range results {
		// OneSignal answers 200 even when nobody matched; surface that in the logs.
		if r.Errors != nil || r.Recipients == 0 {
			s.log.Warn().Interface("onesignal", r.Raw).Msg("onesignal push reached no device")
		}
	}
	return results
}

// TestPush sends a diagnostic push to one user and returns OneSignal's raw
// answer, so a superadmin can see whether the user's devices are subscribed.
func (s *NotificationService) TestPush(ctx context.Context, userID uint64) (map[string]any, error) {
	if !s.onesignal.Enabled() {
		return map[string]any{"enabled": false, "hint": "ONESIGNAL_APP_ID / ONESIGNAL_API_KEY are not set on the server"}, nil
	}
	results := s.pushToUsers(ctx, []uint64{userID}, "Nursee+ test 🔔",
		"If you can read this, push notifications work on this device.", map[string]any{"screen": "notifications"})
	return map[string]any{"enabled": true, "external_id": strconv.FormatUint(userID, 10), "results": results}, nil
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
