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
	ID            uint64 `json:"id"`
	Name          string `json:"name"`
	Slug          string `json:"slug"`
	LoginIDPrefix string `json:"login_id_prefix,omitempty"`
	Status        string `json:"status"`
	Locale        string `json:"locale"`
	Timezone      string `json:"timezone"`
}

// --- superadmin console ---

type CreateNurseryRequest struct {
	Name          string `json:"name" validate:"required,min=2,max=191"`
	Slug          string `json:"slug" validate:"required,min=2,max=64,alphanum|containsany=-"`
	LoginIDPrefix string `json:"login_id_prefix" validate:"omitempty,max=32"`
	Locale        string `json:"locale" validate:"omitempty,max=10"`
	Timezone      string `json:"timezone" validate:"omitempty,max=64"`
	PlanCode      string `json:"plan_code" validate:"omitempty,max=32"`

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

type AutoRunResult struct {
	GeneratedInvoices int `json:"generated_invoices"`
	OverdueMarked     int `json:"overdue_marked"`
}

type PlatformReminder struct {
	ID          string `json:"id"`
	Type        string `json:"type"`        // "overdue", "capacity", "renewal", "grace"
	Severity    string `json:"severity"`    // "high", "medium", "info"
	NurseryID   uint64 `json:"nursery_id"`
	NurseryName string `json:"nursery_name"`
	Title       string `json:"title"`
	Description string `json:"description"`
	ActionType  string `json:"action_type"` // "mark_paid", "upgrade_plan", "contact"
	ActionID    uint64 `json:"action_id,omitempty"`
	DueDate     string `json:"due_date,omitempty"`
}

type TierBreakdown struct {
	PlanCode      string `json:"plan_code"`
	PlanName      string `json:"plan_name"`
	BillingPeriod string `json:"billing_period"`
	NurseryCount  int    `json:"nursery_count"`
	RevenueMinor  int64  `json:"revenue_minor"`
}

type PlatformReport struct {
	TotalNurseries     int64           `json:"total_nurseries"`
	ActiveNurseries    int64           `json:"active_nurseries"`
	PastDueNurseries   int64           `json:"past_due_nurseries"`
	TotalChildren      int64           `json:"total_children"`
	TotalCapacity      int64           `json:"total_capacity"`
	CapacityUsedPct    float64         `json:"capacity_used_pct"`
	MRRMinor           int64           `json:"mrr_minor"`
	ARRMinor           int64           `json:"arr_minor"`
	TotalInvoices      int64           `json:"total_invoices"`
	PaidInvoices       int64           `json:"paid_invoices"`
	OverdueInvoices    int64           `json:"overdue_invoices"`
	PaidAmountMinor    int64           `json:"paid_amount_minor"`
	OverdueAmountMinor int64           `json:"overdue_amount_minor"`
	Tiers              []TierBreakdown `json:"tiers"`
}

// NurseryOverview is one row of the superadmin nursery list.
type NurseryOverview struct {
	NurseryDTO
	PlanCode        string  `json:"plan_code"`
	PlanName        string  `json:"plan_name"`
	PriceMinor      int64   `json:"price_minor"`
	Currency        string  `json:"currency"`
	BillingPeriod   string  `json:"billing_period"`
	NextPaymentDate *string `json:"next_payment_date,omitempty"`
	Status          string  `json:"subscription_status"`
	AllowsWrites    bool    `json:"allows_writes"`
	StudentsUsed    int     `json:"students_used"`
	StudentsMax     int     `json:"students_max"`
	StaffUsed       int     `json:"staff_used"`
	StaffMax        int     `json:"staff_max"`
	AdminEmail      string  `json:"admin_email,omitempty"`
	AdminName       string  `json:"admin_name,omitempty"`
	CreatedAt       string  `json:"created_at"`
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

// --- Nursery Detail Hub DTOs ---

type AgeBucket struct {
	Label      string  `json:"label"`
	MinMonths  int     `json:"min_months"`
	MaxMonths  int     `json:"max_months"`
	Count      int     `json:"count"`
	Percentage float64 `json:"percentage"`
}

type NurseryClassroomOverview struct {
	ID               uint64  `json:"id"`
	Name             string  `json:"name"`
	RoomLocation     string  `json:"room_location"`
	AgeGroup         string  `json:"age_group"`
	Capacity         int     `json:"capacity"`
	ChildrenCount    int     `json:"children_count"`
	AverageAgeMonths float64 `json:"average_age_months"`
	LeadTeacherName  string  `json:"lead_teacher_name"`
	OpensAt          string  `json:"opens_at"`
	ClosesAt         string  `json:"closes_at"`
}

type NurseryChildRegistrant struct {
	ID                   uint64  `json:"id"`
	FirstName            string  `json:"first_name"`
	LastName             string  `json:"last_name"`
	DOB                  string  `json:"dob"`
	AgeYears             float64 `json:"age_years"`
	AgeMonths            int     `json:"age_months"`
	AgeFormatted         string  `json:"age_formatted"`
	Gender               string  `json:"gender"`
	BloodType            string  `json:"blood_type"`
	ClassroomID          *uint64 `json:"classroom_id"`
	ClassroomName        string  `json:"classroom_name"`
	Status               string  `json:"status"`
	PresentStatus        string  `json:"present_status"`
	PrimaryGuardianName  string  `json:"primary_guardian_name"`
	PrimaryGuardianPhone string  `json:"primary_guardian_phone"`
	Relationship         string  `json:"relationship"`
}

type NurseryEmployee struct {
	ID          uint64   `json:"id"`
	Name        string   `json:"name"`
	Email       string   `json:"email"`
	Phone       string   `json:"phone"`
	Role        string   `json:"role"`
	Status      string   `json:"status"`
	Classrooms  []string `json:"classrooms"`
	LastLoginAt *string  `json:"last_login_at"`
}

type NurseryParentContact struct {
	ID            uint64   `json:"id"`
	Name          string   `json:"name"`
	Email         string   `json:"email"`
	Phone         string   `json:"phone"`
	Status        string   `json:"status"`
	ChildrenNames []string `json:"children_names"`
	LastLoginAt   *string  `json:"last_login_at"`
}

type NurseryInvoiceItem struct {
	ID          uint64  `json:"id"`
	InvoiceNo   string  `json:"invoice_no"`
	AmountMinor int64   `json:"amount_minor"`
	Currency    string  `json:"currency"`
	Period      string  `json:"period"`
	DueDate     string  `json:"due_date"`
	Status      string  `json:"status"`
	PaidAt      *string `json:"paid_at"`
}

type NurseryDetailsReport struct {
	Nursery          NurseryOverview            `json:"nursery"`
	TotalChildren    int                        `json:"total_children"`
	TotalStaff       int                        `json:"total_staff"`
	TotalParents     int                        `json:"total_parents"`
	TotalClassrooms  int                        `json:"total_classrooms"`
	AverageAgeMonths float64                    `json:"average_age_months"`
	AverageAgeYears  float64                    `json:"average_age_years"`
	AgeDistribution  []AgeBucket                `json:"age_distribution"`
	Classrooms       []NurseryClassroomOverview `json:"classrooms"`
	Children         []NurseryChildRegistrant   `json:"children"`
	Staff            []NurseryEmployee          `json:"staff"`
	Parents          []NurseryParentContact     `json:"parents"`
	Invoices         []NurseryInvoiceItem       `json:"invoices"`
}

