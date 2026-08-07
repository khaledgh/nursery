package model

import (
	"time"

	"gorm.io/datatypes"
)

type BillingPeriod string

const (
	BillingMonthly BillingPeriod = "monthly"
	BillingYearly  BillingPeriod = "yearly"
)

// Plan is a platform-level product definition, shared by every nursery, so it
// carries no nursery_id.
type Plan struct {
	Base
	Code          string         `gorm:"size:32;not null;uniqueIndex" json:"code"`
	Name          string         `gorm:"size:191;not null" json:"name"`
	MaxStudents   int            `gorm:"not null" json:"max_students"`
	MaxStaff      int            `gorm:"not null;default:0" json:"max_staff"` // 0 = unlimited
	PriceMinor    int64          `gorm:"not null" json:"price_minor"`
	Currency      string         `gorm:"size:3;not null;default:'SEK'" json:"currency"`
	BillingPeriod BillingPeriod  `gorm:"type:enum('monthly','yearly');not null;default:'monthly'" json:"billing_period"`
	FeaturesJSON  datatypes.JSON `json:"features,omitempty"`
	IsActive      bool           `gorm:"not null;default:true" json:"is_active"`
}

type SubscriptionStatus string

const (
	SubTrialing  SubscriptionStatus = "trialing"
	SubActive    SubscriptionStatus = "active"
	SubPastDue   SubscriptionStatus = "past_due"
	SubSuspended SubscriptionStatus = "suspended"
	SubCancelled SubscriptionStatus = "cancelled"
)

// Subscription is one nursery's plan. MaxStudents/MaxStaff are copied from the
// plan on assignment so a superadmin can grant a per-nursery override without
// forking the plan.
//
// It embeds Base rather than TenantBase: the subscription is read while
// deciding what a tenant may do, and scoping it through the same callback that
// it gates would be circular. Lookups are explicitly by nursery_id instead.
type Subscription struct {
	Base
	NurseryID          uint64             `gorm:"not null;uniqueIndex" json:"nursery_id"`
	PlanID             uint64             `gorm:"not null" json:"plan_id"`
	Plan               *Plan              `gorm:"foreignKey:PlanID" json:"plan,omitempty"`
	Status             SubscriptionStatus `gorm:"type:enum('trialing','active','past_due','suspended','cancelled');not null;default:'trialing'" json:"status"`
	MaxStudents        int                `gorm:"not null" json:"max_students"`
	MaxStaff           int                `gorm:"not null;default:0" json:"max_staff"`
	CurrentPeriodStart *string            `gorm:"type:date" json:"current_period_start"`
	CurrentPeriodEnd   *string            `gorm:"type:date" json:"current_period_end"`
	TrialEndsAt        *string            `gorm:"type:date" json:"trial_ends_at"`
	GraceUntil         *string            `gorm:"type:date" json:"grace_until"`
	Notes              string             `gorm:"type:text" json:"notes"`
}

// AllowsWrites reports whether the nursery may still create and modify data.
//
// Reads stay open in every state: locking a nursery out of its own children's
// medical records over a late invoice is not acceptable. Only writes stop.
func (s *Subscription) AllowsWrites() bool {
	switch s.Status {
	case SubActive, SubTrialing:
		return true
	case SubPastDue:
		// Past due is a grace window, not an immediate lockout.
		if s.GraceUntil == nil {
			return true
		}
		return time.Now().Format("2006-01-02") <= *s.GraceUntil
	default: // suspended, cancelled
		return false
	}
}

// NeedsPaymentWarning reports whether the admin should see a billing banner.
func (s *Subscription) NeedsPaymentWarning() bool {
	return s.Status == SubPastDue || s.Status == SubSuspended
}

// SubscriptionInvoice is what a nursery owes the platform, distinct from the
// per-child tuition invoices the nursery bills its own parents.
type SubscriptionInvoice struct {
	Base
	NurseryID      uint64        `gorm:"not null;index" json:"nursery_id"`
	SubscriptionID uint64        `gorm:"not null" json:"subscription_id"`
	InvoiceNo      string        `gorm:"size:30;not null;uniqueIndex" json:"invoice_no"`
	AmountMinor    int64         `gorm:"not null" json:"amount_minor"`
	Currency       string        `gorm:"size:3;not null;default:'SEK'" json:"currency"`
	Period         string        `gorm:"size:20;not null" json:"period"`
	DueDate        string        `gorm:"type:date;not null" json:"due_date"`
	Status         InvoiceStatus `gorm:"type:enum('due','paid','overdue','cancelled');not null;default:'due'" json:"status"`
	PaidAt         *time.Time    `json:"paid_at"`
	MarkedPaidBy   *uint64       `json:"marked_paid_by"`
}

// Capability names. A nursery only sees the modules its plan includes.
const (
	CapPayments  = "payments"
	CapReports   = "reports"
	CapCommunity = "community"
	CapChat      = "chat"
	CapEvents    = "events"
	CapHealth    = "health"
)

// AllCapabilities is the full set, granted by default on a new nursery.
var AllCapabilities = []string{
	CapPayments, CapReports, CapCommunity, CapChat, CapEvents, CapHealth,
}

// NurseryCapability toggles one module for one nursery. Superadmin-controlled.
type NurseryCapability struct {
	ID         uint64    `gorm:"primaryKey" json:"id"`
	NurseryID  uint64    `gorm:"not null;uniqueIndex:ux_nursery_capability,priority:1" json:"nursery_id"`
	Capability string    `gorm:"size:64;not null;uniqueIndex:ux_nursery_capability,priority:2" json:"capability"`
	Enabled    bool      `gorm:"not null;default:true" json:"enabled"`
	GrantedBy  *uint64   `json:"granted_by"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}
