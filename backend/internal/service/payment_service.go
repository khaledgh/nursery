package service

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"math/big"
	"time"

	"github.com/rs/zerolog"
	"gorm.io/datatypes"
	"gorm.io/gorm"

	"github.com/sunnystars/backend/internal/dto"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/payment"
	"github.com/sunnystars/backend/internal/pkg/apperr"
	"github.com/sunnystars/backend/internal/repository"
)

type PaymentService struct {
	db       *gorm.DB
	children *repository.ChildRepo
	provider payment.Provider
	notifier Notifier
	audit    *AuditService
	log      zerolog.Logger
}

func NewPaymentService(db *gorm.DB, children *repository.ChildRepo, provider payment.Provider, notifier Notifier, audit *AuditService, log zerolog.Logger) *PaymentService {
	return &PaymentService{db: db, children: children, provider: provider, notifier: notifier, audit: audit, log: log}
}

// ListInvoices scopes by role: admins see everything, parents only invoices
// they are the payer of.
func (s *PaymentService) ListInvoices(ctx context.Context, role model.Role, userID uint64, q dto.ListInvoicesQuery) ([]model.Invoice, int64, error) {
	var (
		invoices []model.Invoice
		total    int64
	)
	tx := s.db.WithContext(ctx).Model(&model.Invoice{})
	if role != model.RoleAdmin {
		tx = tx.Where("payer_user_id = ?", userID)
	}
	if q.Status != "" {
		tx = tx.Where("status = ?", q.Status)
	}
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, apperr.Internal(err)
	}
	err := tx.Order("due_date DESC").Limit(q.PerPage).Offset(q.Offset()).
		Preload("Items").Preload("Child").
		Find(&invoices).Error
	if err != nil {
		return nil, 0, apperr.Internal(err)
	}
	return invoices, total, nil
}

func (s *PaymentService) GetInvoice(ctx context.Context, role model.Role, userID, id uint64) (*model.Invoice, error) {
	var inv model.Invoice
	err := s.db.WithContext(ctx).Preload("Items").Preload("Child").Preload("Payments").First(&inv, id).Error
	if err != nil {
		return nil, apperr.NotFound("invoice not found")
	}
	if role != model.RoleAdmin && inv.PayerUserID != userID {
		return nil, apperr.NotFound("invoice not found")
	}
	return &inv, nil
}

func (s *PaymentService) CreateInvoice(ctx context.Context, req *dto.CreateInvoiceRequest, actorID uint64, ip string) (*model.Invoice, error) {
	child, err := s.children.ByID(ctx, req.ChildID)
	if err != nil {
		return nil, apperr.NotFound("child not found")
	}

	payerID := uint64(0)
	if req.PayerUserID != nil {
		ok, err := s.children.GuardianExists(ctx, req.ChildID, *req.PayerUserID)
		if err != nil {
			return nil, apperr.Internal(err)
		}
		if !ok {
			return nil, apperr.BadRequest("payer must be a guardian of the child")
		}
		payerID = *req.PayerUserID
	} else {
		for _, g := range child.Guardians {
			if g.IsPrimary {
				payerID = g.ParentUserID
				break
			}
		}
		if payerID == 0 && len(child.Guardians) > 0 {
			payerID = child.Guardians[0].ParentUserID
		}
		if payerID == 0 {
			return nil, apperr.BadRequest("child has no guardian to bill; specify payer_user_id")
		}
	}

	var total int64
	items := make([]model.InvoiceItem, 0, len(req.Items))
	for _, it := range req.Items {
		total += it.AmountMinor
		items = append(items, model.InvoiceItem{Label: it.Label, AmountMinor: it.AmountMinor})
	}

	invoiceNo, err := generateInvoiceNo()
	if err != nil {
		return nil, apperr.Internal(err)
	}
	inv := &model.Invoice{
		ChildID:     req.ChildID,
		PayerUserID: payerID,
		InvoiceNo:   invoiceNo,
		Currency:    defaultStr(req.Currency, "SEK"),
		TotalMinor:  total,
		DueDate:     req.DueDate,
		Status:      model.InvoiceDue,
		Period:      req.Period,
		Items:       items,
	}
	if err := s.db.WithContext(ctx).Create(inv).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, actorID, "create", "invoice", inv.ID,
		map[string]any{"invoice_no": inv.InvoiceNo, "total_minor": total}, ip)
	s.notifier.NotifyUser(ctx, payerID, "reminders", "New invoice",
		fmt.Sprintf("Invoice %s — %s %.2f due %s", inv.InvoiceNo, inv.Currency, float64(total)/100, inv.DueDate),
		map[string]any{"screen": "payments", "invoice_id": inv.ID})
	return inv, nil
}

func (s *PaymentService) CancelInvoice(ctx context.Context, id, actorID uint64, ip string) (*model.Invoice, error) {
	var inv model.Invoice
	if err := s.db.WithContext(ctx).First(&inv, id).Error; err != nil {
		return nil, apperr.NotFound("invoice not found")
	}
	if inv.Status == model.InvoicePaid {
		return nil, apperr.Conflict("a paid invoice cannot be cancelled")
	}
	inv.Status = model.InvoiceCancelled
	if err := s.db.WithContext(ctx).Save(&inv).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, actorID, "cancel", "invoice", inv.ID, nil, ip)
	// The payer may already have been reminded about this invoice, or be about
	// to pay it.
	s.notifier.NotifyUser(ctx, inv.PayerUserID, model.CategoryReminders,
		"Invoice cancelled", "Invoice "+inv.InvoiceNo+" no longer needs to be paid",
		map[string]any{"screen": "payments", "invoice_id": inv.ID})
	return &inv, nil
}

// Pay initiates a gateway payment for the caller's own invoice.
func (s *PaymentService) Pay(ctx context.Context, role model.Role, userID, invoiceID uint64, req *dto.PayInvoiceRequest, ip string) (map[string]any, error) {
	inv, err := s.GetInvoice(ctx, role, userID, invoiceID)
	if err != nil {
		return nil, err
	}
	if inv.Status != model.InvoiceDue && inv.Status != model.InvoiceOverdue {
		return nil, apperr.Conflict("invoice is not payable in its current status")
	}
	gw, err := s.provider.CreatePayment(ctx, inv.InvoiceNo, inv.TotalMinor, inv.Currency, req.PayerAlias)
	if err != nil {
		s.log.Error().Err(err).Uint64("invoice_id", invoiceID).Msg("gateway payment creation failed")
		return nil, apperr.New(apperr.CodeInternal, "payment could not be initiated; try again later")
	}
	p := &model.Payment{
		InvoiceID:   inv.ID,
		Provider:    s.provider.Name(),
		ProviderRef: gw.ProviderRef,
		AmountMinor: inv.TotalMinor,
		Status:      model.PaymentPending,
		InitiatedBy: userID,
	}
	if err := s.db.WithContext(ctx).Create(p).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, userID, "initiate", "payment", p.ID, map[string]any{"invoice_id": inv.ID}, ip)
	return map[string]any{
		"payment_id":   p.ID,
		"provider":     p.Provider,
		"provider_ref": p.ProviderRef,
		"token":        gw.Token,
	}, nil
}

// HandleCallback processes a gateway webhook. The payload is untrusted:
// only the reference is extracted, then the authoritative status is fetched
// from the gateway over mTLS before any state changes.
func (s *PaymentService) HandleCallback(ctx context.Context, providerRef string) error {
	if providerRef == "" {
		return apperr.BadRequest("missing payment reference")
	}
	var p model.Payment
	if err := s.db.WithContext(ctx).Where("provider_ref = ?", providerRef).First(&p).Error; err != nil {
		return apperr.NotFound("unknown payment reference")
	}
	if p.Status != model.PaymentPending {
		return nil // already settled — webhook retries are idempotent
	}

	status, err := s.provider.VerifyPayment(ctx, providerRef)
	if err != nil {
		s.log.Error().Err(err).Str("ref", providerRef).Msg("payment verification failed")
		return apperr.Internal(err)
	}

	return s.settle(ctx, &p, status)
}

func (s *PaymentService) settle(ctx context.Context, p *model.Payment, status *payment.Status) error {
	now := time.Now()
	txErr := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		p.RawPayloadJSON = datatypes.JSON(status.Raw)
		switch {
		case status.Paid:
			p.Status = model.PaymentPaid
			p.PaidAt = &now
			if err := tx.Model(&model.Invoice{}).Where("id = ?", p.InvoiceID).
				Update("status", model.InvoicePaid).Error; err != nil {
				return err
			}
		case status.Declined:
			p.Status = model.PaymentDeclined
		default:
			return nil // still pending at the gateway; keep waiting
		}
		return tx.Save(p).Error
	})
	if txErr != nil {
		return apperr.Internal(txErr)
	}
	if status.Paid {
		var inv model.Invoice
		if err := s.db.WithContext(ctx).First(&inv, p.InvoiceID).Error; err == nil {
			s.notifier.NotifyUser(ctx, inv.PayerUserID, "updates", "Payment received ✅",
				fmt.Sprintf("Invoice %s is paid. Thank you!", inv.InvoiceNo),
				map[string]any{"screen": "payments", "invoice_id": inv.ID})
		}
	}
	return nil
}

// MarkOverdueInvoices flips past-due invoices and reminds payers (cron).
func (s *PaymentService) MarkOverdueInvoices(ctx context.Context) error {
	var invoices []model.Invoice
	today := time.Now().Format("2006-01-02")
	if err := s.db.WithContext(ctx).
		Where("status = ? AND due_date < ?", model.InvoiceDue, today).
		Find(&invoices).Error; err != nil {
		return err
	}
	for i := range invoices {
		inv := &invoices[i]
		inv.Status = model.InvoiceOverdue
		if err := s.db.WithContext(ctx).Save(inv).Error; err != nil {
			s.log.Error().Err(err).Uint64("invoice_id", inv.ID).Msg("failed to mark invoice overdue")
			continue
		}
		s.notifier.NotifyUser(ctx, inv.PayerUserID, "reminders", "Invoice overdue",
			fmt.Sprintf("Invoice %s was due %s. Please pay as soon as possible.", inv.InvoiceNo, inv.DueDate),
			map[string]any{"screen": "payments", "invoice_id": inv.ID})
	}
	return nil
}

func generateInvoiceNo() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("INV-%s-%06d", time.Now().Format("20060102"), n.Int64()), nil
}

// swishCallback is the subset of the Swish callback payload we read.
type swishCallback struct {
	ID string `json:"id"`
}

// ExtractCallbackRef pulls the payment reference out of a raw webhook body.
func ExtractCallbackRef(body []byte) string {
	var cb swishCallback
	if err := json.Unmarshal(body, &cb); err != nil {
		return ""
	}
	return cb.ID
}
