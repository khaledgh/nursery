package service

import (
	"context"
	"encoding/json"

	"github.com/rs/zerolog"
	"gorm.io/gorm"

	"github.com/sunnystars/backend/internal/model"
)

// AuditService records every admin/teacher mutation. Failures are logged but
// never fail the request that triggered them.
type AuditService struct {
	db  *gorm.DB
	log zerolog.Logger
}

func NewAuditService(db *gorm.DB, log zerolog.Logger) *AuditService {
	return &AuditService{db: db, log: log}
}

func (s *AuditService) Record(ctx context.Context, actorID uint64, action, entity string, entityID uint64, diff any, ip string) {
	var diffJSON []byte
	if diff != nil {
		diffJSON, _ = json.Marshal(diff)
	}
	entry := &model.AuditLog{
		ActorUserID: actorID,
		Action:      action,
		Entity:      entity,
		EntityID:    entityID,
		DiffJSON:    diffJSON,
		IP:          ip,
	}
	if err := s.db.WithContext(ctx).Create(entry).Error; err != nil {
		s.log.Error().Err(err).Str("entity", entity).Str("action", action).Msg("audit log write failed")
	}
}
