package service

import (
	"context"

	"github.com/sunnystars/backend/internal/dto"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
	"github.com/sunnystars/backend/internal/pkg/hash"
	"github.com/sunnystars/backend/internal/repository"
)

type UserService struct {
	users  *repository.UserRepo
	tokens *repository.TokenRepo
	audit  *AuditService
}

func NewUserService(users *repository.UserRepo, tokens *repository.TokenRepo, audit *AuditService) *UserService {
	return &UserService{users: users, tokens: tokens, audit: audit}
}

func (s *UserService) List(ctx context.Context, q dto.ListUsersQuery) ([]model.User, int64, error) {
	return s.users.List(ctx, q.PageQuery, model.Role(q.Role))
}

func (s *UserService) Get(ctx context.Context, id uint64) (*model.User, error) {
	u, err := s.users.ByID(ctx, id)
	if err != nil {
		return nil, apperr.NotFound("user not found")
	}
	return u, nil
}

func (s *UserService) Create(ctx context.Context, req *dto.CreateUserRequest, actorID uint64, ip string) (*model.User, error) {
	exists, err := s.users.EmailExists(ctx, req.Email, 0)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	if exists {
		return nil, apperr.ConflictField("email", "is already in use")
	}
	pwHash, err := hash.Password(req.Password)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	locale := req.Locale
	if locale == "" {
		locale = "en"
	}
	u := &model.User{
		Name:         req.Name,
		Email:        req.Email,
		Phone:        req.Phone,
		PasswordHash: pwHash,
		Role:         model.Role(req.Role),
		Locale:       locale,
		Status:       model.UserActive,
	}
	if err := s.users.Create(ctx, u); err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, actorID, "create", "user", u.ID, map[string]any{"email": u.Email, "role": u.Role}, ip)
	return u, nil
}

func (s *UserService) Update(ctx context.Context, id uint64, req *dto.UpdateUserRequest, actorID uint64, ip string) (*model.User, error) {
	u, err := s.users.ByID(ctx, id)
	if err != nil {
		return nil, apperr.NotFound("user not found")
	}
	changed := map[string]any{}
	if req.Email != nil && *req.Email != u.Email {
		exists, err := s.users.EmailExists(ctx, *req.Email, id)
		if err != nil {
			return nil, apperr.Internal(err)
		}
		if exists {
			return nil, apperr.ConflictField("email", "is already in use")
		}
		u.Email = *req.Email
		changed["email"] = *req.Email
	}
	if req.Name != nil {
		u.Name = *req.Name
		changed["name"] = *req.Name
	}
	if req.Phone != nil {
		u.Phone = *req.Phone
	}
	if req.Locale != nil {
		u.Locale = *req.Locale
	}
	if req.AvatarID != nil {
		u.AvatarID = req.AvatarID
	}
	if req.Status != nil {
		u.Status = model.UserStatus(*req.Status)
		changed["status"] = *req.Status
		if u.Status == model.UserInactive {
			// Disabling an account ends its sessions immediately.
			if err := s.tokens.RevokeAllForUser(ctx, u.ID); err != nil {
				return nil, apperr.Internal(err)
			}
		}
	}
	if req.Password != nil {
		pwHash, err := hash.Password(*req.Password)
		if err != nil {
			return nil, apperr.Internal(err)
		}
		u.PasswordHash = pwHash
		changed["password"] = "rotated"
		if err := s.tokens.RevokeAllForUser(ctx, u.ID); err != nil {
			return nil, apperr.Internal(err)
		}
	}
	if err := s.users.Update(ctx, u); err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, actorID, "update", "user", u.ID, changed, ip)
	return u, nil
}

// UpdateMyAvatar lets any signed-in user set or clear their own photo —
// parents have no access to the admin user CRUD.
func (s *UserService) UpdateMyAvatar(ctx context.Context, userID uint64, mediaID *uint64, ip string) (*model.User, error) {
	u, err := s.users.ByID(ctx, userID)
	if err != nil {
		return nil, apperr.NotFound("user not found")
	}
	u.AvatarID = mediaID
	if err := s.users.Update(ctx, u); err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, userID, "update", "user_avatar", u.ID, nil, ip)
	// Re-read so the response carries the preloaded Avatar media.
	return s.users.ByID(ctx, userID)
}

func (s *UserService) Delete(ctx context.Context, id, actorID uint64, ip string) error {
	if id == actorID {
		return apperr.BadRequest("you cannot delete your own account")
	}
	if _, err := s.users.ByID(ctx, id); err != nil {
		return apperr.NotFound("user not found")
	}
	if err := s.tokens.RevokeAllForUser(ctx, id); err != nil {
		return apperr.Internal(err)
	}
	if err := s.users.Delete(ctx, id); err != nil {
		return apperr.Internal(err)
	}
	s.audit.Record(ctx, actorID, "delete", "user", id, nil, ip)
	return nil
}
