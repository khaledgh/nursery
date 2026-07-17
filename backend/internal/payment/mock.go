package payment

import (
	"context"
	"sync"

	"github.com/google/uuid"
)

// MockProvider is the development gateway: payments auto-succeed on verify.
// main.go refuses to use it when APP_ENV=production.
type MockProvider struct {
	mu   sync.Mutex
	refs map[string]bool
}

func NewMockProvider() *MockProvider {
	return &MockProvider{refs: map[string]bool{}}
}

func (p *MockProvider) Name() string { return "mock" }

func (p *MockProvider) CreatePayment(_ context.Context, invoiceNo string, _ int64, _, _ string) (*Request, error) {
	ref := "MOCK-" + uuid.NewString()
	p.mu.Lock()
	p.refs[ref] = true
	p.mu.Unlock()
	return &Request{ProviderRef: ref, Token: "mock-token-" + invoiceNo}, nil
}

func (p *MockProvider) VerifyPayment(_ context.Context, providerRef string) (*Status, error) {
	p.mu.Lock()
	known := p.refs[providerRef]
	p.mu.Unlock()
	return &Status{Paid: known, Declined: !known, Raw: []byte(`{"status":"MOCK"}`)}, nil
}
