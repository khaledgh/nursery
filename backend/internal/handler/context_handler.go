package handler

import (
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"

	"github.com/sunnystars/backend/internal/database"
	"github.com/sunnystars/backend/internal/dto"
	mw "github.com/sunnystars/backend/internal/middleware"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
	"github.com/sunnystars/backend/internal/pkg/response"
	"github.com/sunnystars/backend/internal/service"
)

// ContextHandler serves the single bootstrap call the admin SPA makes on load.
type ContextHandler struct {
	subs   *service.SubscriptionService
	users  *service.UserService
	search *service.SearchService
	db     *gorm.DB
}

func NewContextHandler(subs *service.SubscriptionService, users *service.UserService, search *service.SearchService, db *gorm.DB) *ContextHandler {
	return &ContextHandler{subs: subs, users: users, search: search, db: db}
}

func (h *ContextHandler) Register(protected *echo.Group) {
	protected.GET("/me/context", h.MeContext)
	protected.GET("/me/seats", h.Seats)
	// Staff-only: the palette spans every child and family in the nursery.
	protected.GET("/admin/search", h.Search, mw.RequireRole(model.RoleTeacher, model.RoleAdmin))
}

// MeContext bundles identity, tenant, capabilities, and seat usage so the SPA
// can render its nav without a burst of separate calls.
//
// The capability list here is a UI hint only — hiding a nav item is not
// enforcement. RequireCapability on the routes is what actually gates access.
func (h *ContextHandler) MeContext(c echo.Context) error {
	ctx := c.Request().Context()
	claims := mw.Claims(c)
	if claims == nil {
		return apperr.Unauthorized("not signed in")
	}

	var user model.User
	if err := h.db.WithContext(ctx).First(&user, claims.UserID).Error; err != nil {
		return apperr.NotFound("account not found")
	}

	out := dto.MeContext{
		User: dto.AuthUser{
			ID: user.ID, Name: user.Name, Email: user.Email, LoginID: user.LoginID,
			Role: string(user.Role), Locale: user.Locale, NurseryID: user.NurseryID,
		},
	}

	// A superadmin outside any nursery has no tenant context to report.
	nurseryID := claims.NurseryID
	if nurseryID == 0 {
		out.Capabilities = model.AllCapabilities
		return response.OK(c, out)
	}

	var nursery model.Nursery
	if err := h.db.WithContext(database.WithCrossTenant(ctx)).First(&nursery, nurseryID).Error; err == nil {
		out.Nursery = dto.NurseryDTO{
			ID: nursery.ID, Name: nursery.Name, Slug: nursery.Slug,
			Status: string(nursery.Status), Locale: nursery.Locale, Timezone: nursery.Timezone,
		}
	}

	caps, err := h.subs.Capabilities(ctx, nurseryID)
	if err != nil {
		return err
	}
	out.Capabilities = caps

	// Seat usage is staff-only: parents have no reason to see the nursery's
	// commercial position with the platform.
	if model.Role(claims.Role) == model.RoleAdmin || model.Role(claims.Role) == model.RoleSuperAdmin {
		if usage, err := h.subs.Usage(ctx, nurseryID); err == nil {
			out.Seats = usage
		}
	}
	return response.OK(c, out)
}

// Seats backs the dashboard meter and the "you need to pay" banner.
func (h *ContextHandler) Seats(c echo.Context) error {
	nurseryID := mw.NurseryID(c)
	if nurseryID == 0 {
		return apperr.BadRequest("no nursery in context")
	}
	usage, err := h.subs.Usage(c.Request().Context(), nurseryID)
	if err != nil {
		return err
	}
	return response.OK(c, usage)
}

// Search backs the admin ⌘K palette.
func (h *ContextHandler) Search(c echo.Context) error {
	results, err := h.search.Search(c.Request().Context(), mw.NurseryID(c), c.QueryParam("q"))
	if err != nil {
		return err
	}
	return response.OK(c, results)
}
