package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"github.com/sunnystars/backend/internal/database"
	"github.com/sunnystars/backend/internal/dto"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
	"github.com/sunnystars/backend/internal/pkg/hash"
	"github.com/sunnystars/backend/internal/pkg/jwtutil"
)

// impersonationTTL is deliberately short: the token grants a superadmin full
// admin rights inside a customer's nursery.
const impersonationTTL = 5 * time.Minute

type SuperAdminService struct {
	db    *gorm.DB
	subs  *SubscriptionService
	jwts  *jwtutil.Manager
	audit *AuditService
}

func NewSuperAdminService(db *gorm.DB, subs *SubscriptionService, jwts *jwtutil.Manager, audit *AuditService) *SuperAdminService {
	return &SuperAdminService{db: db, subs: subs, jwts: jwts, audit: audit}
}

// every superadmin read spans tenants by definition.
func (s *SuperAdminService) ctx(ctx context.Context) context.Context {
	return database.WithCrossTenant(ctx)
}

func (s *SuperAdminService) Stats(ctx context.Context) (*dto.PlatformStats, error) {
	c := s.ctx(ctx)
	var out dto.PlatformStats

	s.db.WithContext(c).Model(&model.Nursery{}).Count(&out.Nurseries)
	s.db.WithContext(c).Model(&model.Nursery{}).Where("status = ?", model.NurseryActive).Count(&out.ActiveNurseries)
	s.db.WithContext(c).Model(&model.Child{}).Count(&out.Children)
	s.db.WithContext(c).Model(&model.User{}).Where("role <> ?", model.RoleSuperAdmin).Count(&out.Users)
	s.db.WithContext(c).Model(&model.SubscriptionInvoice{}).
		Where("status IN ?", []model.InvoiceStatus{model.InvoiceDue, model.InvoiceOverdue}).
		Count(&out.OverdueInvoices)
	s.db.WithContext(c).Model(&model.Subscription{}).
		Where("status = ?", model.SubPastDue).Count(&out.NurseriesPastDue)

	// MRR counts only subscriptions that are actually billing.
	s.db.WithContext(c).Model(&model.Subscription{}).
		Joins("JOIN plans ON plans.id = subscriptions.plan_id").
		Where("subscriptions.status IN ?", []model.SubscriptionStatus{model.SubActive, model.SubPastDue}).
		Select("COALESCE(SUM(CASE WHEN plans.billing_period = 'yearly' THEN plans.price_minor / 12 ELSE plans.price_minor END), 0)").
		Scan(&out.MRRMinor)

	return &out, nil
}

func (s *SuperAdminService) ListNurseries(ctx context.Context, q dto.PageQuery) ([]dto.NurseryOverview, int64, error) {
	c := s.ctx(ctx)
	tx := s.db.WithContext(c).Model(&model.Nursery{})
	if q.Search != "" {
		like := "%" + q.Search + "%"
		tx = tx.Where("name LIKE ? OR slug LIKE ?", like, like)
	}
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, apperr.Internal(err)
	}

	var nurseries []model.Nursery
	if err := tx.Order("id ASC").
		Offset((q.Page - 1) * q.PerPage).Limit(q.PerPage).Find(&nurseries).Error; err != nil {
		return nil, 0, apperr.Internal(err)
	}

	out := make([]dto.NurseryOverview, 0, len(nurseries))
	for _, n := range nurseries {
		row := dto.NurseryOverview{
			NurseryDTO: toNurseryDTO(&n),
			CreatedAt:  n.CreatedAt.Format(time.RFC3339),
		}
		if usage, err := s.subs.Usage(ctx, n.ID); err == nil {
			row.PlanCode = usage.PlanCode
			row.Status = usage.Status
			row.StudentsUsed = usage.StudentsUsed
			row.StudentsMax = usage.StudentsMax
		}
		out = append(out, row)
	}
	return out, total, nil
}

func (s *SuperAdminService) GetNursery(ctx context.Context, id uint64) (*model.Nursery, error) {
	var n model.Nursery
	if err := s.db.WithContext(s.ctx(ctx)).First(&n, id).Error; err != nil {
		return nil, apperr.NotFound("nursery not found")
	}
	return &n, nil
}

// CreateNursery provisions a tenant, its subscription, its capabilities, and
// its first admin in one transaction — a nursery must never exist without a
// way to sign in to it.
func (s *SuperAdminService) CreateNursery(ctx context.Context, req *dto.CreateNurseryRequest, actorID uint64, ip string) (*model.Nursery, error) {
	c := s.ctx(ctx)
	slug := strings.ToLower(strings.TrimSpace(req.Slug))

	var exists int64
	s.db.WithContext(c).Model(&model.Nursery{}).Unscoped().Where("slug = ?", slug).Count(&exists)
	if exists > 0 {
		return nil, apperr.ConflictField("slug", "is already taken")
	}

	pwHash, err := hash.Password(req.AdminPassword)
	if err != nil {
		return nil, apperr.Internal(err)
	}

	planCode := req.PlanCode
	if planCode == "" {
		planCode = "starter"
	}
	var plan model.Plan
	if err := s.db.WithContext(c).Where("code = ?", planCode).First(&plan).Error; err != nil {
		return nil, apperr.BadRequest("unknown plan code")
	}

	nursery := &model.Nursery{
		Name:     req.Name,
		Slug:     slug,
		Locale:   orDefault(req.Locale, "en"),
		Timezone: orDefault(req.Timezone, "Europe/Stockholm"),
		Status:   model.NurseryActive,
	}

	err = s.db.WithContext(c).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(nursery).Error; err != nil {
			return err
		}
		start := time.Now().Format("2006-01-02")
		end := time.Now().AddDate(0, 1, 0).Format("2006-01-02")
		sub := &model.Subscription{
			NurseryID:          nursery.ID,
			PlanID:             plan.ID,
			Status:             model.SubTrialing,
			MaxStudents:        plan.MaxStudents,
			MaxStaff:           plan.MaxStaff,
			CurrentPeriodStart: &start,
			CurrentPeriodEnd:   &end,
			TrialEndsAt:        &end,
		}
		if err := tx.Create(sub).Error; err != nil {
			return err
		}
		caps := make([]model.NurseryCapability, 0, len(model.AllCapabilities))
		for _, capability := range model.AllCapabilities {
			caps = append(caps, model.NurseryCapability{
				NurseryID: nursery.ID, Capability: capability, Enabled: true, GrantedBy: &actorID,
			})
		}
		if err := tx.Create(&caps).Error; err != nil {
			return err
		}
		admin := &model.User{
			NurseryID:    nursery.ID,
			Name:         req.AdminName,
			Email:        req.AdminEmail,
			PasswordHash: pwHash,
			Role:         model.RoleAdmin,
			Locale:       nursery.Locale,
			Status:       model.UserActive,
		}
		return tx.Create(admin).Error
	})
	if err != nil {
		return nil, apperr.Internal(err)
	}

	s.audit.Record(ctx, actorID, "create", "nursery", nursery.ID,
		map[string]any{"name": nursery.Name, "slug": nursery.Slug, "plan": planCode}, ip)
	return nursery, nil
}

func (s *SuperAdminService) UpdateNursery(ctx context.Context, id uint64, req *dto.UpdateNurseryRequest, actorID uint64, ip string) (*model.Nursery, error) {
	n, err := s.GetNursery(ctx, id)
	if err != nil {
		return nil, err
	}
	if req.Name != nil {
		n.Name = *req.Name
	}
	if req.Status != nil {
		n.Status = model.NurseryStatus(*req.Status)
	}
	if req.Locale != nil {
		n.Locale = *req.Locale
	}
	if req.Timezone != nil {
		n.Timezone = *req.Timezone
	}
	if err := s.db.WithContext(s.ctx(ctx)).Save(n).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, actorID, "update", "nursery", n.ID, map[string]any{"status": n.Status}, ip)
	return n, nil
}

// SetNurseryStatus suspends or reactivates a tenant. Suspension stops writes
// but never reads — see Subscription.AllowsWrites.
func (s *SuperAdminService) SetNurseryStatus(ctx context.Context, id uint64, status model.NurseryStatus, actorID uint64, ip string) error {
	n, err := s.GetNursery(ctx, id)
	if err != nil {
		return err
	}
	subStatus := model.SubActive
	if status != model.NurseryActive {
		subStatus = model.SubSuspended
	}
	err = s.db.WithContext(s.ctx(ctx)).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(n).Update("status", status).Error; err != nil {
			return err
		}
		return tx.Model(&model.Subscription{}).
			Where("nursery_id = ?", id).Update("status", subStatus).Error
	})
	if err != nil {
		return apperr.Internal(err)
	}
	s.audit.Record(ctx, actorID, "update", "nursery", id, map[string]any{"status": status}, ip)
	return nil
}

// AssignSubscription sets a nursery's plan and, optionally, per-nursery limit
// overrides. Limits are copied onto the subscription so changing a plan later
// never silently re-caps an existing customer.
func (s *SuperAdminService) AssignSubscription(ctx context.Context, nurseryID uint64, req *dto.AssignSubscriptionRequest, actorID uint64, ip string) (*model.Subscription, error) {
	c := s.ctx(ctx)
	var plan model.Plan
	if err := s.db.WithContext(c).Where("code = ?", req.PlanCode).First(&plan).Error; err != nil {
		return nil, apperr.BadRequest("unknown plan code")
	}

	var sub model.Subscription
	err := s.db.WithContext(c).Where("nursery_id = ?", nurseryID).First(&sub).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		sub = model.Subscription{NurseryID: nurseryID, Status: model.SubTrialing}
	} else if err != nil {
		return nil, apperr.Internal(err)
	}

	sub.PlanID = plan.ID
	sub.MaxStudents = plan.MaxStudents
	sub.MaxStaff = plan.MaxStaff
	if req.MaxStudents != nil {
		sub.MaxStudents = *req.MaxStudents
	}
	if req.MaxStaff != nil {
		sub.MaxStaff = *req.MaxStaff
	}
	if req.Status != nil {
		sub.Status = model.SubscriptionStatus(*req.Status)
	}
	if req.PeriodEnd != nil {
		sub.CurrentPeriodEnd = req.PeriodEnd
	}
	if req.GraceUntil != nil {
		sub.GraceUntil = req.GraceUntil
	}
	if req.Notes != nil {
		sub.Notes = *req.Notes
	}

	if err := s.db.WithContext(c).Save(&sub).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, actorID, "update", "subscription", sub.ID,
		map[string]any{"nursery_id": nurseryID, "plan": plan.Code, "max_students": sub.MaxStudents}, ip)
	return &sub, nil
}

func (s *SuperAdminService) SetCapabilities(ctx context.Context, nurseryID uint64, req *dto.UpdateCapabilitiesRequest, actorID uint64, ip string) error {
	c := s.ctx(ctx)
	err := s.db.WithContext(c).Transaction(func(tx *gorm.DB) error {
		for capability, enabled := range req.Capabilities {
			row := model.NurseryCapability{
				NurseryID: nurseryID, Capability: capability, Enabled: enabled, GrantedBy: &actorID,
			}
			if err := tx.Where("nursery_id = ? AND capability = ?", nurseryID, capability).
				Assign(map[string]any{"enabled": enabled, "granted_by": actorID}).
				FirstOrCreate(&row).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return apperr.Internal(err)
	}
	s.audit.Record(ctx, actorID, "update", "nursery_capabilities", nurseryID,
		map[string]any{"capabilities": req.Capabilities}, ip)
	return nil
}

// Impersonate mints a short-lived token scoped to one nursery.
//
// The token records the real superadmin in ActingAs so every action they take
// is attributed to them, not to the customer's own admin — an impersonated
// action logged under the customer's name would be an audit-integrity failure.
func (s *SuperAdminService) Impersonate(ctx context.Context, nurseryID, superAdminID uint64, ip string) (*dto.TokenPair, error) {
	n, err := s.GetNursery(ctx, nurseryID)
	if err != nil {
		return nil, err
	}
	access, exp, err := s.jwts.IssueImpersonation(
		superAdminID, string(model.RoleAdmin), n.ID, superAdminID, impersonationTTL)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, superAdminID, "impersonate", "nursery", n.ID,
		map[string]any{"nursery": n.Name}, ip)
	// No refresh token: impersonation must expire, not renew silently.
	return &dto.TokenPair{AccessToken: access, AccessExpiresAt: exp}, nil
}

// --- plans ---

func (s *SuperAdminService) ListPlans(ctx context.Context) ([]model.Plan, error) {
	var plans []model.Plan
	if err := s.db.WithContext(s.ctx(ctx)).Order("price_minor ASC").Find(&plans).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	return plans, nil
}

func (s *SuperAdminService) SavePlan(ctx context.Context, id uint64, req *dto.PlanRequest, actorID uint64, ip string) (*model.Plan, error) {
	c := s.ctx(ctx)
	plan := model.Plan{}
	if id != 0 {
		if err := s.db.WithContext(c).First(&plan, id).Error; err != nil {
			return nil, apperr.NotFound("plan not found")
		}
	}
	plan.Code = req.Code
	plan.Name = req.Name
	plan.MaxStudents = req.MaxStudents
	plan.MaxStaff = req.MaxStaff
	plan.PriceMinor = req.PriceMinor
	plan.Currency = orDefault(req.Currency, "SEK")
	plan.BillingPeriod = model.BillingPeriod(orDefault(req.BillingPeriod, string(model.BillingMonthly)))
	if req.IsActive != nil {
		plan.IsActive = *req.IsActive
	} else if id == 0 {
		plan.IsActive = true
	}

	if err := s.db.WithContext(c).Save(&plan).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, actorID, "update", "plan", plan.ID, map[string]any{"code": plan.Code}, ip)
	return &plan, nil
}

// --- platform invoices ---

func (s *SuperAdminService) ListSubscriptionInvoices(ctx context.Context, q dto.PageQuery, status string) ([]model.SubscriptionInvoice, int64, error) {
	c := s.ctx(ctx)
	tx := s.db.WithContext(c).Model(&model.SubscriptionInvoice{})
	if status != "" && status != "all" {
		tx = tx.Where("status = ?", status)
	}
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, apperr.Internal(err)
	}
	var invoices []model.SubscriptionInvoice
	err := tx.Order("due_date DESC").
		Offset((q.Page - 1) * q.PerPage).Limit(q.PerPage).Find(&invoices).Error
	if err != nil {
		return nil, 0, apperr.Internal(err)
	}
	return invoices, total, nil
}

// MarkInvoicePaid settles a platform invoice by hand. Billing is manual, so
// this is the only way an invoice becomes paid; it also lifts past_due.
func (s *SuperAdminService) MarkInvoicePaid(ctx context.Context, invoiceID, actorID uint64, ip string) error {
	c := s.ctx(ctx)
	var inv model.SubscriptionInvoice
	if err := s.db.WithContext(c).First(&inv, invoiceID).Error; err != nil {
		return apperr.NotFound("invoice not found")
	}
	if inv.Status == model.InvoicePaid {
		return nil // already settled; nothing to do
	}
	now := time.Now()
	err := s.db.WithContext(c).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&inv).Updates(map[string]any{
			"status": model.InvoicePaid, "paid_at": now, "marked_paid_by": actorID,
		}).Error; err != nil {
			return err
		}
		// Clearing the debt restores write access.
		var outstanding int64
		if err := tx.Model(&model.SubscriptionInvoice{}).
			Where("nursery_id = ? AND status IN ?", inv.NurseryID,
				[]model.InvoiceStatus{model.InvoiceDue, model.InvoiceOverdue}).
			Count(&outstanding).Error; err != nil {
			return err
		}
		if outstanding == 0 {
			return tx.Model(&model.Subscription{}).
				Where("nursery_id = ? AND status = ?", inv.NurseryID, model.SubPastDue).
				Updates(map[string]any{"status": model.SubActive, "grace_until": nil}).Error
		}
		return nil
	})
	if err != nil {
		return apperr.Internal(err)
	}
	s.audit.Record(ctx, actorID, "update", "subscription_invoice", inv.ID,
		map[string]any{"status": "paid", "nursery_id": inv.NurseryID}, ip)
	return nil
}

// GenerateSubscriptionInvoices raises this period's invoice for every billing
// nursery. Idempotent per (nursery, period).
func (s *SuperAdminService) GenerateSubscriptionInvoices(ctx context.Context, actorID uint64, ip string) (int, error) {
	c := s.ctx(ctx)
	period := time.Now().Format("2006-01")
	due := time.Now().AddDate(0, 0, 14).Format("2006-01-02")

	var subs []model.Subscription
	if err := s.db.WithContext(c).Preload("Plan").
		Where("status IN ?", []model.SubscriptionStatus{model.SubActive, model.SubPastDue}).
		Find(&subs).Error; err != nil {
		return 0, apperr.Internal(err)
	}

	created := 0
	for _, sub := range subs {
		if sub.Plan == nil {
			continue
		}
		var exists int64
		s.db.WithContext(c).Model(&model.SubscriptionInvoice{}).
			Where("nursery_id = ? AND period = ?", sub.NurseryID, period).Count(&exists)
		if exists > 0 {
			continue
		}
		inv := model.SubscriptionInvoice{
			NurseryID:      sub.NurseryID,
			SubscriptionID: sub.ID,
			InvoiceNo:      fmt.Sprintf("SUB-%d-%s", sub.NurseryID, strings.ReplaceAll(period, "-", "")),
			AmountMinor:    sub.Plan.PriceMinor,
			Currency:       sub.Plan.Currency,
			Period:         period,
			DueDate:        due,
			Status:         model.InvoiceDue,
		}
		if err := s.db.WithContext(c).Create(&inv).Error; err != nil {
			continue // a duplicate here is benign; keep going
		}
		created++
	}
	if created > 0 {
		s.audit.Record(ctx, actorID, "create", "subscription_invoice", 0,
			map[string]any{"period": period, "count": created}, ip)
	}
	return created, nil
}

func toNurseryDTO(n *model.Nursery) dto.NurseryDTO {
	return dto.NurseryDTO{
		ID: n.ID, Name: n.Name, Slug: n.Slug,
		Status: string(n.Status), Locale: n.Locale, Timezone: n.Timezone,
	}
}

func orDefault(v, def string) string {
	if v == "" {
		return def
	}
	return v
}
