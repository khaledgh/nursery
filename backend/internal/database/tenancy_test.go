package database

import (
	"context"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// child mirrors a tenant-owned table; nursery_id is what the callbacks key on.
type child struct {
	ID        uint64 `gorm:"primaryKey"`
	NurseryID uint64
	FirstName string
}

func (child) TableName() string { return "children" }

// locale mirrors a platform-global table, which must never be scoped.
type locale struct {
	Code string `gorm:"primaryKey"`
}

func (locale) TableName() string { return "locales" }

// newDB returns a DryRun GORM session with the tenancy callbacks installed,
// plus a recorder of every statement it renders.
func newDB(t *testing.T, strict bool) (*gorm.DB, *[]string) {
	t.Helper()
	conn, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { conn.Close() })
	// GORM wraps writes in a transaction. Under DryRun the statement is still
	// rendered, but sqlmock rejects the unexpected Begin and aborts before the
	// callbacks run — so allow it.
	mock.MatchExpectationsInOrder(false)
	mock.ExpectBegin()
	mock.ExpectRollback()
	mock.ExpectCommit()

	db, err := gorm.Open(mysql.New(mysql.Config{
		Conn:                      conn,
		SkipInitializeWithVersion: true,
	}), &gorm.Config{Logger: logger.Discard, DryRun: true, SkipDefaultTransaction: true})
	if err != nil {
		t.Fatalf("gorm open: %v", err)
	}
	if err := RegisterTenancy(db, strict); err != nil {
		t.Fatalf("RegisterTenancy: %v", err)
	}

	var seen []string
	record := func(tx *gorm.DB) { seen = append(seen, tx.Statement.SQL.String()) }
	_ = db.Callback().Query().After("gorm:query").Register("test:capture", record)
	_ = db.Callback().Update().After("gorm:update").Register("test:capture", record)
	_ = db.Callback().Delete().After("gorm:delete").Register("test:capture", record)
	return db, &seen
}

func TestQueryIsScopedToNursery(t *testing.T) {
	db, seen := newDB(t, true)
	ctx := WithTenant(context.Background(), 42)

	var out []child
	db.WithContext(ctx).Find(&out)

	sql := strings.Join(*seen, "\n")
	if !strings.Contains(sql, "nursery_id") {
		t.Fatalf("query not scoped to a nursery:\n%s", sql)
	}
}

// The whole point of the callback layer: a service that forgets to scope its
// query must not silently read another nursery's rows.
func TestQueryWithoutTenantPanicsInStrictMode(t *testing.T) {
	db, _ := newDB(t, true)

	defer func() {
		r := recover()
		if r == nil {
			t.Fatal("expected a panic on an unscoped tenant query")
		}
		if err, ok := r.(error); !ok || !strings.Contains(err.Error(), "nursery scope") {
			t.Fatalf("panic = %v, want ErrNoTenantScope", r)
		}
	}()

	var out []child
	db.WithContext(context.Background()).Find(&out)
}

// In production the same mistake must fail the query rather than crash the
// process — but it must still never return unscoped rows.
func TestQueryWithoutTenantErrorsInProduction(t *testing.T) {
	db, _ := newDB(t, false)

	var out []child
	tx := db.WithContext(context.Background()).Find(&out)

	if tx.Error == nil {
		t.Fatal("expected an error on an unscoped tenant query")
	}
	if !strings.Contains(tx.Error.Error(), "nursery scope") {
		t.Fatalf("error = %v, want ErrNoTenantScope", tx.Error)
	}
}

func TestCrossTenantContextSkipsScoping(t *testing.T) {
	db, seen := newDB(t, true)
	ctx := WithCrossTenant(context.Background())

	var out []child
	db.WithContext(ctx).Find(&out)

	if sql := strings.Join(*seen, "\n"); strings.Contains(sql, "nursery_id") {
		t.Fatalf("superadmin query was wrongly narrowed to one nursery:\n%s", sql)
	}
}

// Platform-global tables have no nursery_id; scoping them would break login
// and the language picker.
func TestGlobalTablesAreNotScoped(t *testing.T) {
	db, seen := newDB(t, true)

	var out []locale
	db.WithContext(context.Background()).Find(&out)

	if sql := strings.Join(*seen, "\n"); strings.Contains(sql, "nursery_id") {
		t.Fatalf("global table was wrongly scoped:\n%s", sql)
	}
}

func TestUpdateAndDeleteAreScoped(t *testing.T) {
	ctx := WithTenant(context.Background(), 42)

	t.Run("update", func(t *testing.T) {
		db, seen := newDB(t, true)
		db.WithContext(ctx).Model(&child{}).Where("id = ?", 1).Update("first_name", "x")
		if sql := strings.Join(*seen, "\n"); !strings.Contains(sql, "nursery_id") {
			t.Fatalf("update not scoped:\n%s", sql)
		}
	})

	t.Run("delete", func(t *testing.T) {
		db, seen := newDB(t, true)
		db.WithContext(ctx).Where("id = ?", 1).Delete(&child{})
		if sql := strings.Join(*seen, "\n"); !strings.Contains(sql, "nursery_id") {
			t.Fatalf("delete not scoped:\n%s", sql)
		}
	})
}

// Insert must stamp the nursery so callers never have to, and must not
// overwrite one deliberately set (the superadmin provisioning path).
func TestCreateStampsNursery(t *testing.T) {
	db, _ := newDB(t, true)
	ctx := WithTenant(context.Background(), 42)

	c := child{FirstName: "Ada"}
	db.WithContext(ctx).Create(&c)
	if c.NurseryID != 42 {
		t.Fatalf("NurseryID = %d, want 42 (stamped from context)", c.NurseryID)
	}

	explicit := child{FirstName: "Bo", NurseryID: 9}
	db.WithContext(ctx).Create(&explicit)
	if explicit.NurseryID != 9 {
		t.Fatalf("NurseryID = %d, want 9 (explicit value preserved)", explicit.NurseryID)
	}
}

func TestCarryTenantPreservesScopeAcrossDetach(t *testing.T) {
	src := WithTenant(context.Background(), 42)
	dst := CarryTenant(context.Background(), src)

	if id, ok := TenantFrom(dst); !ok || id != 42 {
		t.Fatalf("TenantFrom(dst) = (%d, %v), want (42, true)", id, ok)
	}

	// Cross-tenant must survive the copy too, or background sends would
	// start failing closed.
	if !IsCrossTenant(CarryTenant(context.Background(), WithCrossTenant(context.Background()))) {
		t.Fatal("cross-tenant scope lost across detach")
	}
}

func TestTenantFromReportsAbsence(t *testing.T) {
	if _, ok := TenantFrom(context.Background()); ok {
		t.Fatal("a bare context must not report a tenant")
	}
	if _, ok := TenantFrom(WithCrossTenant(context.Background())); ok {
		t.Fatal("a cross-tenant context has no single nursery")
	}
}
