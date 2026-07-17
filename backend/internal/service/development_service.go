package service

import (
	"context"
	"encoding/json"
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/sunnystars/backend/internal/dto"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
)

type DevelopmentService struct {
	db       *gorm.DB
	childSvc *ChildService
	notifier Notifier
	audit    *AuditService
}

func NewDevelopmentService(db *gorm.DB, childSvc *ChildService, notifier Notifier, audit *AuditService) *DevelopmentService {
	return &DevelopmentService{db: db, childSvc: childSvc, notifier: notifier, audit: audit}
}

// --- milestone categories (admin-managed templates) ---

func (s *DevelopmentService) ListCategories(ctx context.Context) ([]model.MilestoneCategory, error) {
	var cats []model.MilestoneCategory
	if err := s.db.WithContext(ctx).Order("id ASC").Find(&cats).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	return cats, nil
}

func (s *DevelopmentService) CreateCategory(ctx context.Context, req *dto.UpsertMilestoneCategoryRequest, actorID uint64, ip string) (*model.MilestoneCategory, error) {
	cat := &model.MilestoneCategory{Name: req.Name, Description: req.Description, Color: req.Color, Icon: req.Icon}
	if err := s.db.WithContext(ctx).Create(cat).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, actorID, "create", "milestone_category", cat.ID, nil, ip)
	return cat, nil
}

func (s *DevelopmentService) UpdateCategory(ctx context.Context, id uint64, req *dto.UpsertMilestoneCategoryRequest, actorID uint64, ip string) (*model.MilestoneCategory, error) {
	var cat model.MilestoneCategory
	if err := s.db.WithContext(ctx).First(&cat, id).Error; err != nil {
		return nil, apperr.NotFound("category not found")
	}
	cat.Name, cat.Description, cat.Color, cat.Icon = req.Name, req.Description, req.Color, req.Icon
	if err := s.db.WithContext(ctx).Save(&cat).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, actorID, "update", "milestone_category", cat.ID, nil, ip)
	return &cat, nil
}

func (s *DevelopmentService) DeleteCategory(ctx context.Context, id, actorID uint64, ip string) error {
	res := s.db.WithContext(ctx).Delete(&model.MilestoneCategory{}, id)
	if res.Error != nil {
		return apperr.Internal(res.Error)
	}
	if res.RowsAffected == 0 {
		return apperr.NotFound("category not found")
	}
	s.audit.Record(ctx, actorID, "delete", "milestone_category", id, nil, ip)
	return nil
}

// --- child milestones ---

func (s *DevelopmentService) ListMilestones(ctx context.Context, role model.Role, userID, childID uint64) ([]model.ChildMilestone, error) {
	if err := s.childSvc.Authorize(ctx, role, userID, childID); err != nil {
		return nil, err
	}
	var ms []model.ChildMilestone
	if err := s.db.WithContext(ctx).Where("child_id = ?", childID).Preload("Category").Find(&ms).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	return ms, nil
}

// Assess upserts the child's progress in a category (one row per child+category).
func (s *DevelopmentService) Assess(ctx context.Context, role model.Role, userID, childID uint64, req *dto.AssessMilestoneRequest, ip string) (*model.ChildMilestone, error) {
	if err := s.childSvc.Authorize(ctx, role, userID, childID); err != nil {
		return nil, err
	}
	var cat model.MilestoneCategory
	if err := s.db.WithContext(ctx).First(&cat, req.CategoryID).Error; err != nil {
		return nil, apperr.NotFound("milestone category not found")
	}
	status := req.Status
	if status == "" {
		status = "in_progress"
	}
	m := &model.ChildMilestone{
		ChildID:     childID,
		CategoryID:  req.CategoryID,
		ProgressPct: req.ProgressPct,
		Description: req.Description,
		Status:      status,
		AssessedBy:  userID,
		AssessedAt:  time.Now(),
	}
	err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "child_id"}, {Name: "category_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"progress_pct", "description", "status", "assessed_by", "assessed_at", "updated_at"}),
	}).Create(m).Error
	if err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, userID, "assess", "child_milestone", m.ID, map[string]any{"child_id": childID, "category_id": req.CategoryID}, ip)
	return m, nil
}

// --- achievements ---

func (s *DevelopmentService) ListAchievementTemplates(ctx context.Context) ([]model.AchievementTemplate, error) {
	var ts []model.AchievementTemplate
	if err := s.db.WithContext(ctx).Order("id ASC").Find(&ts).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	return ts, nil
}

func (s *DevelopmentService) CreateAchievementTemplate(ctx context.Context, req *dto.UpsertAchievementTemplateRequest, actorID uint64, ip string) (*model.AchievementTemplate, error) {
	t := &model.AchievementTemplate{Title: req.Title, Description: req.Description, Icon: req.Icon, Color: req.Color}
	if err := s.db.WithContext(ctx).Create(t).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, actorID, "create", "achievement_template", t.ID, nil, ip)
	return t, nil
}

func (s *DevelopmentService) ListAchievements(ctx context.Context, role model.Role, userID, childID uint64) ([]model.ChildAchievement, error) {
	if err := s.childSvc.Authorize(ctx, role, userID, childID); err != nil {
		return nil, err
	}
	var as []model.ChildAchievement
	if err := s.db.WithContext(ctx).Where("child_id = ?", childID).Preload("Template").Order("awarded_date DESC").Find(&as).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	return as, nil
}

func (s *DevelopmentService) Award(ctx context.Context, role model.Role, userID, childID uint64, req *dto.AwardAchievementRequest, ip string) (*model.ChildAchievement, error) {
	if err := s.childSvc.Authorize(ctx, role, userID, childID); err != nil {
		return nil, err
	}
	var tpl model.AchievementTemplate
	if err := s.db.WithContext(ctx).First(&tpl, req.AchievementTemplateID).Error; err != nil {
		return nil, apperr.NotFound("achievement template not found")
	}
	a := &model.ChildAchievement{
		ChildID:               childID,
		AchievementTemplateID: req.AchievementTemplateID,
		AwardedDate:           req.AwardedDate,
		Note:                  req.Note,
		AwardedBy:             userID,
	}
	if err := s.db.WithContext(ctx).Create(a).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, userID, "award", "child_achievement", a.ID, map[string]any{"child_id": childID}, ip)
	s.notifier.NotifyGuardians(ctx, childID, "updates", "New achievement! 🏆", tpl.Title,
		map[string]any{"screen": "milestones", "child_id": childID})
	return a, nil
}

// --- daily reports ---

func (s *DevelopmentService) ListReports(ctx context.Context, role model.Role, userID, childID uint64, q dto.RangeQuery) ([]model.DailyReport, int64, error) {
	if err := s.childSvc.Authorize(ctx, role, userID, childID); err != nil {
		return nil, 0, err
	}
	var (
		reports []model.DailyReport
		total   int64
	)
	tx := s.db.WithContext(ctx).Model(&model.DailyReport{}).Where("child_id = ?", childID)
	if q.From != "" {
		tx = tx.Where("date >= ?", q.From)
	}
	if q.To != "" {
		tx = tx.Where("date <= ?", q.To)
	}
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, apperr.Internal(err)
	}
	err := tx.Order("date DESC").Limit(q.PerPage).Offset(q.Offset()).
		Preload("Ratings").Preload("HighlightMedia").
		Find(&reports).Error
	if err != nil {
		return nil, 0, apperr.Internal(err)
	}
	return reports, total, nil
}

// UpsertReport writes the day's report and replaces its ratings atomically.
func (s *DevelopmentService) UpsertReport(ctx context.Context, role model.Role, userID, childID uint64, req *dto.UpsertDailyReportRequest, ip string) (*model.DailyReport, error) {
	if err := s.childSvc.Authorize(ctx, role, userID, childID); err != nil {
		return nil, err
	}
	tips, err := json.Marshal(req.HomeTips)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	moods, err := json.Marshal(req.Moods)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	report := &model.DailyReport{
		ChildID:          childID,
		Date:             req.Date,
		Summary:          req.Summary,
		HighlightText:    req.HighlightText,
		HighlightMediaID: req.HighlightMediaID,
		HomeTipsJSON:     datatypes.JSON(tips),
		MoodsJSON:        datatypes.JSON(moods),
		CreatedBy:        userID,
	}
	txErr := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "child_id"}, {Name: "date"}},
			DoUpdates: clause.AssignmentColumns([]string{
				"summary", "highlight_text", "highlight_media_id", "home_tips_json", "moods_json", "updated_at",
			}),
		}).Create(report).Error; err != nil {
			return err
		}
		// The upsert may not populate ID on conflict — fetch the real row.
		var stored model.DailyReport
		if err := tx.Where("child_id = ? AND date = ?", childID, req.Date).First(&stored).Error; err != nil {
			return err
		}
		report.ID = stored.ID
		if err := tx.Where("daily_report_id = ?", stored.ID).Delete(&model.ReportRating{}).Error; err != nil {
			return err
		}
		for _, r := range req.Ratings {
			if err := tx.Create(&model.ReportRating{
				DailyReportID: stored.ID, Dimension: r.Dimension, Rating: r.Rating, Note: r.Note,
			}).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if txErr != nil {
		return nil, apperr.Internal(txErr)
	}
	s.audit.Record(ctx, userID, "upsert", "daily_report", report.ID, map[string]any{"child_id": childID, "date": req.Date}, ip)
	s.notifier.NotifyGuardians(ctx, childID, "updates", "Daily report ready", "Today's report is available",
		map[string]any{"screen": "reports", "child_id": childID, "date": req.Date})
	return report, nil
}
