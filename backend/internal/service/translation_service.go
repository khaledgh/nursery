package service

import (
	"context"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
)

// translatableEntities whitelists what admins may attach content
// translations to (and the fields per entity).
var translatableEntities = map[string]map[string]bool{
	"event":                {"title": true, "description": true, "location": true},
	"announcement":         {"title": true, "body": true},
	"reminder":             {"title": true, "description": true},
	"weekly_menu":          {"dish_name": true},
	"milestone_category":   {"name": true, "description": true},
	"achievement_template": {"title": true, "description": true},
	"classroom":            {"name": true},
	"invoice_item":         {"label": true},
}

type TranslationService struct {
	db      *gorm.DB
	locales *LocaleService
}

func NewTranslationService(db *gorm.DB, locales *LocaleService) *TranslationService {
	return &TranslationService{db: db, locales: locales}
}

// ---- Layer A: UI bundles ----

// UIBundle returns {namespace: {key: value}} for one locale.
func (s *TranslationService) UIBundle(ctx context.Context, locale string) (map[string]map[string]string, error) {
	var rows []model.UITranslation
	if err := s.db.WithContext(ctx).Where("locale = ?", locale).Find(&rows).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	bundle := map[string]map[string]string{}
	for _, r := range rows {
		ns, ok := bundle[r.Namespace]
		if !ok {
			ns = map[string]string{}
			bundle[r.Namespace] = ns
		}
		ns[r.Key] = r.Value
	}
	return bundle, nil
}

func (s *TranslationService) UpsertUI(ctx context.Context, locale, namespace, key, value string) error {
	if !s.locales.IsActive(locale) {
		return apperr.BadRequest("unknown or inactive locale: " + locale)
	}
	row := &model.UITranslation{Locale: locale, Namespace: namespace, Key: key, Value: value}
	err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "locale"}, {Name: "namespace"}, {Name: "key"}},
		DoUpdates: clause.AssignmentColumns([]string{"value"}),
	}).Create(row).Error
	if err != nil {
		return apperr.Internal(err)
	}
	return nil
}

func (s *TranslationService) DeleteUI(ctx context.Context, id uint64) error {
	res := s.db.WithContext(ctx).Delete(&model.UITranslation{}, id)
	if res.Error != nil {
		return apperr.Internal(res.Error)
	}
	if res.RowsAffected == 0 {
		return apperr.NotFound("translation not found")
	}
	return nil
}

func (s *TranslationService) ListUI(ctx context.Context, locale, namespace string) ([]model.UITranslation, error) {
	var rows []model.UITranslation
	tx := s.db.WithContext(ctx)
	if locale != "" {
		tx = tx.Where("locale = ?", locale)
	}
	if namespace != "" {
		tx = tx.Where("namespace = ?", namespace)
	}
	if err := tx.Order("namespace, `key`, locale").Limit(2000).Find(&rows).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	return rows, nil
}

// ---- Layer B: content translations ----

func (s *TranslationService) UpsertContent(ctx context.Context, entityType string, entityID uint64, locale, field, value string) error {
	fields, ok := translatableEntities[entityType]
	if !ok {
		return apperr.BadRequest("entity is not translatable: " + entityType)
	}
	if !fields[field] {
		return apperr.BadRequest("field is not translatable: " + field)
	}
	if !s.locales.IsActive(locale) {
		return apperr.BadRequest("unknown or inactive locale: " + locale)
	}
	row := &model.ContentTranslation{EntityType: entityType, EntityID: entityID, Locale: locale, Field: field, Value: value}
	err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "entity_type"}, {Name: "entity_id"}, {Name: "locale"}, {Name: "field"}},
		DoUpdates: clause.AssignmentColumns([]string{"value"}),
	}).Create(row).Error
	if err != nil {
		return apperr.Internal(err)
	}
	return nil
}

func (s *TranslationService) ListContent(ctx context.Context, entityType string, entityID uint64) ([]model.ContentTranslation, error) {
	var rows []model.ContentTranslation
	tx := s.db.WithContext(ctx).Where("entity_type = ?", entityType)
	if entityID != 0 {
		tx = tx.Where("entity_id = ?", entityID)
	}
	if err := tx.Order("entity_id, field, locale").Limit(2000).Find(&rows).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	return rows, nil
}

// FetchMap returns entity_id → field → translated value for one locale, used
// by list endpoints to localize responses in a single extra query.
func (s *TranslationService) FetchMap(ctx context.Context, entityType string, ids []uint64, locale string) map[uint64]map[string]string {
	out := map[uint64]map[string]string{}
	if len(ids) == 0 {
		return out
	}
	var rows []model.ContentTranslation
	if err := s.db.WithContext(ctx).
		Where("entity_type = ? AND entity_id IN ? AND locale = ?", entityType, ids, locale).
		Find(&rows).Error; err != nil {
		return out // localization is best-effort; fall back to source text
	}
	for _, r := range rows {
		m, ok := out[r.EntityID]
		if !ok {
			m = map[string]string{}
			out[r.EntityID] = m
		}
		m[r.Field] = r.Value
	}
	return out
}
