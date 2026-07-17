package handler

import (
	"strconv"

	"github.com/labstack/echo/v4"

	mw "github.com/sunnystars/backend/internal/middleware"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
	"github.com/sunnystars/backend/internal/pkg/response"
	"github.com/sunnystars/backend/internal/service"
)

type HealthHandler struct {
	health *service.HealthService
}

func NewHealthHandler(health *service.HealthService) *HealthHandler {
	return &HealthHandler{health: health}
}

func (h *HealthHandler) Register(protected *echo.Group) {
	protected.GET("/children/:id/health", h.Profile)

	staff := protected.Group("", mw.RequireRole(model.RoleTeacher, model.RoleAdmin))

	registerHealthResource[model.Allergy](protected, staff, h.health, "allergies", "allergy")
	registerHealthResource[model.IllnessLog](protected, staff, h.health, "illnesses", "illness_log")
	registerHealthResource[model.Medication](protected, staff, h.health, "medications", "medication")
	registerHealthResource[model.Immunization](protected, staff, h.health, "immunizations", "immunization")
	registerHealthResource[model.Checkup](protected, staff, h.health, "checkups", "checkup")
	registerHealthResource[model.GrowthRecord](protected, staff, h.health, "growth", "growth_record")
	registerHealthResource[model.VitalLog](protected, staff, h.health, "vitals", "vital_log")
	registerHealthResource[model.EmergencyContact](protected, staff, h.health, "emergency-contacts", "emergency_contact")
	registerHealthResource[model.InsuranceInfo](protected, staff, h.health, "insurance", "insurance_info")
	registerHealthResource[model.MedicalDocument](protected, staff, h.health, "documents", "medical_document")
	registerHealthResource[model.HealthNote](protected, staff, h.health, "notes", "health_note")
}

func (h *HealthHandler) Profile(c echo.Context) error {
	childID, err := paramID(c)
	if err != nil {
		return err
	}
	profile, err := h.health.Profile(c.Request().Context(), mw.Role(c), mw.UserID(c), childID, c.RealIP())
	if err != nil {
		return err
	}
	return response.OK(c, profile)
}

// registerHealthResource wires GET (any authorized viewer) + POST/PUT/DELETE
// (staff) for one health sub-resource under /children/:id/health/<segment>.
func registerHealthResource[T any, PT interface {
	*T
	GetID() uint64
	ResetServerFields()
	SetChildID(uint64)
}](viewers, staff *echo.Group, svc *service.HealthService, segment, entity string) {
	base := "/children/:id/health/" + segment

	viewers.GET(base, func(c echo.Context) error {
		childID, err := paramID(c)
		if err != nil {
			return err
		}
		items, err := service.ListChildResource[T, PT](svc, c.Request().Context(), mw.Role(c), mw.UserID(c), childID)
		if err != nil {
			return err
		}
		return response.OK(c, items)
	})

	staff.POST(base, func(c echo.Context) error {
		childID, err := paramID(c)
		if err != nil {
			return err
		}
		item := PT(new(T))
		if err := c.Bind(item); err != nil {
			return apperr.BadRequest("malformed request body")
		}
		if err := service.CreateChildResource[T, PT](svc, c.Request().Context(), mw.Role(c), mw.UserID(c), childID, item, entity, c.RealIP()); err != nil {
			return err
		}
		return response.Created(c, item)
	})

	staff.PUT(base+"/:itemId", func(c echo.Context) error {
		childID, err := paramID(c)
		if err != nil {
			return err
		}
		itemID, err := strconv.ParseUint(c.Param("itemId"), 10, 64)
		if err != nil || itemID == 0 {
			return apperr.BadRequest("invalid item id")
		}
		item := PT(new(T))
		if err := c.Bind(item); err != nil {
			return apperr.BadRequest("malformed request body")
		}
		if err := service.UpdateChildResource[T, PT](svc, c.Request().Context(), mw.Role(c), mw.UserID(c), childID, itemID, item, entity, c.RealIP()); err != nil {
			return err
		}
		return response.OK(c, item)
	})

	staff.DELETE(base+"/:itemId", func(c echo.Context) error {
		childID, err := paramID(c)
		if err != nil {
			return err
		}
		itemID, err := strconv.ParseUint(c.Param("itemId"), 10, 64)
		if err != nil || itemID == 0 {
			return apperr.BadRequest("invalid item id")
		}
		if err := service.DeleteChildResource[T, PT](svc, c.Request().Context(), mw.Role(c), mw.UserID(c), childID, itemID, entity, c.RealIP()); err != nil {
			return err
		}
		return response.NoContent(c)
	})
}
