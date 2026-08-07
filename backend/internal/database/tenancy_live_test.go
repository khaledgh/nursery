//go:build livedb

// Cross-tenant isolation proven against a real MySQL instance rather than a
// mock. The unit tests assert the generated SQL contains a nursery predicate;
// these assert the database actually returns the right rows.
//
//	go test -tags livedb ./internal/database/ -v
//
// Requires TEST_DSN, e.g.
//	TEST_DSN='root:@tcp(127.0.0.1:3306)/nursery_isolation?parseTime=true'
package database

import (
	"context"
	"os"
	"testing"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type liveChild struct {
	ID        uint64 `gorm:"primaryKey"`
	NurseryID uint64
	FirstName string
	LastName  string
	DOB       string `gorm:"type:date"`
}

func (liveChild) TableName() string { return "children" }

func liveDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DSN")
	if dsn == "" {
		t.Skip("TEST_DSN not set")
	}
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{Logger: logger.Discard})
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	if err := RegisterTenancy(db, true); err != nil {
		t.Fatalf("RegisterTenancy: %v", err)
	}
	return db
}

// The core promise of the whole tenancy layer: one nursery's queries must not
// see another's rows, without the caller writing any predicate.
func TestLiveCrossTenantIsolation(t *testing.T) {
	db := liveDB(t)
	ctxA := WithTenant(context.Background(), 1)
	ctxB := WithTenant(context.Background(), 2)

	a := liveChild{FirstName: "Alice", LastName: "TenantOne", DOB: "2021-01-01"}
	b := liveChild{FirstName: "Bob", LastName: "TenantTwo", DOB: "2021-01-01"}
	if err := db.WithContext(ctxA).Create(&a).Error; err != nil {
		t.Fatalf("create in nursery 1: %v", err)
	}
	if err := db.WithContext(ctxB).Create(&b).Error; err != nil {
		t.Fatalf("create in nursery 2: %v", err)
	}
	t.Cleanup(func() {
		db.WithContext(WithCrossTenant(context.Background())).
			Unscoped().Delete(&liveChild{}, []uint64{a.ID, b.ID})
	})

	// Inserts are stamped from context, with no nursery_id set by the caller.
	if a.NurseryID != 1 || b.NurseryID != 2 {
		t.Fatalf("stamped nursery ids = (%d, %d), want (1, 2)", a.NurseryID, b.NurseryID)
	}

	// Reads: each side sees only its own row.
	var got liveChild
	if err := db.WithContext(ctxA).First(&got, b.ID).Error; err == nil {
		t.Fatalf("nursery 1 read nursery 2's child %d — cross-tenant leak", b.ID)
	}
	if err := db.WithContext(ctxB).First(&got, a.ID).Error; err == nil {
		t.Fatalf("nursery 2 read nursery 1's child %d — cross-tenant leak", a.ID)
	}
	if err := db.WithContext(ctxA).First(&got, a.ID).Error; err != nil {
		t.Fatalf("nursery 1 could not read its own child: %v", err)
	}

	// Updates must not reach across either.
	res := db.WithContext(ctxA).Model(&liveChild{}).Where("id = ?", b.ID).Update("first_name", "HACKED")
	if res.RowsAffected != 0 {
		t.Fatalf("nursery 1 updated %d of nursery 2's rows", res.RowsAffected)
	}

	// Nor deletes.
	res = db.WithContext(ctxA).Where("id = ?", b.ID).Delete(&liveChild{})
	if res.RowsAffected != 0 {
		t.Fatalf("nursery 1 deleted %d of nursery 2's rows", res.RowsAffected)
	}

	var stillThere liveChild
	if err := db.WithContext(ctxB).First(&stillThere, b.ID).Error; err != nil {
		t.Fatalf("nursery 2's child was damaged by nursery 1: %v", err)
	}
	if stillThere.FirstName != "Bob" {
		t.Fatalf("first_name = %q, want Bob — a cross-tenant write landed", stillThere.FirstName)
	}
}

// A list query returns only the caller's rows, which is what every index page
// in the admin panel depends on.
func TestLiveListIsScoped(t *testing.T) {
	db := liveDB(t)
	ctxA := WithTenant(context.Background(), 1)

	var rows []liveChild
	if err := db.WithContext(ctxA).Find(&rows).Error; err != nil {
		t.Fatalf("list: %v", err)
	}
	for _, r := range rows {
		if r.NurseryID != 1 {
			t.Fatalf("list returned child %d from nursery %d", r.ID, r.NurseryID)
		}
	}
}

// The superadmin path must still see everything.
func TestLiveCrossTenantContextSeesAll(t *testing.T) {
	db := liveDB(t)
	var scoped, all int64
	db.WithContext(WithTenant(context.Background(), 1)).Model(&liveChild{}).Count(&scoped)
	db.WithContext(WithCrossTenant(context.Background())).Model(&liveChild{}).Count(&all)
	if all < scoped {
		t.Fatalf("cross-tenant count %d < scoped count %d", all, scoped)
	}
}
