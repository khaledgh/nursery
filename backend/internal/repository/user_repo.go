package repository

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"

	"github.com/sunnystars/backend/internal/dto"
	"github.com/sunnystars/backend/internal/model"
)

var ErrNotFound = gorm.ErrRecordNotFound

type UserRepo struct{ db *gorm.DB }

func NewUserRepo(db *gorm.DB) *UserRepo { return &UserRepo{db: db} }

func (r *UserRepo) DB() *gorm.DB { return r.db }

func (r *UserRepo) ByID(ctx context.Context, id uint64) (*model.User, error) {
	var u model.User
	err := r.db.WithContext(ctx).Preload("Avatar").First(&u, id).Error
	return &u, err
}

func (r *UserRepo) ByEmail(ctx context.Context, email string) (*model.User, error) {
	var u model.User
	err := r.db.WithContext(ctx).Where("email = ?", email).First(&u).Error
	return &u, err
}

func (r *UserRepo) EmailExists(ctx context.Context, email string, excludeID uint64) (bool, error) {
	var count int64
	q := r.db.WithContext(ctx).Model(&model.User{}).Where("email = ?", email)
	if excludeID != 0 {
		q = q.Where("id <> ?", excludeID)
	}
	err := q.Count(&count).Error
	return count > 0, err
}

func (r *UserRepo) Create(ctx context.Context, u *model.User) error {
	return r.db.WithContext(ctx).Create(u).Error
}

func (r *UserRepo) Update(ctx context.Context, u *model.User) error {
	return r.db.WithContext(ctx).Save(u).Error
}

func (r *UserRepo) Delete(ctx context.Context, id uint64) error {
	return r.db.WithContext(ctx).Delete(&model.User{}, id).Error
}

func (r *UserRepo) TouchLastLogin(ctx context.Context, id uint64) error {
	now := time.Now()
	return r.db.WithContext(ctx).Model(&model.User{}).Where("id = ?", id).
		Update("last_login_at", now).Error
}

func (r *UserRepo) List(ctx context.Context, q dto.PageQuery, role model.Role) ([]model.User, int64, error) {
	var (
		users []model.User
		total int64
	)
	tx := r.db.WithContext(ctx).Model(&model.User{})
	if role != "" {
		tx = tx.Where("role = ?", role)
	}
	if q.Search != "" {
		like := "%" + q.Search + "%"
		tx = tx.Where("name LIKE ? OR email LIKE ?", like, like)
	}
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := tx.Order(sortClause(q.Sort, map[string]string{
		"name": "name", "email": "email", "created_at": "created_at",
	})).Limit(q.PerPage).Offset(q.Offset()).Preload("Avatar").Find(&users).Error
	return users, total, err
}

func (r *UserRepo) Count(ctx context.Context) (int64, error) {
	var n int64
	err := r.db.WithContext(ctx).Model(&model.User{}).Count(&n).Error
	return n, err
}

// sortClause whitelists sortable columns to keep user input out of SQL.
// Accepts "col" or "-col" (descending); falls back to newest-first.
func sortClause(sort string, allowed map[string]string) string {
	desc := false
	if len(sort) > 0 && sort[0] == '-' {
		desc = true
		sort = sort[1:]
	}
	col, ok := allowed[sort]
	if !ok {
		return "created_at DESC"
	}
	if desc {
		return col + " DESC"
	}
	return col + " ASC"
}

func IsNotFound(err error) bool { return errors.Is(err, gorm.ErrRecordNotFound) }
