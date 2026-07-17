package payment

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

const swishBaseURL = "https://cpc.getswish.net/swish-cpcapi/api/v2"

// SwishProvider talks to the Swish Commerce API using the merchant's mTLS
// client certificate (PKCS#12 not supported here — use a PEM bundle with
// both cert and key, as exported by the Swish portal tooling).
type SwishProvider struct {
	merchantID  string
	callbackURL string
	http        *http.Client
}

func NewSwishProvider(merchantID, certPath, callbackURL string) (*SwishProvider, error) {
	if merchantID == "" || certPath == "" {
		return nil, fmt.Errorf("swish: merchant id and certificate path are required")
	}
	cert, err := tls.LoadX509KeyPair(certPath, certPath)
	if err != nil {
		return nil, fmt.Errorf("swish: load client certificate: %w", err)
	}
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{
			Certificates: []tls.Certificate{cert},
			MinVersion:   tls.VersionTLS12,
		},
	}
	return &SwishProvider{
		merchantID:  merchantID,
		callbackURL: callbackURL,
		http:        &http.Client{Transport: transport, Timeout: 15 * time.Second},
	}, nil
}

func (p *SwishProvider) Name() string { return "swish" }

func (p *SwishProvider) CreatePayment(ctx context.Context, invoiceNo string, amountMinor int64, currency, payerAlias string) (*Request, error) {
	// Swish instruction ids are 32 uppercase hex chars.
	instructionID := strings.ToUpper(strings.ReplaceAll(uuid.NewString(), "-", ""))
	body := map[string]any{
		"payeeAlias":            p.merchantID,
		"currency":              currency,
		"callbackUrl":           p.callbackURL,
		"payeePaymentReference": invoiceNo,
		"message":               "Nursery invoice " + invoiceNo,
		// Swish amounts are major units with decimals.
		"amount": fmt.Sprintf("%d.%02d", amountMinor/100, amountMinor%100),
	}
	if payerAlias != "" {
		body["payerAlias"] = payerAlias
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPut,
		swishBaseURL+"/paymentrequests/"+instructionID, bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	res, err := p.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("swish: create payment: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusCreated {
		snippet, _ := io.ReadAll(io.LimitReader(res.Body, 512))
		return nil, fmt.Errorf("swish: create payment status %d: %s", res.StatusCode, snippet)
	}
	return &Request{
		ProviderRef: instructionID,
		Token:       res.Header.Get("PaymentRequestToken"),
	}, nil
}

func (p *SwishProvider) VerifyPayment(ctx context.Context, providerRef string) (*Status, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		swishBaseURL+"/paymentrequests/"+providerRef, nil)
	if err != nil {
		return nil, err
	}
	res, err := p.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("swish: verify payment: %w", err)
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(res.Body, 64<<10))
	if err != nil {
		return nil, err
	}
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("swish: verify payment status %d", res.StatusCode)
	}
	var parsed struct {
		Status string `json:"status"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, err
	}
	return &Status{
		Paid:     parsed.Status == "PAID",
		Declined: parsed.Status == "DECLINED" || parsed.Status == "CANCELLED" || parsed.Status == "ERROR",
		Raw:      raw,
	}, nil
}
