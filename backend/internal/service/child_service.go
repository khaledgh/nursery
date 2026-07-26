package service

import (
	"context"
	"time"

	"github.com/sunnystars/backend/internal/dto"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
	"github.com/sunnystars/backend/internal/repository"
)

type ChildService struct {
	children *repository.ChildRepo
	users    *repository.UserRepo
	audit    *AuditService
}

func NewChildService(children *repository.ChildRepo, users *repository.UserRepo, audit *AuditService) *ChildService {
	return &ChildService{children: children, users: users, audit: audit}
}

// Authorize returns Forbidden unless the caller may access this child.
// Every child-scoped endpoint funnels through this check.
func (s *ChildService) Authorize(ctx context.Context, role model.Role, userID, childID uint64) error {
	ok, err := s.children.CanAccess(ctx, role, userID, childID)
	if err != nil {
		return apperr.Internal(err)
	}
	if !ok {
		// NotFound, not Forbidden: don't confirm the child exists to outsiders.
		return apperr.NotFound("child not found")
	}
	return nil
}

func (s *ChildService) List(ctx context.Context, q dto.PageQuery, role model.Role, userID uint64) ([]model.Child, int64, error) {
	return s.children.List(ctx, q, role, userID)
}

func (s *ChildService) Get(ctx context.Context, role model.Role, userID, childID uint64) (*model.Child, error) {
	if err := s.Authorize(ctx, role, userID, childID); err != nil {
		return nil, err
	}
	ch, err := s.children.ByID(ctx, childID)
	if err != nil {
		return nil, apperr.NotFound("child not found")
	}
	return ch, nil
}

func (s *ChildService) Create(ctx context.Context, req *dto.CreateChildRequest, actorID uint64, ip string) (*model.Child, error) {
	dob, err := time.Parse("2006-01-02", req.DOB)
	if err != nil {
		return nil, apperr.BadRequest("invalid date of birth")
	}
	ch := &model.Child{
		FirstName:     req.FirstName,
		LastName:      req.LastName,
		DOB:           dob,
		Gender:        req.Gender,
		BloodType:     req.BloodType,
		ClassroomID:   req.ClassroomID,
		AvatarID:      req.AvatarID,
		Status:        "active",
		PresentStatus: model.PresentOut,
	}
	if err := s.children.Create(ctx, ch); err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, actorID, "create", "child", ch.ID, map[string]any{"name": ch.FirstName + " " + ch.LastName}, ip)
	return ch, nil
}

func (s *ChildService) Update(ctx context.Context, childID uint64, req *dto.UpdateChildRequest, actorID uint64, ip string) (*model.Child, error) {
	ch, err := s.children.ByID(ctx, childID)
	if err != nil {
		return nil, apperr.NotFound("child not found")
	}
	if req.FirstName != nil {
		ch.FirstName = *req.FirstName
	}
	if req.LastName != nil {
		ch.LastName = *req.LastName
	}
	if req.DOB != nil {
		dob, err := time.Parse("2006-01-02", *req.DOB)
		if err != nil {
			return nil, apperr.BadRequest("invalid date of birth")
		}
		ch.DOB = dob
	}
	if req.Gender != nil {
		ch.Gender = *req.Gender
	}
	if req.BloodType != nil {
		ch.BloodType = *req.BloodType
	}
	if req.ClassroomID != nil {
		ch.ClassroomID = req.ClassroomID
	}
	if req.AvatarID != nil {
		ch.AvatarID = req.AvatarID
	}
	if req.Status != nil {
		ch.Status = *req.Status
	}
	if err := s.children.Update(ctx, ch); err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, actorID, "update", "child", ch.ID, nil, ip)
	return ch, nil
}

func (s *ChildService) Delete(ctx context.Context, childID, actorID uint64, ip string) error {
	if _, err := s.children.ByID(ctx, childID); err != nil {
		return apperr.NotFound("child not found")
	}
	if err := s.children.Delete(ctx, childID); err != nil {
		return apperr.Internal(err)
	}
	s.audit.Record(ctx, actorID, "delete", "child", childID, nil, ip)
	return nil
}

func (s *ChildService) AddGuardian(ctx context.Context, childID uint64, req *dto.AddGuardianRequest, actorID uint64, ip string) (*model.Guardian, error) {
	if _, err := s.children.ByID(ctx, childID); err != nil {
		return nil, apperr.NotFound("child not found")
	}
	parent, err := s.users.ByID(ctx, req.ParentUserID)
	if err != nil {
		return nil, apperr.NotFound("parent user not found")
	}
	if parent.Role != model.RoleParent {
		return nil, apperr.BadRequest("guardian must be a user with the parent role")
	}
	exists, err := s.children.GuardianExists(ctx, childID, req.ParentUserID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	if exists {
		return nil, apperr.ConflictField("parent_user_id", "is already a guardian of this child")
	}
	g := &model.Guardian{
		ParentUserID: req.ParentUserID,
		ChildID:      childID,
		Relationship: req.Relationship,
		IsPrimary:    req.IsPrimary,
		CanPickup:    req.CanPickup,
	}
	if err := s.children.AddGuardian(ctx, g); err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, actorID, "create", "guardian", g.ID,
		map[string]any{"child_id": childID, "parent_user_id": req.ParentUserID}, ip)
	return g, nil
}

func (s *ChildService) RemoveGuardian(ctx context.Context, childID, parentUserID, actorID uint64, ip string) error {
	exists, err := s.children.GuardianExists(ctx, childID, parentUserID)
	if err != nil {
		return apperr.Internal(err)
	}
	if !exists {
		return apperr.NotFound("guardian link not found")
	}
	if err := s.children.RemoveGuardian(ctx, childID, parentUserID); err != nil {
		return apperr.Internal(err)
	}
	s.audit.Record(ctx, actorID, "delete", "guardian", 0,
		map[string]any{"child_id": childID, "parent_user_id": parentUserID}, ip)
	return nil
}
