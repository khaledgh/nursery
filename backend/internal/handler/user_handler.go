package handler

import (
	"strconv"

	"github.com/labstack/echo/v4"

	"github.com/sunnystars/backend/internal/dto"
	mw "github.com/sunnystars/backend/internal/middleware"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
	"github.com/sunnystars/backend/internal/pkg/response"
	"github.com/sunnystars/backend/internal/service"
)

// UserHandler exposes the admin-only user management endpoints.
type UserHandler struct {
	users *service.UserService
}

func NewUserHandler(users *service.UserService) *UserHandler {
	return &UserHandler{users: users}
}

func (h *UserHandler) Register(protected *echo.Group) {
	// Self-service: any signed-in user manages their own photo.
	protected.PUT("/users/me/avatar", h.UpdateMyAvatar)

	admin := protected.Group("/admin", mw.RequireRole(model.RoleAdmin))
	admin.GET("/users", h.List)
	admin.GET("/users/:id", h.Get)
	admin.POST("/users", h.Create)
	admin.PUT("/users/:id", h.Update)
	admin.DELETE("/users/:id", h.Delete)
}

func (h *UserHandler) UpdateMyAvatar(c echo.Context) error {
	req, err := dto.Bind[dto.UpdateMyAvatarRequest](c)
	if err != nil {
		return err
	}
	user, err := h.users.UpdateMyAvatar(c.Request().Context(), mw.UserID(c), req.MediaID, c.RealIP())
	if err != nil {
		return err
	}
	return response.OK(c, user)
}

func (h *UserHandler) List(c echo.Context) error {
	var q dto.ListUsersQuery
	if err := c.Bind(&q); err != nil {
		return apperr.BadRequest("invalid query parameters")
	}
	if err := c.Validate(&q); err != nil {
		return err
	}
	q.Normalize()
	users, total, err := h.users.List(c.Request().Context(), q)
	if err != nil {
		return err
	}
	return response.List(c, users, response.Meta{Page: q.Page, PerPage: q.PerPage, Total: total})
}

func (h *UserHandler) Get(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	user, err := h.users.Get(c.Request().Context(), id)
	if err != nil {
		return err
	}
	return response.OK(c, user)
}

func (h *UserHandler) Create(c echo.Context) error {
	req, err := dto.Bind[dto.CreateUserRequest](c)
	if err != nil {
		return err
	}
	user, err := h.users.Create(c.Request().Context(), req, mw.UserID(c), c.RealIP())
	if err != nil {
		return err
	}
	return response.Created(c, user)
}

func (h *UserHandler) Update(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.UpdateUserRequest](c)
	if err != nil {
		return err
	}
	user, err := h.users.Update(c.Request().Context(), id, req, mw.UserID(c), c.RealIP())
	if err != nil {
		return err
	}
	return response.OK(c, user)
}

func (h *UserHandler) Delete(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	if err := h.users.Delete(c.Request().Context(), id, mw.UserID(c), c.RealIP()); err != nil {
		return err
	}
	return response.NoContent(c)
}

func paramID(c echo.Context) (uint64, error) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		return 0, apperr.BadRequest("invalid id")
	}
	return id, nil
}
