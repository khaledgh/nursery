package model

import (
	"testing"
	"time"
)

func ptr(s string) *string { return &s }

// Writes stop when billing lapses, but reads never do — a nursery must not be
// locked out of its own children's medical records over a late invoice.
func TestSubscriptionAllowsWrites(t *testing.T) {
	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	tomorrow := time.Now().AddDate(0, 0, 1).Format("2006-01-02")

	cases := []struct {
		name  string
		sub   Subscription
		allow bool
	}{
		{"active", Subscription{Status: SubActive}, true},
		{"trialing", Subscription{Status: SubTrialing}, true},
		{"suspended", Subscription{Status: SubSuspended}, false},
		{"cancelled", Subscription{Status: SubCancelled}, false},
		{"past due inside grace", Subscription{Status: SubPastDue, GraceUntil: ptr(tomorrow)}, true},
		{"past due after grace", Subscription{Status: SubPastDue, GraceUntil: ptr(yesterday)}, false},
		{"past due with no grace set", Subscription{Status: SubPastDue}, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := tc.sub.AllowsWrites(); got != tc.allow {
				t.Fatalf("AllowsWrites() = %v, want %v", got, tc.allow)
			}
		})
	}
}

// The grace boundary is inclusive: a nursery keeps working on the final day.
func TestGracePeriodIncludesFinalDay(t *testing.T) {
	today := time.Now().Format("2006-01-02")
	sub := Subscription{Status: SubPastDue, GraceUntil: ptr(today)}
	if !sub.AllowsWrites() {
		t.Fatal("grace must include its final day")
	}
}

func TestNeedsPaymentWarning(t *testing.T) {
	for _, tc := range []struct {
		status SubscriptionStatus
		warn   bool
	}{
		{SubActive, false},
		{SubTrialing, false},
		{SubPastDue, true},
		{SubSuspended, true},
	} {
		sub := Subscription{Status: tc.status}
		if got := sub.NeedsPaymentWarning(); got != tc.warn {
			t.Fatalf("%s: NeedsPaymentWarning() = %v, want %v", tc.status, got, tc.warn)
		}
	}
}

// Superadmin must not be assignable through the ordinary admin user form.
func TestRoleAssignableByAdmin(t *testing.T) {
	if RoleSuperAdmin.AssignableByAdmin() {
		t.Fatal("a nursery admin must not be able to mint a superadmin")
	}
	for _, r := range []Role{RoleAdmin, RoleTeacher, RoleParent} {
		if !r.AssignableByAdmin() {
			t.Fatalf("%s should be assignable by an admin", r)
		}
	}
}

func TestSuperAdminRoleIsValid(t *testing.T) {
	if !RoleSuperAdmin.Valid() {
		t.Fatal("superadmin must be a valid role")
	}
	if Role("root").Valid() {
		t.Fatal("unknown roles must not validate")
	}
}
