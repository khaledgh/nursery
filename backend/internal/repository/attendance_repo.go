package repository

import (
	"context"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/sunnystars/backend/internal/dto"
	"github.com/sunnystars/backend/internal/model"
)

type AttendanceRepo struct{ db *gorm.DB }

func NewAttendanceRepo(db *gorm.DB) *AttendanceRepo { return &AttendanceRepo{db: db} }

func (r *AttendanceRepo) ByID(ctx context.Context, id uint64) (*model.Attendance, error) {
	var a model.Attendance
	err := r.db.WithContext(ctx).Preload("Child").First(&a, id).Error
	return &a, err
}

// Upsert writes the day's record for a child (one row per child per date).
func (r *AttendanceRepo) Upsert(ctx context.Context, a *model.Attendance) error {
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "child_id"}, {Name: "date"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"status", "note", "requested_by", "updated_at",
		}),
	}).Create(a).Error
}

func (r *AttendanceRepo) Update(ctx context.Context, a *model.Attendance) error {
	return r.db.WithContext(ctx).Save(a).Error
}

func (r *AttendanceRepo) ForChildOnDate(ctx context.Context, childID uint64, date time.Time) (*model.Attendance, error) {
	var a model.Attendance
	err := r.db.WithContext(ctx).
		Where("child_id = ? AND date = ?", childID, date.Format("2006-01-02")).
		First(&a).Error
	return &a, err
}

// ListPending returns unconfirmed parent requests (today onward) for the
// staff review queue, newest dates first.
//
// Scoped by role: a teacher sees only requests for children in their own
// classrooms. Without this a teacher's review queue would list every child in
// the nursery, including ones they have no relationship to.
func (r *AttendanceRepo) ListPending(ctx context.Context, q dto.PageQuery, role model.Role, userID uint64) ([]model.Attendance, int64, error) {
	var (
		rows  []model.Attendance
		total int64
	)
	tx := r.db.WithContext(ctx).Model(&model.Attendance{}).
		Where("confirmed_at IS NULL AND requested_by IS NOT NULL AND date >= ?", time.Now().Format("2006-01-02"))
	if role == model.RoleTeacher {
		tx = tx.Where("child_id IN (?)",
			r.db.Model(&model.Child{}).Select("id").Where("classroom_id IN (?)",
				r.db.Model(&model.ClassroomTeacher{}).Select("classroom_id").Where("teacher_user_id = ?", userID)))
	}
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := tx.Order("date ASC").Limit(q.PerPage).Offset(q.Offset()).
		Preload("Child").Find(&rows).Error
	return rows, total, err
}

func (r *AttendanceRepo) ListForChild(ctx context.Context, childID uint64, q dto.ListAttendanceQuery) ([]model.Attendance, int64, error) {
	var (
		rows  []model.Attendance
		total int64
	)
	tx := r.db.WithContext(ctx).Model(&model.Attendance{}).Where("child_id = ?", childID)
	if q.From != "" {
		tx = tx.Where("date >= ?", q.From)
	}
	if q.To != "" {
		tx = tx.Where("date <= ?", q.To)
	}
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := tx.Order("date DESC").Limit(q.PerPage).Offset(q.Offset()).Find(&rows).Error
	return rows, total, err
}
