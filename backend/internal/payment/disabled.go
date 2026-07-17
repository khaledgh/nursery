package payment

import (
	"context"
	"errors"
)

// DisabledProvider is used in production when Swish is not configured:
// invoices still work, but payment initiation fails loudly instead of
// silently auto-approving like the mock would.
type DisabledProvider struct{}

func (DisabledProvider) Name() string { return "disabled" }

func (DisabledProvider) CreatePayment(context.Context, string, int64, string, string) (*Request, error) {
	return nil, errors.New("payments are not configured on this server")
}

func (DisabledProvider) VerifyPayment(context.Context, string) (*Status, error) {
	return nil, errors.New("payments are not configured on this server")
}
