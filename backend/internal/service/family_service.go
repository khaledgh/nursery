package service

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"

	"github.com/sunnystars/backend/internal/database"
	"github.com/sunnystars/backend/internal/dto"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
	"github.com/sunnystars/backend/internal/pkg/hash"
)

// FamilyService collapses the parent → child → guardian-link sequence into one
// call.
//
// Previously this took roughly twenty clicks across three modals on two pages,
// with an unstated ordering constraint: the parent had to exist before the
// child could be linked to them. Doing it in one transaction also means a
// half-built family can no longer be left behind by a failure midway.
type FamilyService struct {
	db    *gorm.DB
	seats *SubscriptionService
	audit *AuditService
}

func NewFamilyService(db *gorm.DB, seats *SubscriptionService, audit *AuditService) *FamilyService {
	return &FamilyService{db: db, seats: seats, audit: audit}
}

// CreateFamily creates (or reuses) a parent, creates the child, and links them.
func (s *FamilyService) CreateFamily(ctx context.Context, req *dto.CreateFamilyRequest, actorID uint64, ip string) (*dto.FamilyResponse, error) {
	nurseryID, ok := database.TenantFrom(ctx)
	if !ok {
		return nil, apperr.Internal(errors.New("family create without a nursery scope"))
	}

	dob, err := time.Parse("2006-01-02", req.Child.DOB)
	if err != nil {
		return nil, apperr.BadRequest("invalid date of birth")
	}

	var (
		parent *model.User
		child  *model.Child
	)

	// One transaction, with the seat check holding the subscription row, so a
	// family is either created whole or not at all.
	err = s.seats.WithSeatCheck(ctx, nurseryID, func(tx *gorm.DB) error {
		parent, err = s.resolveParent(ctx, tx, req, nurseryID)
		if err != nil {
			return err
		}

		child = &model.Child{
			FirstName:     req.Child.FirstName,
			LastName:      req.Child.LastName,
			DOB:           dob,
			Gender:        req.Child.Gender,
			BloodType:     req.Child.BloodType,
			ClassroomID:   req.Child.ClassroomID,
			Status:        "active",
			PresentStatus: model.PresentOut,
		}
		if err := tx.WithContext(ctx).Create(child).Error; err != nil {
			return err
		}

		link := &model.Guardian{
			ParentUserID: parent.ID,
			ChildID:      child.ID,
			Relationship: orDefault(req.Link.Relationship, "guardian"),
			IsPrimary:    req.Link.IsPrimary,
			CanPickup:    req.Link.CanPickup,
		}
		return tx.WithContext(ctx).Create(link).Error
	})
	if err != nil {
		return nil, apperr.From(err)
	}

	s.audit.Record(ctx, actorID, "create", "family", child.ID, map[string]any{
		"parent_user_id": parent.ID,
		"child":          child.FirstName + " " + child.LastName,
	}, ip)

	return &dto.FamilyResponse{
		Parent:  toFamilyParent(parent),
		Child:   child,
		Created: true,
	}, nil
}

// resolveParent reuses an existing parent when one was chosen (the sibling
// case) and otherwise creates a new one, assigning the login id the parent will
// use on mobile.
func (s *FamilyService) resolveParent(ctx context.Context, tx *gorm.DB, req *dto.CreateFamilyRequest, nurseryID uint64) (*model.User, error) {
	if req.ParentUserID != nil && *req.ParentUserID != 0 {
		var existing model.User
		if err := tx.WithContext(ctx).First(&existing, *req.ParentUserID).Error; err != nil {
			return nil, apperr.NotFound("parent not found")
		}
		if existing.Role != model.RoleParent {
			return nil, apperr.BadRequest("the selected user is not a parent")
		}
		return &existing, nil
	}

	if req.Parent == nil {
		return nil, apperr.Validation(map[string]string{
			"parent": "provide either an existing parent_user_id or new parent details",
		})
	}

	var clash int64
	if err := tx.WithContext(ctx).Model(&model.User{}).
		Where("email = ?", req.Parent.Email).Count(&clash).Error; err != nil {
		return nil, err
	}
	if clash > 0 {
		return nil, apperr.ConflictField("parent.email", "is already in use at this nursery")
	}

	password := req.Parent.Password
	if password == "" {
		// A parent signs in with their login id; a random password here means
		// the account is never left with a guessable one when the admin
		// intends to send a reset instead.
		raw, err := hash.RandomToken()
		if err != nil {
			return nil, err
		}
		password = raw
	}
	pwHash, err := hash.Password(password)
	if err != nil {
		return nil, err
	}

	parent := &model.User{
		NurseryID:    nurseryID,
		Name:         req.Parent.Name,
		Email:        req.Parent.Email,
		Phone:        req.Parent.Phone,
		PasswordHash: pwHash,
		Role:         model.RoleParent,
		Locale:       orDefault(req.Parent.Locale, "en"),
		Status:       model.UserActive,
	}
	if err := tx.WithContext(ctx).Create(parent).Error; err != nil {
		return nil, err
	}
	// Derived from the row's primary key, so it can only be set post-insert.
	if err := AssignLoginID(ctx, tx, parent); err != nil {
		return nil, err
	}
	return parent, nil
}

// GetParent answers the question the admin panel could never answer before:
// which children does this parent have, and what do they owe?
func (s *FamilyService) GetParent(ctx context.Context, parentID uint64) (*dto.ParentDetail, error) {
	var parent model.User
	if err := s.db.WithContext(ctx).Preload("Avatar").First(&parent, parentID).Error; err != nil {
		return nil, apperr.NotFound("parent not found")
	}
	if parent.Role != model.RoleParent {
		return nil, apperr.NotFound("parent not found")
	}

	// Guardian rows survive a parent's soft delete so a restore is lossless,
	// but a removed child must not reappear on the profile.
	var guardians []model.Guardian
	if err := s.db.WithContext(ctx).
		Preload("Child").Preload("Child.Classroom").Preload("Child.Avatar").
		Where("parent_user_id = ?", parentID).Find(&guardians).Error; err != nil {
		return nil, apperr.Internal(err)
	}

	out := &dto.ParentDetail{
		Parent:   toFamilyParent(&parent),
		Children: make([]dto.FamilyChild, 0, len(guardians)),
	}
	childIDs := make([]uint64, 0, len(guardians))
	for _, g := range guardians {
		if g.Child == nil {
			continue // child was removed
		}
		childIDs = append(childIDs, g.Child.ID)
		out.Children = append(out.Children, dto.FamilyChild{
			Child:        g.Child,
			Relationship: g.Relationship,
			IsPrimary:    g.IsPrimary,
			CanPickup:    g.CanPickup,
		})
	}

	if len(childIDs) > 0 {
		var summary struct {
			Outstanding int64
			Paid        int64
			Unpaid      int64
		}
		s.db.WithContext(ctx).Model(&model.Invoice{}).
			Select(`
				COALESCE(SUM(CASE WHEN status IN ('due','overdue') THEN total_minor ELSE 0 END), 0) AS outstanding,
				COALESCE(SUM(CASE WHEN status = 'paid' THEN total_minor ELSE 0 END), 0) AS paid,
				COALESCE(SUM(CASE WHEN status IN ('due','overdue') THEN 1 ELSE 0 END), 0) AS unpaid`).
			Where("child_id IN ?", childIDs).Scan(&summary)
		out.OutstandingMinor = summary.Outstanding
		out.PaidMinor = summary.Paid
		out.UnpaidInvoices = int(summary.Unpaid)

		s.db.WithContext(ctx).Model(&model.Invoice{}).
			Preload("Items").
			Where("child_id IN ?", childIDs).
			Order("due_date DESC").Limit(20).Find(&out.Invoices)
	}

	return out, nil
}

func toFamilyParent(u *model.User) dto.FamilyParent {
	return dto.FamilyParent{
		ID: u.ID, Name: u.Name, Email: u.Email, Phone: u.Phone,
		LoginID: u.LoginID, Status: string(u.Status), Locale: u.Locale,
	}
}
