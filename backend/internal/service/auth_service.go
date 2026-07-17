package service

import (
	"context"
	"time"

	"github.com/rs/zerolog"

	"github.com/sunnystars/backend/internal/dto"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
	"github.com/sunnystars/backend/internal/pkg/hash"
	"github.com/sunnystars/backend/internal/pkg/jwtutil"
	"github.com/sunnystars/backend/internal/repository"
)

// dummyHash is compared when the email doesn't exist so login takes the same
// time for unknown and known users (prevents user enumeration via timing).
const dummyHash = "$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW"

const resetTokenTTL = 30 * time.Minute

type AuthService struct {
	users      *repository.UserRepo
	tokens     *repository.TokenRepo
	jwts       *jwtutil.Manager
	refreshTTL time.Duration
	log        zerolog.Logger
}

func NewAuthService(users *repository.UserRepo, tokens *repository.TokenRepo, jwts *jwtutil.Manager, refreshTTL time.Duration, log zerolog.Logger) *AuthService {
	return &AuthService{users: users, tokens: tokens, jwts: jwts, refreshTTL: refreshTTL, log: log}
}

func (s *AuthService) Login(ctx context.Context, req *dto.LoginRequest, deviceInfo string) (*dto.LoginResponse, error) {
	user, err := s.users.ByEmail(ctx, req.Email)
	if err != nil {
		hash.VerifyPassword(dummyHash, req.Password) // burn the same time
		return nil, apperr.Unauthorized("invalid email or password")
	}
	if !hash.VerifyPassword(user.PasswordHash, req.Password) {
		return nil, apperr.Unauthorized("invalid email or password")
	}
	if user.Status != model.UserActive {
		return nil, apperr.Forbidden("account is disabled")
	}

	pair, err := s.issueTokens(ctx, user, deviceInfo)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	if err := s.users.TouchLastLogin(ctx, user.ID); err != nil {
		s.log.Warn().Err(err).Uint64("user_id", user.ID).Msg("failed to update last_login_at")
	}

	return &dto.LoginResponse{User: toAuthUser(user), Tokens: *pair}, nil
}

// Refresh rotates the presented refresh token. Presenting an already-revoked
// token is treated as theft: every session for that user is revoked.
func (s *AuthService) Refresh(ctx context.Context, rawToken, deviceInfo string) (*dto.LoginResponse, error) {
	stored, err := s.tokens.RefreshByHash(ctx, hash.Token256(rawToken))
	if err != nil {
		return nil, apperr.Unauthorized("invalid refresh token")
	}
	if stored.RevokedAt != nil {
		s.log.Warn().Uint64("user_id", stored.UserID).Msg("refresh token reuse detected — revoking all sessions")
		if err := s.tokens.RevokeAllForUser(ctx, stored.UserID); err != nil {
			s.log.Error().Err(err).Uint64("user_id", stored.UserID).Msg("failed to revoke sessions after reuse")
		}
		return nil, apperr.Unauthorized("invalid refresh token")
	}
	if time.Now().After(stored.ExpiresAt) {
		return nil, apperr.Unauthorized("refresh token expired")
	}

	user, err := s.users.ByID(ctx, stored.UserID)
	if err != nil || user.Status != model.UserActive {
		return nil, apperr.Unauthorized("invalid refresh token")
	}

	rawNext, err := hash.RandomToken()
	if err != nil {
		return nil, apperr.Internal(err)
	}
	next := &model.RefreshToken{
		UserID:     user.ID,
		TokenHash:  hash.Token256(rawNext),
		DeviceInfo: deviceInfo,
		ExpiresAt:  time.Now().Add(s.refreshTTL),
	}
	if err := s.tokens.Rotate(ctx, stored, next); err != nil {
		return nil, apperr.Unauthorized("invalid refresh token")
	}

	access, accessExp, err := s.jwts.Issue(user.ID, string(user.Role))
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return &dto.LoginResponse{
		User: toAuthUser(user),
		Tokens: dto.TokenPair{
			AccessToken: access, AccessExpiresAt: accessExp,
			RefreshToken: rawNext, RefreshExpiresAt: next.ExpiresAt,
		},
	}, nil
}

func (s *AuthService) Logout(ctx context.Context, userID uint64, rawToken string) error {
	stored, err := s.tokens.RefreshByHash(ctx, hash.Token256(rawToken))
	if err != nil || stored.UserID != userID {
		return nil // logging out with an unknown token is a no-op, not an error
	}
	return s.tokens.Revoke(ctx, stored.ID)
}

func (s *AuthService) Me(ctx context.Context, userID uint64) (*model.User, error) {
	user, err := s.users.ByID(ctx, userID)
	if err != nil {
		return nil, apperr.Unauthorized("account not found")
	}
	return user, nil
}

// ForgotPassword always succeeds from the caller's perspective so the
// endpoint can't be used to probe which emails are registered. The reset
// token is logged for now; the mailer integration replaces that.
func (s *AuthService) ForgotPassword(ctx context.Context, email string) {
	user, err := s.users.ByEmail(ctx, email)
	if err != nil {
		return
	}
	raw, err := hash.RandomToken()
	if err != nil {
		s.log.Error().Err(err).Msg("failed to generate reset token")
		return
	}
	reset := &model.PasswordReset{
		UserID:    user.ID,
		TokenHash: hash.Token256(raw),
		ExpiresAt: time.Now().Add(resetTokenTTL),
	}
	if err := s.tokens.CreatePasswordReset(ctx, reset); err != nil {
		s.log.Error().Err(err).Msg("failed to store reset token")
		return
	}
	// TODO(mailer): send raw token by email. Never log it in production.
	s.log.Info().Uint64("user_id", user.ID).Str("reset_token_dev_only", raw).
		Msg("password reset requested")
}

func (s *AuthService) ResetPassword(ctx context.Context, rawToken, newPassword string) error {
	reset, err := s.tokens.PasswordResetByHash(ctx, hash.Token256(rawToken))
	if err != nil || reset.UsedAt != nil || time.Now().After(reset.ExpiresAt) {
		return apperr.BadRequest("invalid or expired reset token")
	}
	user, err := s.users.ByID(ctx, reset.UserID)
	if err != nil {
		return apperr.BadRequest("invalid or expired reset token")
	}
	newHash, err := hash.Password(newPassword)
	if err != nil {
		return apperr.Internal(err)
	}
	user.PasswordHash = newHash
	if err := s.users.Update(ctx, user); err != nil {
		return apperr.Internal(err)
	}
	if err := s.tokens.MarkResetUsed(ctx, reset.ID); err != nil {
		return apperr.Internal(err)
	}
	// A password change invalidates every existing session.
	if err := s.tokens.RevokeAllForUser(ctx, user.ID); err != nil {
		s.log.Error().Err(err).Uint64("user_id", user.ID).Msg("failed to revoke sessions after reset")
	}
	return nil
}

func (s *AuthService) UpdateLocale(ctx context.Context, userID uint64, locale string) error {
	user, err := s.users.ByID(ctx, userID)
	if err != nil {
		return apperr.NotFound("user not found")
	}
	user.Locale = locale
	if err := s.users.Update(ctx, user); err != nil {
		return apperr.Internal(err)
	}
	return nil
}

func (s *AuthService) issueTokens(ctx context.Context, user *model.User, deviceInfo string) (*dto.TokenPair, error) {
	access, accessExp, err := s.jwts.Issue(user.ID, string(user.Role))
	if err != nil {
		return nil, err
	}
	rawRefresh, err := hash.RandomToken()
	if err != nil {
		return nil, err
	}
	refresh := &model.RefreshToken{
		UserID:     user.ID,
		TokenHash:  hash.Token256(rawRefresh),
		DeviceInfo: deviceInfo,
		ExpiresAt:  time.Now().Add(s.refreshTTL),
	}
	if err := s.tokens.CreateRefresh(ctx, refresh); err != nil {
		return nil, err
	}
	return &dto.TokenPair{
		AccessToken: access, AccessExpiresAt: accessExp,
		RefreshToken: rawRefresh, RefreshExpiresAt: refresh.ExpiresAt,
	}, nil
}

func toAuthUser(u *model.User) dto.AuthUser {
	return dto.AuthUser{ID: u.ID, Name: u.Name, Email: u.Email, Role: string(u.Role), Locale: u.Locale}
}
