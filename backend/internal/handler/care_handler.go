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

type CareHandler struct {
	care *service.CareService
}

func NewCareHandler(care *service.CareService) *CareHandler {
	return &CareHandler{care: care}
}

func (h *CareHandler) Register(protected *echo.Group) {
	// Reads: any authorized viewer of the child.
	protected.GET("/children/:id/dashboard", h.Dashboard)
	protected.GET("/children/:id/diary", h.ListDiary)
	protected.GET("/children/:id/timeline", h.ListDiary) // alias per the API plan
	protected.GET("/children/:id/meals", h.ListMeals)
	protected.GET("/children/:id/sleep", h.ListSleep)
	protected.GET("/children/:id/sleep/history", h.ListSleep)
	protected.GET("/children/:id/diaper", h.ListDiapers)
	protected.GET("/children/:id/diaper/history", h.ListDiapers)
	protected.GET("/children/:id/hydration", h.ListHydration)
	protected.GET("/classrooms/:id/menu", h.MenuForWeek)
	protected.GET("/classrooms/:id/schedule", h.Schedule)
	protected.GET("/classrooms/:id/weekly-plan", h.PlanForWeek)
	protected.GET("/classrooms/:id/children", h.Classmates)

	// Parent action.
	protected.POST("/menu/:id/ratings", h.RateMenu)

	// Writes: teachers and admins only.
	staff := protected.Group("", mw.RequireRole(model.RoleTeacher, model.RoleAdmin))
	staff.POST("/children/:id/diary", h.CreateDiary)
	staff.POST("/children/:id/meals", h.CreateMeal)
	staff.POST("/children/:id/sleep", h.CreateSleep)
	staff.POST("/children/:id/diaper", h.CreateDiaper)
	staff.PUT("/children/:id/hydration", h.UpsertHydration)
	staff.PUT("/classrooms/:id/menu", h.UpsertMenu)
	staff.PUT("/classrooms/:id/schedule", h.ReplaceSchedule)
	staff.PUT("/classrooms/:id/weekly-plan", h.UpsertPlan)
}

func bindRange(c echo.Context) (dto.RangeQuery, error) {
	var q dto.RangeQuery
	if err := c.Bind(&q); err != nil {
		return q, apperr.BadRequest("invalid query parameters")
	}
	if err := c.Validate(&q); err != nil {
		return q, err
	}
	q.Normalize()
	return q, nil
}

func (h *CareHandler) Dashboard(c echo.Context) error {
	childID, err := paramID(c)
	if err != nil {
		return err
	}
	data, err := h.care.Dashboard(c.Request().Context(), mw.Role(c), mw.UserID(c), childID)
	if err != nil {
		return err
	}
	return response.OK(c, data)
}

func (h *CareHandler) ListDiary(c echo.Context) error {
	childID, err := paramID(c)
	if err != nil {
		return err
	}
	q, err := bindRange(c)
	if err != nil {
		return err
	}
	items, total, err := h.care.ListDiary(c.Request().Context(), mw.Role(c), mw.UserID(c), childID, q)
	if err != nil {
		return err
	}
	return response.List(c, items, response.Meta{Page: q.Page, PerPage: q.PerPage, Total: total})
}

func (h *CareHandler) CreateDiary(c echo.Context) error {
	childID, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.CreateDiaryEntryRequest](c)
	if err != nil {
		return err
	}
	entry, err := h.care.CreateDiary(c.Request().Context(), mw.Role(c), mw.UserID(c), childID, req, c.RealIP())
	if err != nil {
		return err
	}
	return response.Created(c, entry)
}

func (h *CareHandler) ListMeals(c echo.Context) error {
	childID, err := paramID(c)
	if err != nil {
		return err
	}
	q, err := bindRange(c)
	if err != nil {
		return err
	}
	items, total, err := h.care.ListMeals(c.Request().Context(), mw.Role(c), mw.UserID(c), childID, q)
	if err != nil {
		return err
	}
	return response.List(c, items, response.Meta{Page: q.Page, PerPage: q.PerPage, Total: total})
}

func (h *CareHandler) CreateMeal(c echo.Context) error {
	childID, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.CreateMealLogRequest](c)
	if err != nil {
		return err
	}
	m, err := h.care.CreateMeal(c.Request().Context(), mw.Role(c), mw.UserID(c), childID, req, c.RealIP())
	if err != nil {
		return err
	}
	return response.Created(c, m)
}

func (h *CareHandler) ListSleep(c echo.Context) error {
	childID, err := paramID(c)
	if err != nil {
		return err
	}
	q, err := bindRange(c)
	if err != nil {
		return err
	}
	items, total, err := h.care.ListSleep(c.Request().Context(), mw.Role(c), mw.UserID(c), childID, q)
	if err != nil {
		return err
	}
	return response.List(c, items, response.Meta{Page: q.Page, PerPage: q.PerPage, Total: total})
}

func (h *CareHandler) CreateSleep(c echo.Context) error {
	childID, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.CreateSleepLogRequest](c)
	if err != nil {
		return err
	}
	sl, err := h.care.CreateSleep(c.Request().Context(), mw.Role(c), mw.UserID(c), childID, req, c.RealIP())
	if err != nil {
		return err
	}
	return response.Created(c, sl)
}

func (h *CareHandler) ListDiapers(c echo.Context) error {
	childID, err := paramID(c)
	if err != nil {
		return err
	}
	q, err := bindRange(c)
	if err != nil {
		return err
	}
	items, total, err := h.care.ListDiapers(c.Request().Context(), mw.Role(c), mw.UserID(c), childID, q)
	if err != nil {
		return err
	}
	return response.List(c, items, response.Meta{Page: q.Page, PerPage: q.PerPage, Total: total})
}

func (h *CareHandler) CreateDiaper(c echo.Context) error {
	childID, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.CreateDiaperLogRequest](c)
	if err != nil {
		return err
	}
	d, err := h.care.CreateDiaper(c.Request().Context(), mw.Role(c), mw.UserID(c), childID, req, c.RealIP())
	if err != nil {
		return err
	}
	return response.Created(c, d)
}

func (h *CareHandler) ListHydration(c echo.Context) error {
	childID, err := paramID(c)
	if err != nil {
		return err
	}
	q, err := bindRange(c)
	if err != nil {
		return err
	}
	items, total, err := h.care.ListHydration(c.Request().Context(), mw.Role(c), mw.UserID(c), childID, q)
	if err != nil {
		return err
	}
	return response.List(c, items, response.Meta{Page: q.Page, PerPage: q.PerPage, Total: total})
}

func (h *CareHandler) UpsertHydration(c echo.Context) error {
	childID, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.UpsertHydrationRequest](c)
	if err != nil {
		return err
	}
	hl, err := h.care.UpsertHydration(c.Request().Context(), mw.Role(c), mw.UserID(c), childID, req, c.RealIP())
	if err != nil {
		return err
	}
	return response.OK(c, hl)
}

func (h *CareHandler) MenuForWeek(c echo.Context) error {
	classroomID, err := paramID(c)
	if err != nil {
		return err
	}
	menus, err := h.care.MenuForWeek(c.Request().Context(), mw.Role(c), mw.UserID(c), classroomID, c.QueryParam("week"))
	if err != nil {
		return err
	}
	return response.OK(c, menus)
}

func (h *CareHandler) UpsertMenu(c echo.Context) error {
	classroomID, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.UpsertMenuRequest](c)
	if err != nil {
		return err
	}
	m, err := h.care.UpsertMenu(c.Request().Context(), mw.Role(c), mw.UserID(c), classroomID, req, c.RealIP())
	if err != nil {
		return err
	}
	return response.OK(c, m)
}

func (h *CareHandler) Schedule(c echo.Context) error {
	classroomID, err := paramID(c)
	if err != nil {
		return err
	}
	items, err := h.care.Schedule(c.Request().Context(), mw.Role(c), mw.UserID(c), classroomID)
	if err != nil {
		return err
	}
	return response.OK(c, items)
}

func (h *CareHandler) ReplaceSchedule(c echo.Context) error {
	classroomID, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.ReplaceScheduleRequest](c)
	if err != nil {
		return err
	}
	items, err := h.care.ReplaceSchedule(c.Request().Context(), mw.Role(c), mw.UserID(c), classroomID, req, c.RealIP())
	if err != nil {
		return err
	}
	return response.OK(c, items)
}

func (h *CareHandler) PlanForWeek(c echo.Context) error {
	classroomID, err := paramID(c)
	if err != nil {
		return err
	}
	plan, err := h.care.PlanForWeek(c.Request().Context(), mw.Role(c), mw.UserID(c), classroomID, c.QueryParam("week"))
	if err != nil {
		return err
	}
	return response.OK(c, plan) // null data when no plan exists for the week
}

func (h *CareHandler) UpsertPlan(c echo.Context) error {
	classroomID, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.UpsertWeeklyPlanRequest](c)
	if err != nil {
		return err
	}
	plan, err := h.care.UpsertPlan(c.Request().Context(), mw.Role(c), mw.UserID(c), classroomID, req, c.RealIP())
	if err != nil {
		return err
	}
	return response.OK(c, plan)
}

func (h *CareHandler) Classmates(c echo.Context) error {
	classroomID, err := paramID(c)
	if err != nil {
		return err
	}
	kids, err := h.care.Classmates(c.Request().Context(), mw.Role(c), mw.UserID(c), classroomID)
	if err != nil {
		return err
	}
	return response.OK(c, kids)
}

func (h *CareHandler) RateMenu(c echo.Context) error {
	menuID, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.RateMenuRequest](c)
	if err != nil {
		return err
	}
	rating, err := h.care.RateMenu(c.Request().Context(), mw.Role(c), mw.UserID(c), menuID, req, c.RealIP())
	if err != nil {
		return err
	}
	return response.OK(c, rating)
}
