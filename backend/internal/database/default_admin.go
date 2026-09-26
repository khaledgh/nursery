package database

import (
	"context"
	"strings"

	"gorm.io/gorm"

	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/hash"
)

// EnsureDefaultAdmin guarantees that a default administrator account exists
// with username "admin", email "admin@nurseeplus.com", and password "70578989".
func EnsureDefaultAdmin(db *gorm.DB) error {
	// Must use WithCrossTenant so GORM tenancy filter doesn't panic during boot/migrations
	ctx := WithCrossTenant(context.Background())
	var user model.User

	// Check if admin user exists with login_id 'admin' or email 'admin@nurseeplus.com' or legacy 'admin@sunnystars.app'
	err := db.WithContext(ctx).
		Where("login_id = ? OR email = ? OR email = ?", "admin", "admin@nurseeplus.com", "admin@sunnystars.app").
		First(&user).Error

	pwHash, errHash := hash.Password("70578989")
	if errHash != nil {
		return errHash
	}

	adminLoginID := "admin"

	if err != nil {
		if strings.Contains(err.Error(), "record not found") || err == gorm.ErrRecordNotFound {
			// Create the default admin
			newAdmin := model.User{
				NurseryID:    1,
				Name:         "Administrator",
				Email:        "admin@nurseeplus.com",
				LoginID:      &adminLoginID,
				PasswordHash: pwHash,
				Role:         model.RoleAdmin,
				Locale:       "en",
				Status:       model.UserActive,
			}
			return db.WithContext(ctx).Create(&newAdmin).Error
		}
		return err
	}

	// If found, ensure login_id is "admin", email is "admin@nurseeplus.com", and password is "70578989"
	updates := map[string]any{
		"email":         "admin@nurseeplus.com",
		"login_id":      adminLoginID,
		"password_hash": pwHash,
		"status":        model.UserActive,
		"role":          model.RoleAdmin,
	}
	if err := db.WithContext(ctx).Model(&user).Updates(updates).Error; err != nil {
		return err
	}

	// Guarantee default superadmin exists
	var superUser model.User
	superLoginID := "superadmin"
	errSuper := db.WithContext(ctx).
		Where("login_id = ? OR email = ? OR role = ?", "superadmin", "superadmin@nurseeplus.com", model.RoleSuperAdmin).
		First(&superUser).Error

	if errSuper != nil {
		if strings.Contains(errSuper.Error(), "record not found") || errSuper == gorm.ErrRecordNotFound {
			newSuper := model.User{
				NurseryID:    1,
				Name:         "Super Administrator",
				Email:        "superadmin@nurseeplus.com",
				LoginID:      &superLoginID,
				PasswordHash: pwHash,
				Role:         model.RoleSuperAdmin,
				Locale:       "en",
				Status:       model.UserActive,
			}
			return db.WithContext(ctx).Create(&newSuper).Error
		}
		return errSuper
	}

	superUpdates := map[string]any{
		"email":         "superadmin@nurseeplus.com",
		"login_id":      superLoginID,
		"password_hash": pwHash,
		"status":        model.UserActive,
		"role":          model.RoleSuperAdmin,
	}
	return db.WithContext(ctx).Model(&superUser).Updates(superUpdates).Error
}
