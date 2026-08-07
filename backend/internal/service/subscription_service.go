package service

import (
	"context"
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/sunnystars/backend/internal/database"
	"github.com/sunnystars/backend/internal/dto"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
)

type SubscriptionService struct {
	db *gorm.DB
}

func NewSubscriptionService(db *gorm.DB) *SubscriptionService {
	return &SubscriptionService{db: db}
}

// ForNursery loads a nursery's subscription.
//
// Reads cross-tenant deliberately: the subscriptions table gates what a tenant
// may do, so scoping it through the same callback it governs would be
// circular. The nursery id is supplied explicitly instead.
func (s *SubscriptionService) ForNursery(ctx context.Context, nurseryID uint64) (*model.Subscription, error) {
	var sub model.Subscription
	err := s.db.WithContext(database.WithCrossTenant(ctx)).
		Preload("Plan").Where("nursery_id = ?", nurseryID).First(&sub).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.NotFound("no subscription for this nursery")
		}
		return nil, apperr.Internal(err)
	}
	return &sub, nil
}

// Usage reports seat consumption for the billing screen and the dashboard
// meter. Soft-deleted children do not occupy a seat.
func (s *SubscriptionService) Usage(ctx context.Context, nurseryID uint64) (*dto.SeatUsage, error) {
	sub, err := s.ForNursery(ctx, nurseryID)
	if err != nil {
		return nil, err
	}
	students, err := s.countChildren(ctx, nurseryID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	staff, err := s.countStaff(ctx, nurseryID)
	if err != nil {
		return nil, apperr.Internal(err)
	}

	usage := &dto.SeatUsage{
		Status:       string(sub.Status),
		StudentsUsed: int(students),
		StudentsMax:  sub.MaxStudents,
		StaffUsed:    int(staff),
		StaffMax:     sub.MaxStaff,
		AllowsWrites: sub.AllowsWrites(),
		PaymentDue:   sub.NeedsPaymentWarning(),
		PeriodEnd:    sub.CurrentPeriodEnd,
		GraceUntil:   sub.GraceUntil,
	}
	if sub.MaxStudents > 0 {
		usage.StudentsRemaining = sub.MaxStudents - int(students)
	}
	if sub.Plan != nil {
		usage.PlanCode = sub.Plan.Code
		usage.PlanName = sub.Plan.Name
	}
	return usage, nil
}

// AssertCanAddChild is the seat gate. It must run inside the same transaction
// as the insert (see WithSeatCheck) or two concurrent creates can both pass and
// overshoot the cap.
func (s *SubscriptionService) AssertCanAddChild(ctx context.Context, tx *gorm.DB, nurseryID uint64) error {
	sub, err := s.lockSubscription(ctx, tx, nurseryID)
	if err != nil {
		return err
	}
	if !sub.AllowsWrites() {
		return apperr.SubscriptionInactive("subscription is not active; contact support to restore access")
	}
	if sub.MaxStudents <= 0 {
		return nil // unlimited
	}
	used, err := s.countChildrenTx(ctx, tx, nurseryID)
	if err != nil {
		return apperr.Internal(err)
	}
	if int(used) >= sub.MaxStudents {
		return apperr.SeatLimit("student", int(used), sub.MaxStudents)
	}
	return nil
}

// AssertCanAddStaff mirrors AssertCanAddChild for teachers and admins.
func (s *SubscriptionService) AssertCanAddStaff(ctx context.Context, tx *gorm.DB, nurseryID uint64) error {
	sub, err := s.lockSubscription(ctx, tx, nurseryID)
	if err != nil {
		return err
	}
	if !sub.AllowsWrites() {
		return apperr.SubscriptionInactive("subscription is not active; contact support to restore access")
	}
	if sub.MaxStaff <= 0 {
		return nil // unlimited
	}
	used, err := s.countStaffTx(ctx, tx, nurseryID)
	if err != nil {
		return apperr.Internal(err)
	}
	if int(used) >= sub.MaxStaff {
		return apperr.SeatLimit("staff", int(used), sub.MaxStaff)
	}
	return nil
}

// AssertActive gates write endpoints that don't consume a seat.
func (s *SubscriptionService) AssertActive(ctx context.Context, nurseryID uint64) error {
	sub, err := s.ForNursery(ctx, nurseryID)
	if err != nil {
		return err
	}
	if !sub.AllowsWrites() {
		return apperr.SubscriptionInactive("subscription is not active; contact support to restore access")
	}
	return nil
}

// WithSeatCheck runs fn in a transaction that has already reserved a student
// seat. The subscription row stays locked for the duration, so a concurrent
// create blocks rather than racing past the cap.
func (s *SubscriptionService) WithSeatCheck(ctx context.Context, nurseryID uint64, fn func(tx *gorm.DB) error) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := s.AssertCanAddChild(ctx, tx, nurseryID); err != nil {
			return err
		}
		return fn(tx)
	})
}

// lockSubscription reads the row FOR UPDATE so the count-then-insert sequence
// is serialized against other creates in the same nursery.
func (s *SubscriptionService) lockSubscription(ctx context.Context, tx *gorm.DB, nurseryID uint64) (*model.Subscription, error) {
	if tx == nil {
		tx = s.db
	}
	var sub model.Subscription
	err := tx.WithContext(database.WithCrossTenant(ctx)).
		Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("nursery_id = ?", nurseryID).First(&sub).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.NotFound("no subscription for this nursery")
		}
		return nil, apperr.Internal(err)
	}
	return &sub, nil
}

// Counts run cross-tenant with an explicit nursery predicate: the caller may be
// a superadmin acting on a nursery other than their own.
func (s *SubscriptionService) countChildren(ctx context.Context, nurseryID uint64) (int64, error) {
	return s.countChildrenTx(ctx, s.db, nurseryID)
}

func (s *SubscriptionService) countChildrenTx(ctx context.Context, tx *gorm.DB, nurseryID uint64) (int64, error) {
	var n int64
	// GORM excludes soft-deleted rows automatically, which is what frees a seat
	// when an admin removes a child.
	err := tx.WithContext(database.WithCrossTenant(ctx)).
		Model(&model.Child{}).Where("nursery_id = ?", nurseryID).Count(&n).Error
	return n, err
}

func (s *SubscriptionService) countStaff(ctx context.Context, nurseryID uint64) (int64, error) {
	return s.countStaffTx(ctx, s.db, nurseryID)
}

func (s *SubscriptionService) countStaffTx(ctx context.Context, tx *gorm.DB, nurseryID uint64) (int64, error) {
	var n int64
	err := tx.WithContext(database.WithCrossTenant(ctx)).
		Model(&model.User{}).
		Where("nursery_id = ? AND role IN ?", nurseryID, []model.Role{model.RoleAdmin, model.RoleTeacher}).
		Count(&n).Error
	return n, err
}

// Capabilities returns the modules enabled for a nursery. A nursery with no
// rows yet has everything on, so an install that predates this table behaves
// exactly as before.
func (s *SubscriptionService) Capabilities(ctx context.Context, nurseryID uint64) ([]string, error) {
	var rows []model.NurseryCapability
	err := s.db.WithContext(database.WithCrossTenant(ctx)).
		Where("nursery_id = ?", nurseryID).Find(&rows).Error
	if err != nil {
		return nil, apperr.Internal(err)
	}
	if len(rows) == 0 {
		return append([]string(nil), model.AllCapabilities...), nil
	}
	out := make([]string, 0, len(rows))
	for _, r := range rows {
		if r.Enabled {
			out = append(out, r.Capability)
		}
	}
	return out, nil
}

// HasCapability reports whether one module is enabled.
func (s *SubscriptionService) HasCapability(ctx context.Context, nurseryID uint64, capability string) (bool, error) {
	caps, err := s.Capabilities(ctx, nurseryID)
	if err != nil {
		return false, err
	}
	for _, c := range caps {
		if c == capability {
			return true, nil
		}
	}
	return false, nil
}
