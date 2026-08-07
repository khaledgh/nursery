package service

import (
	"context"
	"fmt"
	"strings"

	"gorm.io/gorm"

	"github.com/sunnystars/backend/internal/database"
	"github.com/sunnystars/backend/internal/model"
)

// GenerateLoginID builds the nursery-issued mobile credential, "<slug>-<id>".
//
// Parents and teachers sign in with this rather than an email: it resolves the
// nursery unambiguously (emails are only unique per nursery), and many parents
// share or lack a personal address. Derived from the user's own primary key so
// it is unique by construction, with a numeric suffix as a belt-and-braces
// guard in case a slug change makes two nurseries collide.
func GenerateLoginID(ctx context.Context, db *gorm.DB, nurseryID, userID uint64) (string, error) {
	var slug string
	err := db.WithContext(database.WithCrossTenant(ctx)).
		Model(&model.Nursery{}).Select("slug").
		Where("id = ?", nurseryID).Scan(&slug).Error
	if err != nil {
		return "", err
	}
	if slug == "" {
		slug = "n" + fmt.Sprint(nurseryID)
	}

	base := fmt.Sprintf("%s-%d", strings.ToLower(slug), userID)
	candidate := base
	for attempt := 2; attempt < 100; attempt++ {
		var count int64
		// login_id is globally unique, so this check must span tenants.
		if err := db.WithContext(database.WithCrossTenant(ctx)).
			Model(&model.User{}).Unscoped().
			Where("login_id = ?", candidate).Count(&count).Error; err != nil {
			return "", err
		}
		if count == 0 {
			return candidate, nil
		}
		candidate = fmt.Sprintf("%s-%d", base, attempt)
	}
	return "", fmt.Errorf("could not allocate a unique login id for user %d", userID)
}

// AssignLoginID gives a user a login id if their role needs one and they lack
// one. Admins and superadmins sign in on the web with an email, so they are
// skipped.
func AssignLoginID(ctx context.Context, db *gorm.DB, u *model.User) error {
	if u.LoginID != nil && *u.LoginID != "" {
		return nil
	}
	if u.Role != model.RoleParent && u.Role != model.RoleTeacher {
		return nil
	}
	id, err := GenerateLoginID(ctx, db, u.NurseryID, u.ID)
	if err != nil {
		return err
	}
	u.LoginID = &id
	return db.WithContext(ctx).Model(u).Update("login_id", id).Error
}
