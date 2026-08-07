package dto

// SeatUsage drives the billing screen, the dashboard seat meter, and the
// "you need to pay" banner.
type SeatUsage struct {
	PlanCode          string  `json:"plan_code"`
	PlanName          string  `json:"plan_name"`
	Status            string  `json:"status"`
	StudentsUsed      int     `json:"students_used"`
	StudentsMax       int     `json:"students_max"`
	StudentsRemaining int     `json:"students_remaining"`
	StaffUsed         int     `json:"staff_used"`
	StaffMax          int     `json:"staff_max"`
	AllowsWrites      bool    `json:"allows_writes"`
	PaymentDue        bool    `json:"payment_due"`
	PeriodEnd         *string `json:"period_end"`
	GraceUntil        *string `json:"grace_until"`
}

// MeContext is the single call the admin SPA makes on load: who am I, which
// nursery, what did we buy, and how many places are left.
type MeContext struct {
	User         AuthUser   `json:"user"`
	Nursery      NurseryDTO `json:"nursery"`
	Capabilities []string   `json:"capabilities"`
	Seats        *SeatUsage `json:"seats,omitempty"`
}

type NurseryDTO struct {
	ID       uint64 `json:"id"`
	Name     string `json:"name"`
	Slug     string `json:"slug"`
	Status   string `json:"status"`
	Locale   string `json:"locale"`
	Timezone string `json:"timezone"`
}

// --- superadmin console ---

type CreateNurseryRequest struct {
	Name     string `json:"name" validate:"required,min=2,max=191"`
	Slug     string `json:"slug" validate:"required,min=2,max=64,alphanum|containsany=-"`
	Locale   string `json:"locale" validate:"omitempty,max=10"`
	Timezone string `json:"timezone" validate:"omitempty,max=64"`
	PlanCode string `json:"plan_code" validate:"omitempty,max=32"`

	// The nursery's first admin, created in the same transaction so a new
	// tenant is never left without a way in.
	AdminName     string `json:"admin_name" validate:"required,min=2,max=191"`
	AdminEmail    string `json:"admin_email" validate:"required,email,max=191"`
	AdminPassword string `json:"admin_password" validate:"required,min=8,max=72"`
}

type UpdateNurseryRequest struct {
	Name     *string `json:"name" validate:"omitempty,min=2,max=191"`
	Status   *string `json:"status" validate:"omitempty,oneof=active suspended cancelled"`
	Locale   *string `json:"locale" validate:"omitempty,max=10"`
	Timezone *string `json:"timezone" validate:"omitempty,max=64"`
}

type AssignSubscriptionRequest struct {
	PlanCode string  `json:"plan_code" validate:"required,max=32"`
	Status   *string `json:"status" validate:"omitempty,oneof=trialing active past_due suspended cancelled"`
	// Optional per-nursery overrides of the plan's limits.
	MaxStudents *int    `json:"max_students" validate:"omitempty,min=0"`
	MaxStaff    *int    `json:"max_staff" validate:"omitempty,min=0"`
	PeriodEnd   *string `json:"current_period_end" validate:"omitempty,len=10"`
	GraceUntil  *string `json:"grace_until" validate:"omitempty,len=10"`
	Notes       *string `json:"notes" validate:"omitempty,max=2000"`
}

type UpdateCapabilitiesRequest struct {
	Capabilities map[string]bool `json:"capabilities" validate:"required"`
}

type PlanRequest struct {
	Code          string `json:"code" validate:"required,max=32"`
	Name          string `json:"name" validate:"required,max=191"`
	MaxStudents   int    `json:"max_students" validate:"min=0"`
	MaxStaff      int    `json:"max_staff" validate:"min=0"`
	PriceMinor    int64  `json:"price_minor" validate:"min=0"`
	Currency      string `json:"currency" validate:"omitempty,len=3"`
	BillingPeriod string `json:"billing_period" validate:"omitempty,oneof=monthly yearly"`
	IsActive      *bool  `json:"is_active"`
}

// PlatformStats is the superadmin dashboard summary.
type PlatformStats struct {
	Nurseries        int64 `json:"nurseries"`
	ActiveNurseries  int64 `json:"active_nurseries"`
	Children         int64 `json:"children"`
	Users            int64 `json:"users"`
	OverdueInvoices  int64 `json:"overdue_invoices"`
	MRRMinor         int64 `json:"mrr_minor"`
	NurseriesPastDue int64 `json:"nurseries_past_due"`
}

// NurseryOverview is one row of the superadmin nursery list.
type NurseryOverview struct {
	NurseryDTO
	PlanCode     string `json:"plan_code"`
	Status       string `json:"subscription_status"`
	StudentsUsed int    `json:"students_used"`
	StudentsMax  int    `json:"students_max"`
	CreatedAt    string `json:"created_at"`
}

// --- global search ---

// SearchHit is one row in the admin ⌘K palette.
type SearchHit struct {
	ID    uint64 `json:"id"`
	Label string `json:"label"`
	Sub   string `json:"sub"`
}

// SearchResults groups hits so the palette can render section headers without
// re-sorting on the client.
type SearchResults struct {
	Children   []SearchHit `json:"children"`
	Parents    []SearchHit `json:"parents"`
	Staff      []SearchHit `json:"staff"`
	Classrooms []SearchHit `json:"classrooms"`
	Invoices   []SearchHit `json:"invoices"`
}
