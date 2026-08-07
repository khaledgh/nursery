package dto

import "time"

// LoginRequest accepts either identifier. The admin panel sends email; the
// mobile app sends the nursery-issued login_id, which resolves the nursery
// unambiguously (email is only unique per nursery).
type LoginRequest struct {
	Email    string `json:"email" validate:"omitempty,email,max=191"`
	LoginID  string `json:"login_id" validate:"omitempty,max=32"`
	Password string `json:"password" validate:"required,min=8,max=72"`
}

// Identifier reports which credential was supplied. ok is false when neither
// or both were sent, which the handler turns into a validation error.
func (r LoginRequest) Identifier() (value string, isLoginID, ok bool) {
	hasEmail, hasLoginID := r.Email != "", r.LoginID != ""
	switch {
	case hasEmail && !hasLoginID:
		return r.Email, false, true
	case hasLoginID && !hasEmail:
		return r.LoginID, true, true
	default:
		return "", false, false
	}
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required,max=512"`
}

type LogoutRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required,max=512"`
}

type ForgotPasswordRequest struct {
	Email string `json:"email" validate:"required,email,max=191"`
}

type ResetPasswordRequest struct {
	Token       string `json:"token" validate:"required,max=512"`
	NewPassword string `json:"new_password" validate:"required,min=8,max=72"`
}

type UpdateLocaleRequest struct {
	Locale string `json:"locale" validate:"required,max=10"`
}

type AuthUser struct {
	ID        uint64  `json:"id"`
	Name      string  `json:"name"`
	Email     string  `json:"email"`
	LoginID   *string `json:"login_id,omitempty"`
	Role      string  `json:"role"`
	Locale    string  `json:"locale"`
	NurseryID uint64  `json:"nursery_id"`
}

type TokenPair struct {
	AccessToken      string    `json:"access_token"`
	AccessExpiresAt  time.Time `json:"access_expires_at"`
	RefreshToken     string    `json:"refresh_token"`
	RefreshExpiresAt time.Time `json:"refresh_expires_at"`
}

type LoginResponse struct {
	User   AuthUser  `json:"user"`
	Tokens TokenPair `json:"tokens"`
}
