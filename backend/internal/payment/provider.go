// Package payment abstracts payment gateways so a second provider can be
// added without touching handlers or the invoice service.
package payment

import "context"

type Request struct {
	ProviderRef string // our reference stored on the payment row
	Token       string // gateway token/URL the client uses to complete payment
}

type Status struct {
	Paid     bool
	Declined bool
	Raw      []byte // gateway response stored for the audit trail
}

type Provider interface {
	Name() string
	// CreatePayment initiates a payment for amountMinor in currency,
	// referencing our invoice number.
	CreatePayment(ctx context.Context, invoiceNo string, amountMinor int64, currency, payerAlias string) (*Request, error)
	// VerifyPayment fetches the authoritative status from the gateway.
	// Webhook payloads are never trusted directly — this call decides.
	VerifyPayment(ctx context.Context, providerRef string) (*Status, error)
}
