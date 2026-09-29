package dto

type InvoiceItemInput struct {
	Label       string `json:"label" validate:"required,min=1,max=191"`
	AmountMinor int64  `json:"amount_minor" validate:"required,min=1,max=100000000"`
}

type CreateInvoiceRequest struct {
	ChildID     uint64             `json:"child_id" validate:"required"`
	PayerUserID *uint64            `json:"payer_user_id"` // defaults to the child's primary guardian
	Currency    string             `json:"currency" validate:"omitempty,len=3,uppercase"`
	DueDate     string             `json:"due_date" validate:"required,datetime=2006-01-02"`
	Period      string             `json:"period" validate:"omitempty,max=20"`
	Items       []InvoiceItemInput `json:"items" validate:"required,min=1,max=20,dive"`
}

// MarkInvoicePaidRequest records a payment the nursery office received.
type MarkInvoicePaidRequest struct {
	Method    string `json:"method" validate:"required,oneof=cash bank_transfer card cheque other"`
	Reference string `json:"reference" validate:"omitempty,max=100"`
	Note      string `json:"note" validate:"omitempty,max=500"`
	PaidAt    string `json:"paid_at" validate:"omitempty,datetime=2006-01-02"`
}

type ListInvoicesQuery struct {
	PageQuery
	Status string `query:"status" validate:"omitempty,oneof=due paid overdue cancelled"`
}
