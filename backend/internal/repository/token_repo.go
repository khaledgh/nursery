package repository

import (
	"context"
	"time"

	"gorm.io/gorm"

	"github.com/sunnystars/backend/internal/model"
)

type TokenRepo struct{ db *gorm.DB }

func NewTokenRepo(db *gorm.DB) *TokenRepo { return &TokenRepo{db: db} }

func (r *TokenRepo) CreateRefresh(ctx context.Context, t *model.RefreshToken) error {
	return r.db.WithContext(ctx).Create(t).Error
}

func (r *TokenRepo) RefreshByHash(ctx context.Context, hash string) (*model.RefreshToken, error) {
	var t model.RefreshToken
	err := r.db.WithContext(ctx).Where("token_hash = ?", hash).First(&t).Error
	return &t, err
}

// Rotate revokes the old token and records its successor atomically.
func (r *TokenRepo) Rotate(ctx context.Context, old *model.RefreshToken, next *model.RefreshToken) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		res := tx.Model(&model.RefreshToken{}).
			Where("id = ? AND revoked_at IS NULL", old.ID).
			Updates(map[string]any{"revoked_at": now, "replaced_by_hash": next.TokenHash})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return gorm.ErrRecordNotFound // raced: someone else rotated it first
		}
		return tx.Create(next).Error
	})
}

func (r *TokenRepo) Revoke(ctx context.Context, id uint64) error {
	now := time.Now()
	return r.db.WithContext(ctx).Model(&model.RefreshToken{}).
		Where("id = ? AND revoked_at IS NULL", id).Update("revoked_at", now).Error
}

// RevokeAllForUser kills every active session — used on password reset and
// on refresh-token reuse (possible theft).
func (r *TokenRepo) RevokeAllForUser(ctx context.Context, userID uint64) error {
	now := time.Now()
	return r.db.WithContext(ctx).Model(&model.RefreshToken{}).
		Where("user_id = ? AND revoked_at IS NULL", userID).Update("revoked_at", now).Error
}

func (r *TokenRepo) DeleteExpired(ctx context.Context, olderThan time.Time) error {
	return r.db.WithContext(ctx).
		Where("expires_at < ?", olderThan).Delete(&model.RefreshToken{}).Error
}

// --- password resets ---

func (r *TokenRepo) CreatePasswordReset(ctx context.Context, p *model.PasswordReset) error {
	return r.db.WithContext(ctx).Create(p).Error
}

func (r *TokenRepo) PasswordResetByHash(ctx context.Context, hash string) (*model.PasswordReset, error) {
	var p model.PasswordReset
	err := r.db.WithContext(ctx).Where("token_hash = ?", hash).First(&p).Error
	return &p, err
}

func (r *TokenRepo) MarkResetUsed(ctx context.Context, id uint64) error {
	now := time.Now()
	return r.db.WithContext(ctx).Model(&model.PasswordReset{}).
		Where("id = ? AND used_at IS NULL", id).Update("used_at", now).Error
}
