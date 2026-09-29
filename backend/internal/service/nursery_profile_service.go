package service

import (
	"context"
	"regexp"
	"strings"

	"gorm.io/gorm"

	"github.com/sunnystars/backend/internal/database"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
)

var currencyCode = regexp.MustCompile(`^[A-Z]{3}$`)

// NurseryProfileService lets a nursery admin manage their own nursery's
// identity: name, logo, billing currency and the photo watermark.
type NurseryProfileService struct {
	db    *gorm.DB
	audit *AuditService
}

func NewNurseryProfileService(db *gorm.DB, audit *AuditService) *NurseryProfileService {
	return &NurseryProfileService{db: db, audit: audit}
}

type NurseryProfile struct {
	ID                uint64       `json:"id"`
	Name              string       `json:"name"`
	Currency          string       `json:"currency"`
	LogoMediaID       *uint64      `json:"logo_media_id"`
	Logo              *model.Media `json:"logo,omitempty"`
	WatermarkEnabled  bool         `json:"watermark_enabled"`
	WatermarkMediaID  *uint64      `json:"watermark_media_id"`
	Watermark         *model.Media `json:"watermark,omitempty"`
	WatermarkPosition string       `json:"watermark_position"`
	WatermarkOpacity  uint8        `json:"watermark_opacity"`
}

type UpdateNurseryProfileRequest struct {
	Name              *string `json:"name" validate:"omitempty,min=2,max=191"`
	Currency          *string `json:"currency" validate:"omitempty,len=3"`
	LogoMediaID       *uint64 `json:"logo_media_id"`
	WatermarkEnabled  *bool   `json:"watermark_enabled"`
	WatermarkMediaID  *uint64 `json:"watermark_media_id"`
	WatermarkPosition *string `json:"watermark_position" validate:"omitempty,oneof=bottom_right bottom_left top_right top_left center"`
	WatermarkOpacity  *uint8  `json:"watermark_opacity" validate:"omitempty,min=10,max=100"`
}

func (s *NurseryProfileService) nursery(ctx context.Context) (*model.Nursery, error) {
	id, ok := database.TenantFrom(ctx)
	if !ok || id == 0 {
		return nil, apperr.BadRequest("no nursery selected")
	}
	var n model.Nursery
	if err := s.db.WithContext(database.WithCrossTenant(ctx)).First(&n, id).Error; err != nil {
		return nil, apperr.NotFound("nursery not found")
	}
	return &n, nil
}

func (s *NurseryProfileService) media(ctx context.Context, id *uint64) *model.Media {
	if id == nil || *id == 0 {
		return nil
	}
	var m model.Media
	if err := s.db.WithContext(ctx).First(&m, *id).Error; err != nil {
		return nil
	}
	return &m
}

func (s *NurseryProfileService) Get(ctx context.Context) (*NurseryProfile, error) {
	n, err := s.nursery(ctx)
	if err != nil {
		return nil, err
	}
	return &NurseryProfile{
		ID: n.ID, Name: n.Name, Currency: n.Currency,
		LogoMediaID: n.LogoMediaID, Logo: s.media(ctx, n.LogoMediaID),
		WatermarkEnabled: n.WatermarkEnabled, WatermarkMediaID: n.WatermarkMediaID,
		Watermark:         s.media(ctx, n.WatermarkMediaID),
		WatermarkPosition: n.WatermarkPosition, WatermarkOpacity: n.WatermarkOpacity,
	}, nil
}

func (s *NurseryProfileService) Update(ctx context.Context, req *UpdateNurseryProfileRequest, actorID uint64, ip string) (*NurseryProfile, error) {
	n, err := s.nursery(ctx)
	if err != nil {
		return nil, err
	}
	updates := map[string]any{}
	if req.Name != nil {
		updates["name"] = strings.TrimSpace(*req.Name)
	}
	if req.Currency != nil {
		code := strings.ToUpper(strings.TrimSpace(*req.Currency))
		if !currencyCode.MatchString(code) {
			return nil, apperr.Validation(map[string]string{"currency": "must be a 3-letter ISO currency code"})
		}
		updates["currency"] = code
	}
	// Media ids must belong to this nursery; the tenant scope on s.media enforces it.
	if req.LogoMediaID != nil {
		if *req.LogoMediaID != 0 && s.media(ctx, req.LogoMediaID) == nil {
			return nil, apperr.Validation(map[string]string{"logo_media_id": "unknown image"})
		}
		updates["logo_media_id"] = nullableID(*req.LogoMediaID)
	}
	if req.WatermarkMediaID != nil {
		if *req.WatermarkMediaID != 0 && s.media(ctx, req.WatermarkMediaID) == nil {
			return nil, apperr.Validation(map[string]string{"watermark_media_id": "unknown image"})
		}
		updates["watermark_media_id"] = nullableID(*req.WatermarkMediaID)
	}
	if req.WatermarkEnabled != nil {
		updates["watermark_enabled"] = *req.WatermarkEnabled
	}
	if req.WatermarkPosition != nil {
		updates["watermark_position"] = *req.WatermarkPosition
	}
	if req.WatermarkOpacity != nil {
		updates["watermark_opacity"] = *req.WatermarkOpacity
	}
	if len(updates) > 0 {
		if err := s.db.WithContext(database.WithCrossTenant(ctx)).Model(n).Updates(updates).Error; err != nil {
			return nil, apperr.Internal(err)
		}
		s.audit.Record(ctx, actorID, "update", "nursery_profile", n.ID, updates, ip)
	}
	return s.Get(ctx)
}

func nullableID(id uint64) any {
	if id == 0 {
		return nil
	}
	return id
}

// NurseryCurrency returns the billing currency of the nursery in ctx.
func NurseryCurrency(ctx context.Context, db *gorm.DB) string {
	if id, ok := database.TenantFrom(ctx); ok && id != 0 {
		var n model.Nursery
		if err := db.WithContext(database.WithCrossTenant(ctx)).Select("currency").First(&n, id).Error; err == nil && n.Currency != "" {
			return n.Currency
		}
	}
	return "USD"
}
