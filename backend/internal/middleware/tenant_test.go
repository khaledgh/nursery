package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"

	"github.com/sunnystars/backend/internal/database"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/jwtutil"
)

// run drives one request through the given middleware with claims already set,
// returning the status and the context the handler saw.
func run(t *testing.T, claims *jwtutil.Claims, mws ...echo.MiddlewareFunc) (int, echo.Context) {
	t.Helper()
	e := echo.New()
	var seen echo.Context
	handler := func(c echo.Context) error {
		seen = c
		return c.NoContent(http.StatusOK)
	}
	// Stand in for the JWT middleware, which would normally set these.
	inject := func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if claims != nil {
				c.Set(ctxClaims, claims)
			}
			return next(c)
		}
	}
	e.GET("/", handler, append([]echo.MiddlewareFunc{inject}, mws...)...)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	return rec.Code, seen
}

func TestTenantPutsNurseryOnContext(t *testing.T) {
	code, c := run(t, &jwtutil.Claims{UserID: 1, Role: "admin", NurseryID: 42}, Tenant())
	if code != http.StatusOK {
		t.Fatalf("status = %d, want 200", code)
	}
	id, ok := database.TenantFrom(c.Request().Context())
	if !ok || id != 42 {
		t.Fatalf("TenantFrom = (%d, %v), want (42, true)", id, ok)
	}
}

// A token minted before multi-tenancy carries no nid. Rejecting it lets the
// client's refresh interceptor silently swap it for a scoped one, rather than
// guessing a nursery or forcing every user to log in again.
func TestTenantRejectsPreTenancyToken(t *testing.T) {
	code, _ := run(t, &jwtutil.Claims{UserID: 1, Role: "parent"}, Tenant())
	if code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401 for a token without a nursery", code)
	}
}

func TestTenantGivesSuperAdminCrossTenantContext(t *testing.T) {
	code, c := run(t, &jwtutil.Claims{UserID: 1, Role: string(model.RoleSuperAdmin)}, Tenant())
	if code != http.StatusOK {
		t.Fatalf("status = %d, want 200", code)
	}
	if !database.IsCrossTenant(c.Request().Context()) {
		t.Fatal("superadmin must get a cross-tenant context")
	}
}

// While impersonating, a superadmin is scoped to the nursery they entered —
// they must not retain platform-wide reach.
func TestTenantScopesImpersonatingSuperAdmin(t *testing.T) {
	claims := &jwtutil.Claims{UserID: 1, Role: "admin", NurseryID: 7, ActingAs: 99}
	code, c := run(t, claims, Tenant())
	if code != http.StatusOK {
		t.Fatalf("status = %d, want 200", code)
	}
	if database.IsCrossTenant(c.Request().Context()) {
		t.Fatal("an impersonation token must not be cross-tenant")
	}
	id, _ := database.TenantFrom(c.Request().Context())
	if id != 7 {
		t.Fatalf("TenantFrom = %d, want 7", id)
	}
}

func TestRequireRoleAdmitsSuperAdminEverywhere(t *testing.T) {
	claims := &jwtutil.Claims{UserID: 1, Role: string(model.RoleSuperAdmin)}
	code, _ := run(t, claims, RequireRole(model.RoleAdmin))
	if code != http.StatusOK {
		t.Fatalf("status = %d, want 200 — superadmin should pass an admin gate", code)
	}
}

func TestRequireRoleStillBlocksOthers(t *testing.T) {
	code, _ := run(t, &jwtutil.Claims{UserID: 1, Role: "parent"}, RequireRole(model.RoleAdmin))
	if code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", code)
	}
}

func TestRequireSuperAdminRejectsNurseryAdmin(t *testing.T) {
	code, _ := run(t, &jwtutil.Claims{UserID: 1, Role: "admin", NurseryID: 1}, RequireSuperAdmin())
	if code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403 — a nursery admin must not reach the console", code)
	}
}

// An impersonation token is scoped to one nursery; replaying it against the
// console it was minted from would escalate back to platform reach.
func TestRequireSuperAdminRejectsImpersonationToken(t *testing.T) {
	claims := &jwtutil.Claims{UserID: 1, Role: string(model.RoleSuperAdmin), NurseryID: 7, ActingAs: 1}
	code, _ := run(t, claims, RequireSuperAdmin())
	if code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", code)
	}
}

func TestRequireSuperAdminAdmitsSuperAdmin(t *testing.T) {
	claims := &jwtutil.Claims{UserID: 1, Role: string(model.RoleSuperAdmin)}
	code, _ := run(t, claims, RequireSuperAdmin())
	if code != http.StatusOK {
		t.Fatalf("status = %d, want 200", code)
	}
}

func TestAuditActorPrefersRealSuperAdmin(t *testing.T) {
	_, c := run(t, &jwtutil.Claims{UserID: 5, Role: "admin", NurseryID: 7, ActingAs: 99}, Tenant())
	if got := AuditActor(c); got != 99 {
		t.Fatalf("AuditActor = %d, want 99 (the real superadmin, not the borrowed identity)", got)
	}
}
