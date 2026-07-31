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

type ClassroomHandler struct {
	classrooms *service.ClassroomService
}

func NewClassroomHandler(classrooms *service.ClassroomService) *ClassroomHandler {
	return &ClassroomHandler{classrooms: classrooms}
}

func (h *ClassroomHandler) Register(protected *echo.Group) {
	protected.GET("/classrooms", h.List)
	protected.GET("/classrooms/:id", h.Get)

	admin := protected.Group("/admin", mw.RequireRole(model.RoleAdmin))
	admin.POST("/classrooms", h.Create)
	admin.PUT("/classrooms/:id", h.Update)
	admin.DELETE("/classrooms/:id", h.Delete)
	admin.POST("/classrooms/:id/teachers", h.AssignTeacher)
	admin.DELETE("/classrooms/:id/teachers/:teacherId", h.UnassignTeacher)
}

func (h *ClassroomHandler) List(c echo.Context) error {
	var q dto.PageQuery
	if err := c.Bind(&q); err != nil {
		return apperr.BadRequest("invalid query parameters")
	}
	q.Normalize()
	rooms, total, err := h.classrooms.List(c.Request().Context(), q, mw.RequestLocale(c), mw.Role(c), mw.UserID(c))
	if err != nil {
		return err
	}
	return response.List(c, rooms, response.Meta{Page: q.Page, PerPage: q.PerPage, Total: total})
}

func (h *ClassroomHandler) Get(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	room, err := h.classrooms.Get(c.Request().Context(), id, mw.RequestLocale(c))
	if err != nil {
		return err
	}
	return response.OK(c, room)
}

func (h *ClassroomHandler) Create(c echo.Context) error {
	req, err := dto.Bind[dto.CreateClassroomRequest](c)
	if err != nil {
		return err
	}
	room, err := h.classrooms.Create(c.Request().Context(), req, mw.UserID(c), c.RealIP())
	if err != nil {
		return err
	}
	return response.Created(c, room)
}

func (h *ClassroomHandler) Update(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.UpdateClassroomRequest](c)
	if err != nil {
		return err
	}
	room, err := h.classrooms.Update(c.Request().Context(), id, req, mw.UserID(c), c.RealIP())
	if err != nil {
		return err
	}
	return response.OK(c, room)
}

func (h *ClassroomHandler) Delete(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	if err := h.classrooms.Delete(c.Request().Context(), id, mw.UserID(c), c.RealIP()); err != nil {
		return err
	}
	return response.NoContent(c)
}

func (h *ClassroomHandler) AssignTeacher(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.AssignTeacherRequest](c)
	if err != nil {
		return err
	}
	if err := h.classrooms.AssignTeacher(c.Request().Context(), id, req, mw.UserID(c), c.RealIP()); err != nil {
		return err
	}
	return response.NoContent(c)
}

func (h *ClassroomHandler) UnassignTeacher(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	teacherID, err := strconv.ParseUint(c.Param("teacherId"), 10, 64)
	if err != nil || teacherID == 0 {
		return apperr.BadRequest("invalid teacher id")
	}
	if err := h.classrooms.UnassignTeacher(c.Request().Context(), id, teacherID, mw.UserID(c), c.RealIP()); err != nil {
		return err
	}
	return response.NoContent(c)
}
