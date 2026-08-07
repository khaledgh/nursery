package dto

import "github.com/sunnystars/backend/internal/model"

// CreateFamilyRequest builds a parent, a child, and the link between them in
// one submit. Supply either ParentUserID (adding a sibling to an existing
// family) or Parent (a brand-new family).
type CreateFamilyRequest struct {
	ParentUserID *uint64           `json:"parent_user_id"`
	Parent       *NewParentInput   `json:"parent" validate:"omitempty"`
	Child        NewChildInput     `json:"child" validate:"required"`
	Link         GuardianLinkInput `json:"link"`
}

type NewParentInput struct {
	Name  string `json:"name" validate:"required,min=2,max=191"`
	Email string `json:"email" validate:"required,email,max=191"`
	Phone string `json:"phone" validate:"omitempty,max=32"`
	// Optional: when omitted a random password is set, since the parent signs
	// in with their login id and the admin sends a reset.
	Password string `json:"password" validate:"omitempty,min=8,max=72"`
	Locale   string `json:"locale" validate:"omitempty,max=10"`
}

type NewChildInput struct {
	FirstName   string  `json:"first_name" validate:"required,min=1,max=100"`
	LastName    string  `json:"last_name" validate:"required,min=1,max=100"`
	DOB         string  `json:"dob" validate:"required,len=10"`
	Gender      string  `json:"gender" validate:"omitempty,max=20"`
	BloodType   string  `json:"blood_type" validate:"omitempty,max=10"`
	ClassroomID *uint64 `json:"classroom_id"`
}

type GuardianLinkInput struct {
	Relationship string `json:"relationship" validate:"omitempty,max=50"`
	IsPrimary    bool   `json:"is_primary"`
	CanPickup    bool   `json:"can_pickup"`
}

type FamilyParent struct {
	ID      uint64  `json:"id"`
	Name    string  `json:"name"`
	Email   string  `json:"email"`
	Phone   string  `json:"phone"`
	LoginID *string `json:"login_id,omitempty"`
	Status  string  `json:"status"`
	Locale  string  `json:"locale"`
}

type FamilyChild struct {
	*model.Child
	Relationship string `json:"relationship"`
	IsPrimary    bool   `json:"is_primary"`
	CanPickup    bool   `json:"can_pickup"`
}

// FamilyResponse carries the new parent's login id back so the admin can hand
// it over — printed or read out — before leaving the screen.
type FamilyResponse struct {
	Parent  FamilyParent `json:"parent"`
	Child   *model.Child `json:"child"`
	Created bool         `json:"created"`
}

// ParentDetail backs /parents/:id: the family hub the admin panel never had.
type ParentDetail struct {
	Parent           FamilyParent    `json:"parent"`
	Children         []FamilyChild   `json:"children"`
	Invoices         []model.Invoice `json:"invoices"`
	OutstandingMinor int64           `json:"outstanding_minor"`
	PaidMinor        int64           `json:"paid_minor"`
	UnpaidInvoices   int             `json:"unpaid_invoices"`
}
