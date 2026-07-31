package handler

import (
	"github.com/labstack/echo/v4"

	"github.com/sunnystars/backend/internal/dto"
	mw "github.com/sunnystars/backend/internal/middleware"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
	"github.com/sunnystars/backend/internal/pkg/response"
	"github.com/sunnystars/backend/internal/service"
)

type AttendanceHandler struct {
	attendance *service.AttendanceService
}

func NewAttendanceHandler(attendance *service.AttendanceService) *AttendanceHandler {
	return &AttendanceHandler{attendance: attendance}
}

func (h *AttendanceHandler) Register(protected *echo.Group) {
	protected.GET("/children/:id/attendance", h.List)
	protected.POST("/children/:id/attendance", h.Request)

	staff := protected.Group("", mw.RequireRole(model.RoleTeacher, model.RoleAdmin))
	staff.GET("/attendance/pending", h.ListPending)
	staff.POST("/attendance/:id/confirm", h.Confirm)
	staff.POST("/children/:id/check", h.CheckInOut)
}

func (h *AttendanceHandler) ListPending(c echo.Context) error {
	var q dto.PageQuery
	if err := c.Bind(&q); err != nil {
		return apperr.BadRequest("invalid query parameters")
	}
	q.Normalize()
	rows, total, err := h.attendance.ListPending(c.Request().Context(), q, mw.Role(c), mw.UserID(c))
	if err != nil {
		return err
	}
	return response.List(c, rows, response.Meta{Page: q.Page, PerPage: q.PerPage, Total: total})
}

func (h *AttendanceHandler) List(c echo.Context) error {
	childID, err := paramID(c)
	if err != nil {
		return err
	}
	var q dto.ListAttendanceQuery
	if err := c.Bind(&q); err != nil {
		return apperr.BadRequest("invalid query parameters")
	}
	if err := c.Validate(&q); err != nil {
		return err
	}
	q.Normalize()
	rows, total, err := h.attendance.List(c.Request().Context(), mw.Role(c), mw.UserID(c), childID, q)
	if err != nil {
		return err
	}
	return response.List(c, rows, response.Meta{Page: q.Page, PerPage: q.PerPage, Total: total})
}

func (h *AttendanceHandler) Request(c echo.Context) error {
	childID, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.AttendanceRequest](c)
	if err != nil {
		return err
	}
	row, err := h.attendance.Request(c.Request().Context(), mw.Role(c), mw.UserID(c), childID, req, c.RealIP())
	if err != nil {
		return err
	}
	return response.Created(c, row)
}

func (h *AttendanceHandler) Confirm(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	row, err := h.attendance.Confirm(c.Request().Context(), mw.Role(c), mw.UserID(c), id, c.RealIP())
	if err != nil {
		return err
	}
	return response.OK(c, row)
}

func (h *AttendanceHandler) CheckInOut(c echo.Context) error {
	childID, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.CheckInOutRequest](c)
	if err != nil {
		return err
	}
	child, err := h.attendance.CheckInOut(c.Request().Context(), mw.Role(c), mw.UserID(c), childID, req.Action, c.RealIP())
	if err != nil {
		return err
	}
	return response.OK(c, child)
}
