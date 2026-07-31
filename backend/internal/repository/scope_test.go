package repository

import (
	"context"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/sunnystars/backend/internal/dto"
	"github.com/sunnystars/backend/internal/model"
)

// captureSQL runs fn against a GORM session that records every statement it
// renders instead of hitting a database, so the real repository methods can be
// called and their generated SQL asserted.
func captureSQL(t *testing.T, fn func(db *gorm.DB)) []string {
	t.Helper()
	conn, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer conn.Close()
	mock.MatchExpectationsInOrder(false)

	var seen []string
	db, err := gorm.Open(mysql.New(mysql.Config{
		Conn:                      conn,
		SkipInitializeWithVersion: true,
	}), &gorm.Config{Logger: logger.Discard, DryRun: true})
	if err != nil {
		t.Fatalf("gorm open: %v", err)
	}
	// DryRun renders each statement without executing it; record the result
	// after GORM has finished building it.
	if err := db.Callback().Query().After("gorm:query").Register("test:capture", func(tx *gorm.DB) {
		seen = append(seen, tx.Statement.SQL.String())
	}); err != nil {
		t.Fatalf("register callback: %v", err)
	}
	if err := db.Callback().Row().After("gorm:row").Register("test:capture-row", func(tx *gorm.DB) {
		seen = append(seen, tx.Statement.SQL.String())
	}); err != nil {
		t.Fatalf("register row callback: %v", err)
	}

	fn(db)
	return seen
}

func joined(stmts []string) string { return strings.Join(stmts, "\n") }

// Regression test for a cross-tenant leak: the pending-attendance queue took no
// role at all and returned every unconfirmed request in the nursery, including
// children the teacher has no relationship to.
func TestListPendingScopesTeacherToOwnClassrooms(t *testing.T) {
	q := dto.PageQuery{}
	q.Normalize()

	teacher := captureSQL(t, func(db *gorm.DB) {
		_, _, _ = NewAttendanceRepo(db).ListPending(context.Background(), q, model.RoleTeacher, 9)
	})
	if !strings.Contains(joined(teacher), "classroom_teachers") {
		t.Fatalf("teacher not scoped to own classrooms:\n%s", joined(teacher))
	}

	admin := captureSQL(t, func(db *gorm.DB) {
		_, _, _ = NewAttendanceRepo(db).ListPending(context.Background(), q, model.RoleAdmin, 1)
	})
	if strings.Contains(joined(admin), "classroom_teachers") {
		t.Fatalf("admin wrongly narrowed to a teacher scope:\n%s", joined(admin))
	}
}

// Teachers listing classrooms must see only their own rooms; admins see all.
func TestClassroomListScopesByRole(t *testing.T) {
	q := dto.PageQuery{}
	q.Normalize()

	teacher := captureSQL(t, func(db *gorm.DB) {
		_, _, _ = NewClassroomRepo(db).List(context.Background(), q, model.RoleTeacher, 9)
	})
	if !strings.Contains(joined(teacher), "classroom_teachers") {
		t.Fatalf("teacher not scoped to own classrooms:\n%s", joined(teacher))
	}

	admin := captureSQL(t, func(db *gorm.DB) {
		_, _, _ = NewClassroomRepo(db).List(context.Background(), q, model.RoleAdmin, 1)
	})
	if strings.Contains(joined(admin), "classroom_teachers") {
		t.Fatalf("admin wrongly narrowed to a teacher scope:\n%s", joined(admin))
	}
}
