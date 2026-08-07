package database

import (
	"context"
	"errors"
	"fmt"
	"reflect"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/schema"
)

// ErrNoTenantScope is returned when a query touches a tenant-owned table
// without a nursery in context. Failing the query is deliberate: the
// alternative is silently returning every nursery's rows.
var ErrNoTenantScope = errors.New("tenancy: query on a tenant table without a nursery scope")

type tenantCtxKey struct{}

type tenantScope struct {
	nurseryID   uint64
	crossTenant bool
}

// WithTenant scopes every subsequent query on ctx to one nursery.
func WithTenant(ctx context.Context, nurseryID uint64) context.Context {
	return context.WithValue(ctx, tenantCtxKey{}, tenantScope{nurseryID: nurseryID})
}

// WithCrossTenant opts a context out of tenant scoping entirely.
//
// Only three kinds of caller may use it: the superadmin console, background
// jobs that legitimately sweep every nursery, and login (which cannot know the
// nursery until it has found the user). Every call site should be obvious in
// review — that is the point of making it explicit rather than a default.
func WithCrossTenant(ctx context.Context) context.Context {
	return context.WithValue(ctx, tenantCtxKey{}, tenantScope{crossTenant: true})
}

// CarryTenant copies the tenant scope from src onto dst.
//
// For fire-and-forget goroutines that detach from the request context to
// survive its cancellation: detaching also drops the nursery, and an unscoped
// query in the background would silently span every tenant.
func CarryTenant(dst, src context.Context) context.Context {
	if src == nil {
		return dst
	}
	if s, ok := src.Value(tenantCtxKey{}).(tenantScope); ok {
		return context.WithValue(dst, tenantCtxKey{}, s)
	}
	return dst
}

// TenantFrom reports the nursery on ctx, and whether one was set at all.
func TenantFrom(ctx context.Context) (uint64, bool) {
	s, ok := ctx.Value(tenantCtxKey{}).(tenantScope)
	if !ok || s.crossTenant {
		return 0, false
	}
	return s.nurseryID, s.nurseryID != 0
}

// IsCrossTenant reports whether ctx is explicitly unscoped.
func IsCrossTenant(ctx context.Context) bool {
	s, ok := ctx.Value(tenantCtxKey{}).(tenantScope)
	return ok && s.crossTenant
}

// TenantTables lists every table carrying a nursery_id, matching migration
// 000010. Tables reached only through a scoped parent (invoice_items,
// report_ratings, guardians, ...) are absent by design, as are the
// platform-global ones (locales, settings, ui_translations).
var TenantTables = map[string]bool{
	"users": true, "children": true, "classrooms": true, "attendances": true,
	"media": true, "audit_logs": true, "notifications": true, "device_tokens": true,

	"diary_entries": true, "meal_logs": true, "hydration_logs": true,
	"sleep_logs": true, "diaper_logs": true, "weekly_menus": true,

	"allergies": true, "illness_logs": true, "medications": true,
	"immunizations": true, "checkups": true, "growth_records": true,
	"vital_logs": true, "emergency_contacts": true, "insurance_infos": true,
	"medical_documents": true, "health_notes": true,

	"milestone_categories": true, "child_milestones": true,
	"achievement_templates": true, "child_achievements": true, "daily_reports": true,

	"classroom_schedule_items": true, "weekly_plans": true,

	"events": true, "announcements": true, "community_posts": true,
	"meetups": true, "reminders": true,

	"invoices": true, "payments": true,

	"conversations": true, "chat_messages": true,
}

// RegisterTenancy installs the callbacks that scope every query to the nursery
// on the statement context.
//
// This is enforced at the GORM layer rather than in repositories because most
// services in this codebase hold a *gorm.DB directly and write ad-hoc queries;
// a repository-level predicate would be trivial to forget and the failure mode
// is a silent cross-tenant data leak. Here it is automatic: any query missing a
// scope fails loudly instead.
//
// strict should be true outside production. It turns a missing scope into a
// panic so the offending call site surfaces in tests and local runs rather than
// erroring at 3am.
func RegisterTenancy(db *gorm.DB, strict bool) error {
	cb := db.Callback()
	regs := []struct {
		name string
		add  func(string, func(*gorm.DB)) error
	}{
		{"tenancy:query", func(n string, f func(*gorm.DB)) error { return cb.Query().Before("gorm:query").Register(n, f) }},
		{"tenancy:update", func(n string, f func(*gorm.DB)) error { return cb.Update().Before("gorm:update").Register(n, f) }},
		{"tenancy:delete", func(n string, f func(*gorm.DB)) error { return cb.Delete().Before("gorm:delete").Register(n, f) }},
		{"tenancy:row", func(n string, f func(*gorm.DB)) error { return cb.Row().Before("gorm:row").Register(n, f) }},
	}
	for _, r := range regs {
		if err := r.add(r.name, filterByTenant(strict)); err != nil {
			return fmt.Errorf("tenancy: register %s: %w", r.name, err)
		}
	}
	if err := cb.Create().Before("gorm:create").Register("tenancy:create", stampTenant(strict)); err != nil {
		return fmt.Errorf("tenancy: register create: %w", err)
	}
	return nil
}

// filterByTenant appends `WHERE <table>.nursery_id = ?` to reads and writes.
func filterByTenant(strict bool) func(*gorm.DB) {
	return func(tx *gorm.DB) {
		table, ok := scopedTable(tx)
		if !ok {
			return
		}
		nurseryID, err := requireTenant(tx, table, strict)
		if err != nil {
			return
		}
		if nurseryID == 0 {
			return // cross-tenant
		}
		tx.Statement.AddClause(clause.Where{Exprs: []clause.Expression{
			clause.Eq{Column: clause.Column{Table: table, Name: "nursery_id"}, Value: nurseryID},
		}})
	}
}

// stampTenant sets nursery_id on insert so callers never have to.
func stampTenant(strict bool) func(*gorm.DB) {
	return func(tx *gorm.DB) {
		table, ok := scopedTable(tx)
		if !ok {
			return
		}
		nurseryID, err := requireTenant(tx, table, strict)
		if err != nil || nurseryID == 0 {
			return
		}
		field := tx.Statement.Schema.LookUpField("nursery_id")
		if field == nil || tx.Statement.ReflectValue.IsZero() {
			return
		}
		switch tx.Statement.ReflectValue.Kind() {
		case reflect.Slice, reflect.Array:
			for i := 0; i < tx.Statement.ReflectValue.Len(); i++ {
				setIfUnset(tx, field, tx.Statement.ReflectValue.Index(i), nurseryID)
			}
		case reflect.Struct:
			setIfUnset(tx, field, tx.Statement.ReflectValue, nurseryID)
		}
	}
}

// setIfUnset stamps nursery_id onto one record, leaving an explicit value
// alone so a superadmin can create rows in a chosen nursery.
func setIfUnset(tx *gorm.DB, field *schema.Field, rv reflect.Value, nurseryID uint64) {
	if !rv.IsValid() || !rv.CanAddr() {
		return
	}
	v, isZero := field.ValueOf(tx.Statement.Context, rv)
	if !isZero {
		if n, ok := v.(uint64); ok && n != 0 {
			return
		}
	}
	_ = field.Set(tx.Statement.Context, rv, nurseryID)
}

// scopedTable reports the statement's table when it is tenant-owned.
func scopedTable(tx *gorm.DB) (string, bool) {
	if tx.Statement == nil || tx.Statement.Schema == nil {
		return "", false
	}
	// Honour an explicit Unscoped() the same way GORM does for soft deletes.
	if tx.Statement.Unscoped {
		return "", false
	}
	table := tx.Statement.Table
	if table == "" {
		table = tx.Statement.Schema.Table
	}
	if !TenantTables[table] {
		return "", false
	}
	if tx.Statement.Schema.LookUpField("nursery_id") == nil {
		return "", false
	}
	return table, true
}

// requireTenant resolves the nursery for this statement, failing closed.
// Returns (0, nil) for an explicitly cross-tenant context.
func requireTenant(tx *gorm.DB, table string, strict bool) (uint64, error) {
	ctx := tx.Statement.Context
	if ctx == nil {
		return 0, failNoScope(tx, table, strict)
	}
	if IsCrossTenant(ctx) {
		return 0, nil
	}
	if id, ok := TenantFrom(ctx); ok {
		return id, nil
	}
	return 0, failNoScope(tx, table, strict)
}

func failNoScope(tx *gorm.DB, table string, strict bool) error {
	err := fmt.Errorf("%w: table %q", ErrNoTenantScope, table)
	if strict {
		// Loud in dev and tests: a missing scope is a bug in the calling code,
		// and the stack trace is the fastest way to the offending line.
		panic(err)
	}
	_ = tx.AddError(err)
	return err
}
