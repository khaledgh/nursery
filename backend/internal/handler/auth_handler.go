package handler

import (
	"github.com/labstack/echo/v4"

	"github.com/sunnystars/backend/internal/dto"
	mw "github.com/sunnystars/backend/internal/middleware"
	"github.com/sunnystars/backend/internal/pkg/response"
	"github.com/sunnystars/backend/internal/service"
)

type AuthHandler struct {
	auth    *service.AuthService
	locales *service.LocaleService
}

func NewAuthHandler(auth *service.AuthService, locales *service.LocaleService) *AuthHandler {
	return &AuthHandler{auth: auth, locales: locales}
}

func (h *AuthHandler) Register(public, protected *echo.Group) {
	public.POST("/auth/login", h.Login)
	public.POST("/auth/refresh", h.Refresh)
	public.POST("/auth/forgot-password", h.ForgotPassword)
	public.POST("/auth/reset-password", h.ResetPassword)

	protected.POST("/auth/logout", h.Logout)
	protected.GET("/auth/me", h.Me)
	protected.PUT("/auth/locale", h.UpdateLocale)
}

func (h *AuthHandler) Login(c echo.Context) error {
	req, err := dto.Bind[dto.LoginRequest](c)
	if err != nil {
		return err
	}
	res, err := h.auth.Login(c.Request().Context(), req, c.Request().UserAgent())
	if err != nil {
		return err
	}
	return response.OK(c, res)
}

func (h *AuthHandler) Refresh(c echo.Context) error {
	req, err := dto.Bind[dto.RefreshRequest](c)
	if err != nil {
		return err
	}
	res, err := h.auth.Refresh(c.Request().Context(), req.RefreshToken, c.Request().UserAgent())
	if err != nil {
		return err
	}
	return response.OK(c, res)
}

func (h *AuthHandler) Logout(c echo.Context) error {
	req, err := dto.Bind[dto.LogoutRequest](c)
	if err != nil {
		return err
	}
	if err := h.auth.Logout(c.Request().Context(), mw.UserID(c), req.RefreshToken); err != nil {
		return err
	}
	return response.NoContent(c)
}

func (h *AuthHandler) Me(c echo.Context) error {
	user, err := h.auth.Me(c.Request().Context(), mw.UserID(c))
	if err != nil {
		return err
	}
	return response.OK(c, user)
}

func (h *AuthHandler) ForgotPassword(c echo.Context) error {
	req, err := dto.Bind[dto.ForgotPasswordRequest](c)
	if err != nil {
		return err
	}
	h.auth.ForgotPassword(c.Request().Context(), req.Email)
	// Always the same response — never reveal whether the email exists.
	return response.OK(c, map[string]string{"message": "if the email exists, a reset link has been sent"})
}

func (h *AuthHandler) ResetPassword(c echo.Context) error {
	req, err := dto.Bind[dto.ResetPasswordRequest](c)
	if err != nil {
		return err
	}
	if err := h.auth.ResetPassword(c.Request().Context(), req.Token, req.NewPassword); err != nil {
		return err
	}
	return response.OK(c, map[string]string{"message": "password updated"})
}

func (h *AuthHandler) UpdateLocale(c echo.Context) error {
	req, err := dto.Bind[dto.UpdateLocaleRequest](c)
	if err != nil {
		return err
	}
	if !h.locales.IsActive(req.Locale) {
		return response.Err(c, 400, "bad_request", "unknown or inactive locale", nil)
	}
	if err := h.auth.UpdateLocale(c.Request().Context(), mw.UserID(c), req.Locale); err != nil {
		return err
	}
	return response.NoContent(c)
}
