package database

import (
	"context"
	"testing"

	"github.com/joho/godotenv"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"

	"github.com/sunnystars/backend/internal/config"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/hash"
)

func TestEnsureDefaultAdminLive(t *testing.T) {
	_ = godotenv.Load("../../.env")
	cfg, err := config.Load()
	if err != nil {
		t.Skip("skipping db test, config load failed:", err)
	}
	db, err := gorm.Open(mysql.Open(cfg.DB.DSN()), &gorm.Config{})
	if err != nil {
		t.Skip("skipping db test, cannot connect to db:", err)
	}

	if err := EnsureDefaultAdmin(db); err != nil {
		t.Fatalf("EnsureDefaultAdmin failed: %v", err)
	}

	var u model.User
	if err := db.WithContext(WithCrossTenant(context.Background())).Where("login_id = ? OR email = ?", "admin", "admin@nurseeplus.com").First(&u).Error; err != nil {
		t.Fatalf("could not find admin user: %v", err)
	}

	t.Logf("Admin user verified: ID=%d, Name=%s, Email=%s, LoginID=%v, Role=%s", u.ID, u.Name, u.Email, *u.LoginID, u.Role)

	if !hash.VerifyPassword(u.PasswordHash, "70578989") {
		t.Fatalf("password verification for 70578989 failed")
	}
	t.Log("Password '70578989' successfully verified for admin!")

	var superUser model.User
	if err := db.WithContext(WithCrossTenant(context.Background())).Where("login_id = ? OR email = ?", "superadmin", "superadmin@nurseeplus.com").First(&superUser).Error; err != nil {
		t.Fatalf("could not find superadmin user: %v", err)
	}

	t.Logf("SuperAdmin user verified: ID=%d, Name=%s, Email=%s, LoginID=%v, Role=%s", superUser.ID, superUser.Name, superUser.Email, *superUser.LoginID, superUser.Role)

	if !hash.VerifyPassword(superUser.PasswordHash, "70578989") {
		t.Fatalf("password verification for superadmin 70578989 failed")
	}
	t.Log("Password '70578989' successfully verified for superadmin!")
}
