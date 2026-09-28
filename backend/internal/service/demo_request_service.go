package service

import (
	"context"
	"strings"

	"gorm.io/gorm"

	"github.com/sunnystars/backend/internal/database"
	"github.com/sunnystars/backend/internal/dto"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
)

type DemoRequestService struct {
	db    *gorm.DB
	audit *AuditService
}

func NewDemoRequestService(db *gorm.DB, audit *AuditService) *DemoRequestService {
	return &DemoRequestService{db: db, audit: audit}
}

// Demo requests are platform-global; the public insert has no tenant at all.
func (s *DemoRequestService) ctx(ctx context.Context) context.Context {
	return database.WithCrossTenant(ctx)
}

func trimOrNil(v string) *string {
	v = strings.TrimSpace(v)
	if v == "" {
		return nil
	}
	return &v
}

func (s *DemoRequestService) Create(ctx context.Context, req *dto.CreateDemoRequest, ip, userAgent string) (*model.DemoRequest, error) {
	locale := req.Locale
	if locale == "" {
		locale = "en"
	}
	row := model.DemoRequest{
		FullName:             strings.TrimSpace(req.FullName),
		NurseryName:          strings.TrimSpace(req.NurseryName),
		Email:                strings.ToLower(strings.TrimSpace(req.Email)),
		Phone:                strings.TrimSpace(req.Phone),
		City:                 trimOrNil(req.City),
		Country:              trimOrNil(req.Country),
		ChildrenRange:        trimOrNil(req.ChildrenRange),
		PreferredContactTime: trimOrNil(req.PreferredContactTime),
		Message:              trimOrNil(req.Message),
		Locale:               locale,
		Status:               model.DemoRequestNew,
		IPAddress:            trimOrNil(ip),
		UserAgent:            trimOrNil(truncate(userAgent, 254)),
	}
	if err := s.db.WithContext(s.ctx(ctx)).Create(&row).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	return &row, nil
}

func (s *DemoRequestService) List(ctx context.Context, q dto.PageQuery) ([]model.DemoRequest, int64, error) {
	tx := s.db.WithContext(s.ctx(ctx)).Model(&model.DemoRequest{})
	if q.Status != "" && q.Status != "all" {
		tx = tx.Where("status = ?", q.Status)
	}
	if term := strings.TrimSpace(q.Search); term != "" {
		like := "%" + term + "%"
		tx = tx.Where("full_name LIKE ? OR nursery_name LIKE ? OR email LIKE ? OR phone LIKE ?", like, like, like, like)
	}
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, apperr.Internal(err)
	}
	var rows []model.DemoRequest
	if err := tx.Order("created_at DESC").
		Offset((q.Page - 1) * q.PerPage).Limit(q.PerPage).Find(&rows).Error; err != nil {
		return nil, 0, apperr.Internal(err)
	}
	return rows, total, nil
}

func (s *DemoRequestService) Update(ctx context.Context, id uint64, req *dto.UpdateDemoRequest, actorID uint64, ip string) (*model.DemoRequest, error) {
	c := s.ctx(ctx)
	var row model.DemoRequest
	if err := s.db.WithContext(c).First(&row, id).Error; err != nil {
		return nil, apperr.NotFound("demo request not found")
	}
	updates := map[string]any{}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if req.AdminNotes != nil {
		updates["admin_notes"] = trimOrNil(*req.AdminNotes)
	}
	if len(updates) > 0 {
		if err := s.db.WithContext(c).Model(&row).Updates(updates).Error; err != nil {
			return nil, apperr.Internal(err)
		}
		s.audit.Record(ctx, actorID, "update", "demo_request", row.ID, updates, ip)
	}
	return &row, nil
}

func (s *DemoRequestService) Delete(ctx context.Context, id uint64, actorID uint64, ip string) error {
	res := s.db.WithContext(s.ctx(ctx)).Delete(&model.DemoRequest{}, id)
	if res.Error != nil {
		return apperr.Internal(res.Error)
	}
	if res.RowsAffected == 0 {
		return apperr.NotFound("demo request not found")
	}
	s.audit.Record(ctx, actorID, "delete", "demo_request", id, nil, ip)
	return nil
}
