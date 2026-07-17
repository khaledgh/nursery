package repository

import (
	"context"

	"gorm.io/gorm"

	"github.com/sunnystars/backend/internal/dto"
	"github.com/sunnystars/backend/internal/model"
)

type ClassroomRepo struct{ db *gorm.DB }

func NewClassroomRepo(db *gorm.DB) *ClassroomRepo { return &ClassroomRepo{db: db} }

func (r *ClassroomRepo) ByID(ctx context.Context, id uint64) (*model.Classroom, error) {
	var cr model.Classroom
	err := r.db.WithContext(ctx).
		Preload("Image").Preload("Translations").
		Preload("Teachers").Preload("Teachers.Teacher").Preload("Teachers.Teacher.Avatar").
		First(&cr, id).Error
	return &cr, err
}

func (r *ClassroomRepo) List(ctx context.Context, q dto.PageQuery) ([]model.Classroom, int64, error) {
	var (
		rooms []model.Classroom
		total int64
	)
	tx := r.db.WithContext(ctx).Model(&model.Classroom{})
	if q.Search != "" {
		tx = tx.Where("name LIKE ?", "%"+q.Search+"%")
	}
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := tx.Order(sortClause(q.Sort, map[string]string{"name": "name", "created_at": "created_at"})).
		Limit(q.PerPage).Offset(q.Offset()).
		Preload("Image").Preload("Translations").
		Find(&rooms).Error
	return rooms, total, err
}

// Save upserts the classroom and replaces its translation rows in one transaction.
func (r *ClassroomRepo) Save(ctx context.Context, cr *model.Classroom, translations []model.ClassroomTranslation) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(cr).Error; err != nil {
			return err
		}
		if translations == nil {
			return nil
		}
		if err := tx.Where("classroom_id = ?", cr.ID).Delete(&model.ClassroomTranslation{}).Error; err != nil {
			return err
		}
		for i := range translations {
			translations[i].ClassroomID = cr.ID
			translations[i].ID = 0
		}
		if len(translations) == 0 {
			return nil
		}
		return tx.Create(&translations).Error
	})
}

func (r *ClassroomRepo) Delete(ctx context.Context, id uint64) error {
	return r.db.WithContext(ctx).Delete(&model.Classroom{}, id).Error
}

func (r *ClassroomRepo) AssignTeacher(ctx context.Context, ct *model.ClassroomTeacher) error {
	return r.db.WithContext(ctx).Create(ct).Error
}

func (r *ClassroomRepo) UnassignTeacher(ctx context.Context, classroomID, teacherUserID uint64) error {
	return r.db.WithContext(ctx).
		Where("classroom_id = ? AND teacher_user_id = ?", classroomID, teacherUserID).
		Delete(&model.ClassroomTeacher{}).Error
}

func (r *ClassroomRepo) TeacherInClassroom(ctx context.Context, teacherUserID, classroomID uint64) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.ClassroomTeacher{}).
		Where("classroom_id = ? AND teacher_user_id = ?", classroomID, teacherUserID).
		Count(&count).Error
	return count > 0, err
}
