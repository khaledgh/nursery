package repository

import (
	"context"

	"gorm.io/gorm"

	"github.com/sunnystars/backend/internal/dto"
	"github.com/sunnystars/backend/internal/model"
)

type ChildRepo struct{ db *gorm.DB }

func NewChildRepo(db *gorm.DB) *ChildRepo { return &ChildRepo{db: db} }

func (r *ChildRepo) ByID(ctx context.Context, id uint64) (*model.Child, error) {
	var ch model.Child
	err := r.db.WithContext(ctx).
		Preload("Avatar").Preload("Classroom").
		Preload("Guardians").Preload("Guardians.Parent").
		First(&ch, id).Error
	return &ch, err
}

func (r *ChildRepo) Create(ctx context.Context, ch *model.Child) error {
	return r.db.WithContext(ctx).Create(ch).Error
}

func (r *ChildRepo) Update(ctx context.Context, ch *model.Child) error {
	return r.db.WithContext(ctx).Save(ch).Error
}

func (r *ChildRepo) Delete(ctx context.Context, id uint64) error {
	return r.db.WithContext(ctx).Delete(&model.Child{}, id).Error
}

// scopeForRole limits a children query to what the caller may see:
// parents → children they are guardians of; teachers → children in their
// classrooms; admins → everything.
func (r *ChildRepo) scopeForRole(tx *gorm.DB, role model.Role, userID uint64) *gorm.DB {
	switch role {
	case model.RoleParent:
		return tx.Where("children.id IN (?)",
			r.db.Model(&model.Guardian{}).Select("child_id").Where("parent_user_id = ?", userID))
	case model.RoleTeacher:
		return tx.Where("children.classroom_id IN (?)",
			r.db.Model(&model.ClassroomTeacher{}).Select("classroom_id").Where("teacher_user_id = ?", userID))
	default: // admin
		return tx
	}
}

func (r *ChildRepo) List(ctx context.Context, q dto.PageQuery, role model.Role, userID uint64) ([]model.Child, int64, error) {
	var (
		children []model.Child
		total    int64
	)
	tx := r.scopeForRole(r.db.WithContext(ctx).Model(&model.Child{}), role, userID)
	if q.Search != "" {
		like := "%" + q.Search + "%"
		tx = tx.Where("first_name LIKE ? OR last_name LIKE ?", like, like)
	}
	if q.Status != "" && q.Status != "all" {
		switch q.Status {
		case "in", "checked_in":
			tx = tx.Where("present_status = ?", model.PresentIn)
		case "out", "checked_out", "not_checked_in":
			tx = tx.Where("present_status = ?", model.PresentOut)
		case "absent":
			tx = tx.Where("present_status = ?", model.PresentAbs)
		default:
			tx = tx.Where("present_status = ?", q.Status)
		}
	}
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := tx.Order(sortClause(q.Sort, map[string]string{
		"first_name": "first_name", "last_name": "last_name", "dob": "dob", "created_at": "created_at",
	})).Limit(q.PerPage).Offset(q.Offset()).
		Preload("Avatar").Preload("Classroom").
		Find(&children).Error
	return children, total, err
}

// CanAccess reports whether the user may read this child's data.
func (r *ChildRepo) CanAccess(ctx context.Context, role model.Role, userID, childID uint64) (bool, error) {
	if role == model.RoleAdmin {
		return true, nil
	}
	var count int64
	tx := r.scopeForRole(r.db.WithContext(ctx).Model(&model.Child{}).Where("children.id = ?", childID), role, userID)
	err := tx.Count(&count).Error
	return count > 0, err
}

func (r *ChildRepo) AddGuardian(ctx context.Context, g *model.Guardian) error {
	return r.db.WithContext(ctx).Create(g).Error
}

func (r *ChildRepo) RemoveGuardian(ctx context.Context, childID, parentUserID uint64) error {
	return r.db.WithContext(ctx).
		Where("child_id = ? AND parent_user_id = ?", childID, parentUserID).
		Delete(&model.Guardian{}).Error
}

func (r *ChildRepo) GuardianExists(ctx context.Context, childID, parentUserID uint64) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.Guardian{}).
		Where("child_id = ? AND parent_user_id = ?", childID, parentUserID).
		Count(&count).Error
	return count > 0, err
}

func (r *ChildRepo) ListMedia(ctx context.Context, childID uint64, q dto.PageQuery) ([]model.Media, int64, error) {
	var (
		media []model.Media
		total int64
	)
	tx := r.db.WithContext(ctx).Model(&model.Media{}).
		Select("DISTINCT media.*").
		Joins("LEFT JOIN diary_media dm ON dm.media_id = media.id").
		Joins("LEFT JOIN diary_entries de ON de.id = dm.diary_entry_id").
		Joins("LEFT JOIN meal_logs ml ON ml.image_id = media.id").
		Joins("LEFT JOIN daily_reports dr ON dr.highlight_media_id = media.id").
		Where("de.child_id = ? OR ml.child_id = ? OR dr.child_id = ?", childID, childID, childID)

	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := tx.Order("media.id DESC").
		Limit(q.PerPage).
		Offset(q.Offset()).
		Find(&media).Error

	return media, total, err
}

