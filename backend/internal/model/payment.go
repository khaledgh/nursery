package model

import (
	"time"

	"gorm.io/datatypes"
)

type InvoiceStatus string

const (
	InvoiceDue       InvoiceStatus = "due"
	InvoicePaid      InvoiceStatus = "paid"
	InvoiceOverdue   InvoiceStatus = "overdue"
	InvoiceCancelled InvoiceStatus = "cancelled"
)

type Invoice struct {
	TenantBase
	ChildID     uint64 `gorm:"not null;index" json:"child_id"`
	Child       *Child `gorm:"foreignKey:ChildID" json:"child,omitempty"`
	PayerUserID uint64 `gorm:"not null;index" json:"payer_user_id"`
	InvoiceNo   string `gorm:"size:30;not null;uniqueIndex" json:"invoice_no"`
	Currency    string `gorm:"size:3;not null;default:'SEK'" json:"currency"`
	// Amounts are stored in minor units (öre/cents) — never floats.
	TotalMinor int64         `gorm:"not null" json:"total_minor"`
	DueDate    string        `gorm:"type:date;not null" json:"due_date"`
	Status     InvoiceStatus `gorm:"type:enum('due','paid','overdue','cancelled');not null;default:'due'" json:"status"`
	Period     string        `gorm:"size:20" json:"period"` // e.g. "2026-06"
	Items      []InvoiceItem `json:"items,omitempty"`
	Payments   []Payment     `json:"payments,omitempty"`
}

type InvoiceItem struct {
	ID          uint64 `gorm:"primaryKey" json:"id"`
	InvoiceID   uint64 `gorm:"not null;index" json:"-"`
	Label       string `gorm:"size:191;not null" json:"label"`
	AmountMinor int64  `gorm:"not null" json:"amount_minor"`
}

type PaymentStatus string

const (
	PaymentPending  PaymentStatus = "pending"
	PaymentPaid     PaymentStatus = "paid"
	PaymentDeclined PaymentStatus = "declined"
	PaymentError    PaymentStatus = "error"
)

type Payment struct {
	TenantBase
	InvoiceID      uint64         `gorm:"not null;index" json:"invoice_id"`
	Provider       string         `gorm:"size:20;not null" json:"provider"` // swish | mock
	ProviderRef    string         `gorm:"size:100;not null;uniqueIndex" json:"provider_ref"`
	AmountMinor    int64          `gorm:"not null" json:"amount_minor"`
	Status         PaymentStatus  `gorm:"type:enum('pending','paid','declined','error');not null;default:'pending'" json:"status"`
	PaidAt         *time.Time     `json:"paid_at"`
	InitiatedBy    uint64         `gorm:"not null" json:"initiated_by"`
	RawPayloadJSON datatypes.JSON `json:"-"`
}
