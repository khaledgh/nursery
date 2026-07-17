package dto

import "time"

type LoginRequest struct {
	Email    string `json:"email" validate:"required,email,max=191"`
	Password string `json:"password" validate:"required,min=8,max=72"`
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
	ID     uint64 `json:"id"`
	Name   string `json:"name"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	Locale string `json:"locale"`
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
