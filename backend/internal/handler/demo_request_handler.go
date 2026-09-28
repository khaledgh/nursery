package handler

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
	"golang.org/x/time/rate"

	"github.com/sunnystars/backend/internal/dto"
	mw "github.com/sunnystars/backend/internal/middleware"
	"github.com/sunnystars/backend/internal/pkg/apperr"
	"github.com/sunnystars/backend/internal/pkg/response"
	"github.com/sunnystars/backend/internal/service"
)

type DemoRequestHandler struct {
	svc *service.DemoRequestService
}

func NewDemoRequestHandler(svc *service.DemoRequestService) *DemoRequestHandler {
	return &DemoRequestHandler{svc: svc}
}

// Register exposes the landing-site form publicly and the lead inbox to
// superadmins only.
func (h *DemoRequestHandler) Register(public, protected *echo.Group) {
	// A real visitor submits once; 5 per 10 minutes per IP stops form spam
	// without the looser auth limiter's burst allowance.
	formLimiter := echomw.RateLimiterWithConfig(echomw.RateLimiterConfig{
		Store: echomw.NewRateLimiterMemoryStoreWithConfig(echomw.RateLimiterMemoryStoreConfig{
			Rate: rate.Every(2 * time.Minute), Burst: 5, ExpiresIn: 30 * time.Minute,
		}),
		ErrorHandler: func(c echo.Context, err error) error {
			return response.Err(c, http.StatusTooManyRequests, "rate_limited", "too many requests", nil)
		},
		DenyHandler: func(c echo.Context, identifier string, err error) error {
			return response.Err(c, http.StatusTooManyRequests, "rate_limited", "too many requests, try again later", nil)
		},
	})
	public.POST("/demo-requests", h.Create, formLimiter)

	g := protected.Group("/superadmin", mw.RequireSuperAdmin())
	g.GET("/demo-requests", h.List)
	g.PUT("/demo-requests/:id", h.Update)
	g.DELETE("/demo-requests/:id", h.Delete)
}

func (h *DemoRequestHandler) Create(c echo.Context) error {
	req, err := dto.Bind[dto.CreateDemoRequest](c)
	if err != nil {
		return err
	}
	// Honeypot tripped: answer like a success so the bot learns nothing.
	if req.Website != "" {
		return response.Created(c, map[string]bool{"ok": true})
	}
	if _, err := h.svc.Create(c.Request().Context(), req, c.RealIP(), c.Request().UserAgent()); err != nil {
		return err
	}
	return response.Created(c, map[string]bool{"ok": true})
}

func (h *DemoRequestHandler) List(c echo.Context) error {
	var q dto.PageQuery
	if err := c.Bind(&q); err != nil {
		return apperr.BadRequest("invalid query parameters")
	}
	q.Normalize()
	rows, total, err := h.svc.List(c.Request().Context(), q)
	if err != nil {
		return err
	}
	return response.List(c, rows, response.Meta{Page: q.Page, PerPage: q.PerPage, Total: total})
}

func (h *DemoRequestHandler) Update(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	req, err := dto.Bind[dto.UpdateDemoRequest](c)
	if err != nil {
		return err
	}
	row, err := h.svc.Update(c.Request().Context(), id, req, mw.AuditActor(c), c.RealIP())
	if err != nil {
		return err
	}
	return response.OK(c, row)
}

func (h *DemoRequestHandler) Delete(c echo.Context) error {
	id, err := paramID(c)
	if err != nil {
		return err
	}
	if err := h.svc.Delete(c.Request().Context(), id, mw.AuditActor(c), c.RealIP()); err != nil {
		return err
	}
	return response.NoContent(c)
}
