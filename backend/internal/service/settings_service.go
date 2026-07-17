package service

import (
	"context"
	"encoding/json"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/sunnystars/backend/internal/dto"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
)

// settingValidators whitelists editable settings and validates their values.
// Secrets (S3 keys, OneSignal API key, Swish certs) stay in .env only — the
// settings API must never become a secret store readable by the admin UI.
var settingValidators = map[string]func(v any) bool{
	"storage_driver": func(v any) bool {
		s, ok := v.(string)
		return ok && (s == "local" || s == "s3")
	},
	"default_locale": func(v any) bool {
		s, ok := v.(string)
		return ok && len(s) >= 2 && len(s) <= 10
	},
	"nursery_name": func(v any) bool {
		s, ok := v.(string)
		return ok && len(s) <= 191
	},
	"feature_community": func(v any) bool { _, ok := v.(bool); return ok },
	"feature_payments":  func(v any) bool { _, ok := v.(bool); return ok },
}

type SettingsService struct {
	db    *gorm.DB
	audit *AuditService
}

func NewSettingsService(db *gorm.DB, audit *AuditService) *SettingsService {
	return &SettingsService{db: db, audit: audit}
}

func (s *SettingsService) All(ctx context.Context) (map[string]any, error) {
	var rows []model.Setting
	if err := s.db.WithContext(ctx).Find(&rows).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	out := map[string]any{}
	for _, r := range rows {
		var v any
		if err := json.Unmarshal(r.ValueJSON, &v); err == nil {
			out[r.Key] = v
		}
	}
	return out, nil
}

func (s *SettingsService) Update(ctx context.Context, updates map[string]any, actorID uint64, ip string) error {
	for key, value := range updates {
		validate, ok := settingValidators[key]
		if !ok {
			return apperr.BadRequest("unknown or non-editable setting: " + key)
		}
		if !validate(value) {
			return apperr.BadRequest("invalid value for setting: " + key)
		}
	}
	for key, value := range updates {
		raw, err := json.Marshal(value)
		if err != nil {
			return apperr.Internal(err)
		}
		row := &model.Setting{Key: key, ValueJSON: raw}
		if err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "key"}},
			DoUpdates: clause.AssignmentColumns([]string{"value_json", "updated_at"}),
		}).Create(row).Error; err != nil {
			return apperr.Internal(err)
		}
	}
	s.audit.Record(ctx, actorID, "update", "settings", 0, updates, ip)
	return nil
}

// ---- audit log queries (admin) ----

type AuditQuery struct {
	dto.PageQuery
	Entity string `query:"entity"`
	Actor  uint64 `query:"actor"`
}

func (s *SettingsService) AuditLogs(ctx context.Context, q AuditQuery) ([]model.AuditLog, int64, error) {
	var (
		logs  []model.AuditLog
		total int64
	)
	tx := s.db.WithContext(ctx).Model(&model.AuditLog{})
	if q.Entity != "" {
		tx = tx.Where("entity = ?", q.Entity)
	}
	if q.Actor != 0 {
		tx = tx.Where("actor_user_id = ?", q.Actor)
	}
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, apperr.Internal(err)
	}
	if err := tx.Order("id DESC").Limit(q.PerPage).Offset(q.Offset()).Find(&logs).Error; err != nil {
		return nil, 0, apperr.Internal(err)
	}
	return logs, total, nil
}

// ---- locale management (admin) ----

type LocaleAdminService struct {
	db      *gorm.DB
	locales *LocaleService
	audit   *AuditService
}

func NewLocaleAdminService(db *gorm.DB, locales *LocaleService, audit *AuditService) *LocaleAdminService {
	return &LocaleAdminService{db: db, locales: locales, audit: audit}
}

func (s *LocaleAdminService) Upsert(ctx context.Context, loc *model.Locale, actorID uint64, ip string) error {
	if loc.Direction != "rtl" {
		loc.Direction = "ltr"
	}
	err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "code"}},
		DoUpdates: clause.AssignmentColumns([]string{"name", "native_name", "direction", "is_active", "is_default", "sort_order"}),
	}).Create(loc).Error
	if err != nil {
		return apperr.Internal(err)
	}
	if loc.IsDefault {
		// Exactly one default locale at a time.
		if err := s.db.WithContext(ctx).Model(&model.Locale{}).
			Where("code <> ?", loc.Code).Update("is_default", false).Error; err != nil {
			return apperr.Internal(err)
		}
	}
	s.locales.Invalidate()
	s.audit.Record(ctx, actorID, "upsert", "locale", 0, map[string]any{"code": loc.Code}, ip)
	return nil
}

func (s *LocaleAdminService) Delete(ctx context.Context, code string, actorID uint64, ip string) error {
	var loc model.Locale
	if err := s.db.WithContext(ctx).First(&loc, "code = ?", code).Error; err != nil {
		return apperr.NotFound("locale not found")
	}
	if loc.IsDefault {
		return apperr.Conflict("the default locale cannot be deleted")
	}
	if err := s.db.WithContext(ctx).Delete(&loc).Error; err != nil {
		return apperr.Internal(err)
	}
	s.locales.Invalidate()
	s.audit.Record(ctx, actorID, "delete", "locale", 0, map[string]any{"code": code}, ip)
	return nil
}
