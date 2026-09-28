package service

import (
	"context"
	"errors"
	"fmt"
	"strconv"
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
	s.db.WithContext(c).Model(&model.DemoRequest{}).
		Where("status = ?", model.DemoRequestNew).Count(&out.NewDemoRequests)

	// MRR counts only subscriptions that are actually billing.
	s.db.WithContext(c).Model(&model.Subscription{}).
		Joins("JOIN plans ON plans.id = subscriptions.plan_id").
		Where("subscriptions.status IN ?", []model.SubscriptionStatus{model.SubActive, model.SubPastDue}).
		Select("COALESCE(CAST(SUM(CASE WHEN plans.billing_period = 'yearly' THEN plans.price_minor / 12 ELSE plans.price_minor END) AS SIGNED), 0)").
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
			row.PlanName = usage.PlanName
			row.Status = usage.Status
			row.AllowsWrites = usage.AllowsWrites
			row.StudentsUsed = usage.StudentsUsed
			row.StudentsMax = usage.StudentsMax
			row.StaffUsed = usage.StaffUsed
			row.StaffMax = usage.StaffMax
			row.NextPaymentDate = usage.PeriodEnd
		}

		var sub model.Subscription
		if err := s.db.WithContext(c).Preload("Plan").Where("nursery_id = ?", n.ID).First(&sub).Error; err == nil && sub.Plan != nil {
			row.PriceMinor = sub.Plan.PriceMinor
			row.Currency = sub.Plan.Currency
			row.BillingPeriod = string(sub.Plan.BillingPeriod)
			if row.PlanName == "" {
				row.PlanName = sub.Plan.Name
			}
		}

		var admin model.User
		if err := s.db.WithContext(database.WithCrossTenant(ctx)).
			Where("nursery_id = ? AND role = ?", n.ID, model.RoleAdmin).
			Order("id ASC").First(&admin).Error; err == nil {
			row.AdminEmail = admin.Email
			row.AdminName = admin.Name
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

func (s *SuperAdminService) GetNurseryDetails(ctx context.Context, id uint64) (*dto.NurseryDetailsReport, error) {
	c := s.ctx(ctx)

	var n model.Nursery
	if err := s.db.WithContext(c).First(&n, id).Error; err != nil {
		return nil, apperr.NotFound("nursery not found")
	}

	overview := dto.NurseryOverview{
		NurseryDTO: toNurseryDTO(&n),
		CreatedAt:  n.CreatedAt.Format(time.RFC3339),
	}

	if usage, err := s.subs.Usage(ctx, n.ID); err == nil && usage != nil {
		overview.PlanCode = usage.PlanCode
		overview.PlanName = usage.PlanName
		overview.Status = usage.Status
		overview.AllowsWrites = usage.AllowsWrites
		overview.StudentsUsed = usage.StudentsUsed
		overview.StudentsMax = usage.StudentsMax
		overview.StaffUsed = usage.StaffUsed
		overview.StaffMax = usage.StaffMax
		overview.NextPaymentDate = usage.PeriodEnd
	}

	var sub model.Subscription
	if err := s.db.WithContext(c).Preload("Plan").Where("nursery_id = ?", n.ID).First(&sub).Error; err == nil && sub.Plan != nil {
		overview.PriceMinor = sub.Plan.PriceMinor
		overview.Currency = sub.Plan.Currency
		overview.BillingPeriod = string(sub.Plan.BillingPeriod)
		if overview.PlanName == "" {
			overview.PlanName = sub.Plan.Name
		}
	}

	var admin model.User
	if err := s.db.WithContext(c).
		Where("nursery_id = ? AND role = ?", n.ID, model.RoleAdmin).
		Order("id ASC").First(&admin).Error; err == nil {
		overview.AdminEmail = admin.Email
		overview.AdminName = admin.Name
	}

	rep := &dto.NurseryDetailsReport{
		Nursery: overview,
	}

	// 1. Children and Age Statistics
	var children []model.Child
	s.db.WithContext(c).
		Preload("Classroom").
		Preload("Guardians.Parent").
		Where("nursery_id = ?", n.ID).
		Order("first_name ASC").
		Find(&children)

	rep.TotalChildren = len(children)

	now := time.Now()
	var totalMonths float64

	bucketDefs := []struct {
		Label string
		Min   int
		Max   int
	}{
		{"0–1 yr (Infants)", 0, 12},
		{"1–2 yrs (Toddlers)", 13, 24},
		{"2–3 yrs (Preschool)", 25, 36},
		{"3–5 yrs (Pre-K)", 37, 60},
		{"5+ yrs (Kindergarten)", 61, 9999},
	}
	bucketCounts := make([]int, len(bucketDefs))

	classroomAges := make(map[uint64][]float64)

	for _, ch := range children {
		diffDays := now.Sub(ch.DOB).Hours() / 24
		months := int(diffDays / 30.4375)
		if months < 0 {
			months = 0
		}
		years := float64(months) / 12.0
		totalMonths += float64(months)

		var formatted string
		if months < 12 {
			formatted = fmt.Sprintf("%d mos", months)
		} else {
			y := months / 12
			m := months % 12
			if m > 0 {
				formatted = fmt.Sprintf("%dy %dm", y, m)
			} else {
				formatted = fmt.Sprintf("%dy", y)
			}
		}

		for idx, b := range bucketDefs {
			if months >= b.Min && months <= b.Max {
				bucketCounts[idx]++
				break
			}
		}

		reg := dto.NurseryChildRegistrant{
			ID:            ch.ID,
			FirstName:     ch.FirstName,
			LastName:      ch.LastName,
			DOB:           ch.DOB.Format("2006-01-02"),
			AgeYears:      years,
			AgeMonths:     months,
			AgeFormatted:  formatted,
			Gender:        ch.Gender,
			BloodType:     ch.BloodType,
			ClassroomID:   ch.ClassroomID,
			Status:        ch.Status,
			PresentStatus: string(ch.PresentStatus),
		}
		if ch.Classroom != nil {
			reg.ClassroomName = ch.Classroom.Name
			classroomAges[ch.Classroom.ID] = append(classroomAges[ch.Classroom.ID], float64(months))
		}
		for _, g := range ch.Guardians {
			if g.IsPrimary || reg.PrimaryGuardianName == "" {
				if g.Parent != nil {
					reg.PrimaryGuardianName = g.Parent.Name
					reg.PrimaryGuardianPhone = g.Parent.Phone
				}
				reg.Relationship = g.Relationship
			}
		}
		rep.Children = append(rep.Children, reg)
	}

	if rep.TotalChildren > 0 {
		rep.AverageAgeMonths = totalMonths / float64(rep.TotalChildren)
		rep.AverageAgeYears = rep.AverageAgeMonths / 12.0
		for idx, b := range bucketDefs {
			pct := (float64(bucketCounts[idx]) / float64(rep.TotalChildren)) * 100.0
			rep.AgeDistribution = append(rep.AgeDistribution, dto.AgeBucket{
				Label:      b.Label,
				MinMonths:  b.Min,
				MaxMonths:  b.Max,
				Count:      bucketCounts[idx],
				Percentage: pct,
			})
		}
	} else {
		for _, b := range bucketDefs {
			rep.AgeDistribution = append(rep.AgeDistribution, dto.AgeBucket{
				Label:      b.Label,
				MinMonths:  b.Min,
				MaxMonths:  b.Max,
				Count:      0,
				Percentage: 0,
			})
		}
	}

	// 2. Classrooms
	var classrooms []model.Classroom
	s.db.WithContext(c).
		Preload("Teachers.Teacher").
		Where("nursery_id = ?", n.ID).
		Order("name ASC").
		Find(&classrooms)

	rep.TotalClassrooms = len(classrooms)
	teacherClassroomMap := make(map[uint64][]string)

	for _, cr := range classrooms {
		crOverview := dto.NurseryClassroomOverview{
			ID:           cr.ID,
			Name:         cr.Name,
			RoomLocation: cr.RoomLocation,
			AgeGroup:     cr.AgeGroup,
			Capacity:     cr.Capacity,
			OpensAt:      cr.OpensAt,
			ClosesAt:     cr.ClosesAt,
		}

		if ages, ok := classroomAges[cr.ID]; ok && len(ages) > 0 {
			crOverview.ChildrenCount = len(ages)
			var sum float64
			for _, a := range ages {
				sum += a
			}
			crOverview.AverageAgeMonths = sum / float64(len(ages))
		}

		for _, t := range cr.Teachers {
			if t.Teacher != nil {
				teacherClassroomMap[t.TeacherUserID] = append(teacherClassroomMap[t.TeacherUserID], cr.Name)
				if t.Role == "lead" || crOverview.LeadTeacherName == "" {
					crOverview.LeadTeacherName = t.Teacher.Name
				}
			}
		}
		rep.Classrooms = append(rep.Classrooms, crOverview)
	}

	// 3. Staff / Employees
	var staffUsers []model.User
	s.db.WithContext(c).
		Where("nursery_id = ? AND role IN (?, ?)", n.ID, model.RoleAdmin, model.RoleTeacher).
		Order("role ASC, name ASC").
		Find(&staffUsers)

	rep.TotalStaff = len(staffUsers)
	for _, u := range staffUsers {
		emp := dto.NurseryEmployee{
			ID:         u.ID,
			Name:       u.Name,
			Email:      u.Email,
			Phone:      u.Phone,
			Role:       string(u.Role),
			Status:     string(u.Status),
			Classrooms: teacherClassroomMap[u.ID],
		}
		if u.LastLoginAt != nil {
			ll := u.LastLoginAt.Format(time.RFC3339)
			emp.LastLoginAt = &ll
		}
		rep.Staff = append(rep.Staff, emp)
	}

	// 4. Parents
	var parentUsers []model.User
	s.db.WithContext(c).
		Where("nursery_id = ? AND role = ?", n.ID, model.RoleParent).
		Order("name ASC").
		Find(&parentUsers)

	rep.TotalParents = len(parentUsers)

	// Map guardians to parents
	parentChildMap := make(map[uint64][]string)
	for _, ch := range children {
		for _, g := range ch.Guardians {
			parentChildMap[g.ParentUserID] = append(parentChildMap[g.ParentUserID], ch.FirstName+" "+ch.LastName)
		}
	}

	for _, u := range parentUsers {
		p := dto.NurseryParentContact{
			ID:            u.ID,
			Name:          u.Name,
			Email:         u.Email,
			Phone:         u.Phone,
			Status:        string(u.Status),
			ChildrenNames: parentChildMap[u.ID],
		}
		if u.LastLoginAt != nil {
			ll := u.LastLoginAt.Format(time.RFC3339)
			p.LastLoginAt = &ll
		}
		rep.Parents = append(rep.Parents, p)
	}

	// 5. Invoices
	var invoices []model.SubscriptionInvoice
	s.db.WithContext(c).
		Where("nursery_id = ?", n.ID).
		Order("id DESC").
		Find(&invoices)

	for _, inv := range invoices {
		item := dto.NurseryInvoiceItem{
			ID:          inv.ID,
			InvoiceNo:   inv.InvoiceNo,
			AmountMinor: inv.AmountMinor,
			Currency:    inv.Currency,
			Period:      inv.Period,
			DueDate:     inv.DueDate,
			Status:      string(inv.Status),
		}
		if inv.PaidAt != nil {
			pa := inv.PaidAt.Format(time.RFC3339)
			item.PaidAt = &pa
		}
		rep.Invoices = append(rep.Invoices, item)
	}

	return rep, nil
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
		planCode = "tier-50"
	}
	var plan model.Plan
	if err := s.db.WithContext(c).Where("code = ?", planCode).First(&plan).Error; err != nil {
		// Fallback to starter if tier not found
		if err := s.db.WithContext(c).Where("code = ?", "starter").First(&plan).Error; err != nil {
			return nil, apperr.BadRequest("unknown plan code")
		}
	}

	loginIDPrefix := strings.ToLower(strings.TrimSpace(req.LoginIDPrefix))
	if loginIDPrefix == "" {
		loginIDPrefix = slug
	}

	if err := s.validateLoginRange(ctx, 0, req.LoginRangeStart, req.LoginRangeEnd); err != nil {
		return nil, err
	}

	nursery := &model.Nursery{
		Name:            req.Name,
		Slug:            slug,
		LoginIDPrefix:   loginIDPrefix,
		LoginRangeStart: req.LoginRangeStart,
		LoginRangeEnd:   req.LoginRangeEnd,
		Locale:          orDefault(req.Locale, "en"),
		Timezone:        orDefault(req.Timezone, "Europe/Stockholm"),
		Status:          model.NurseryActive,
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

func (s *SuperAdminService) validateLoginRange(ctx context.Context, nurseryID uint64, start, end *uint64) error {
	if start == nil && end == nil {
		return nil
	}
	if (start == nil && end != nil) || (start != nil && end == nil) {
		return apperr.BadRequest("both login_range_start and login_range_end must be provided together")
	}
	if *start == 0 {
		return apperr.BadRequest("login_range_start must be at least 1")
	}
	if *start > *end {
		return apperr.BadRequest("login_range_start cannot be greater than login_range_end")
	}

	// Two ranges [A, B] and [C, D] overlap if and only if A <= D and C <= B
	var conflicting model.Nursery
	query := s.db.WithContext(s.ctx(ctx)).Model(&model.Nursery{}).
		Where("login_range_start IS NOT NULL AND login_range_end IS NOT NULL").
		Where("login_range_start <= ? AND login_range_end >= ?", *end, *start)
	if nurseryID != 0 {
		query = query.Where("id <> ?", nurseryID)
	}
	err := query.First(&conflicting).Error
	if err == nil {
		cStart := uint64(0)
		cEnd := uint64(0)
		if conflicting.LoginRangeStart != nil {
			cStart = *conflicting.LoginRangeStart
		}
		if conflicting.LoginRangeEnd != nil {
			cEnd = *conflicting.LoginRangeEnd
		}
		return apperr.Conflict(fmt.Sprintf(
			"login range [%d - %d] conflicts with existing nursery %q (allocated range: %d - %d)",
			*start, *end, conflicting.Name, cStart, cEnd,
		))
	}
	return nil
}

func (s *SuperAdminService) UpdateNursery(ctx context.Context, id uint64, req *dto.UpdateNurseryRequest, actorID uint64, ip string) (*model.Nursery, error) {
	n, err := s.GetNursery(ctx, id)
	if err != nil {
		return nil, err
	}
	if req.Name != nil {
		n.Name = *req.Name
	}
	if req.LoginIDPrefix != nil {
		n.LoginIDPrefix = strings.ToLower(strings.TrimSpace(*req.LoginIDPrefix))
	}
	if req.LoginRangeStart != nil || req.LoginRangeEnd != nil {
		start := req.LoginRangeStart
		end := req.LoginRangeEnd
		if start == nil {
			start = n.LoginRangeStart
		}
		if end == nil {
			end = n.LoginRangeEnd
		}
		if err := s.validateLoginRange(ctx, n.ID, start, end); err != nil {
			return nil, err
		}
		n.LoginRangeStart = start
		n.LoginRangeEnd = end
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
	plan.Currency = orDefault(req.Currency, "USD")
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
// nursery. Idempotent per (nursery, period). Handles both monthly and yearly plans.
func (s *SuperAdminService) GenerateSubscriptionInvoices(ctx context.Context, actorID uint64, ip string) (int, error) {
	c := s.ctx(ctx)
	monthlyPeriod := time.Now().Format("2006-01")
	yearlyPeriod := time.Now().Format("2006")
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
		period := monthlyPeriod
		if sub.Plan.BillingPeriod == model.BillingYearly {
			period = yearlyPeriod
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
	if created > 0 && actorID > 0 {
		s.audit.Record(ctx, actorID, "create", "subscription_invoice", 0,
			map[string]any{"period": monthlyPeriod, "count": created}, ip)
	}
	return created, nil
}

// MarkOverdueSubscriptionInvoices flags unpaid invoices past their due date as overdue,
// and flips active subscriptions to past_due with a grace period.
func (s *SuperAdminService) MarkOverdueSubscriptionInvoices(ctx context.Context) (int, error) {
	c := s.ctx(ctx)
	today := time.Now().Format("2006-01-02")

	var overdueInvoices []model.SubscriptionInvoice
	if err := s.db.WithContext(c).
		Where("status = ? AND due_date < ?", model.InvoiceDue, today).
		Find(&overdueInvoices).Error; err != nil {
		return 0, apperr.Internal(err)
	}

	marked := 0
	for _, inv := range overdueInvoices {
		err := s.db.WithContext(c).Transaction(func(tx *gorm.DB) error {
			if err := tx.Model(&inv).Update("status", model.InvoiceOverdue).Error; err != nil {
				return err
			}
			grace := time.Now().AddDate(0, 0, 7).Format("2006-01-02")
			return tx.Model(&model.Subscription{}).
				Where("nursery_id = ? AND status = ?", inv.NurseryID, model.SubActive).
				Updates(map[string]any{
					"status":      model.SubPastDue,
					"grace_until": grace,
				}).Error
		})
		if err == nil {
			marked++
		}
	}
	return marked, nil
}

// AutoRunBilling handles both generating current invoices and checking for overdue ones.
func (s *SuperAdminService) AutoRunBilling(ctx context.Context, actorID uint64, ip string) (*dto.AutoRunResult, error) {
	gen, err := s.GenerateSubscriptionInvoices(ctx, actorID, ip)
	if err != nil {
		return nil, err
	}
	overdue, err := s.MarkOverdueSubscriptionInvoices(ctx)
	if err != nil {
		return nil, err
	}
	return &dto.AutoRunResult{
		GeneratedInvoices: gen,
		OverdueMarked:     overdue,
	}, nil
}

// GetReminders returns intelligent operational and billing reminders for the superadmin.
func (s *SuperAdminService) GetReminders(ctx context.Context) ([]dto.PlatformReminder, error) {
	c := s.ctx(ctx)
	var reminders []dto.PlatformReminder

	// 1. Overdue invoices
	var overdueInvs []model.SubscriptionInvoice
	if err := s.db.WithContext(c).
		Where("status = ?", model.InvoiceOverdue).
		Order("due_date ASC").Limit(20).Find(&overdueInvs).Error; err == nil {
		for _, inv := range overdueInvs {
			var n model.Nursery
			s.db.WithContext(c).Select("name").First(&n, inv.NurseryID)
			reminders = append(reminders, dto.PlatformReminder{
				ID:          fmt.Sprintf("inv-%d", inv.ID),
				Type:        "overdue",
				Severity:    "high",
				NurseryID:   inv.NurseryID,
				NurseryName: n.Name,
				Title:       fmt.Sprintf("Payment Overdue: %s (%s)", inv.InvoiceNo, inv.Period),
				Description: fmt.Sprintf("Nursery has an outstanding invoice of %0.2f %s due on %s.", float64(inv.AmountMinor)/100, inv.Currency, inv.DueDate),
				ActionType:  "mark_paid",
				ActionID:    inv.ID,
				DueDate:     inv.DueDate,
			})
		}
	}

	// 2. Capacity warnings (> 85% enrollment)
	var subs []model.Subscription
	if err := s.db.WithContext(c).Preload("Plan").Find(&subs).Error; err == nil {
		for _, sub := range subs {
			if sub.MaxStudents <= 0 {
				continue
			}
			var childCount int64
			s.db.WithContext(database.WithCrossTenant(ctx)).Model(&model.Child{}).
				Where("nursery_id = ? AND deleted_at IS NULL", sub.NurseryID).
				Count(&childCount)

			pct := float64(childCount) / float64(sub.MaxStudents) * 100
			if pct >= 85 {
				var n model.Nursery
				s.db.WithContext(c).Select("name").First(&n, sub.NurseryID)
				reminders = append(reminders, dto.PlatformReminder{
					ID:          fmt.Sprintf("cap-%d", sub.NurseryID),
					Type:        "capacity",
					Severity:    "medium",
					NurseryID:   sub.NurseryID,
					NurseryName: n.Name,
					Title:       fmt.Sprintf("High Capacity: %d / %d students (%.0f%%)", childCount, sub.MaxStudents, pct),
					Description: fmt.Sprintf("%s is close to its student limit. Recommend upgrading to a higher tier.", n.Name),
					ActionType:  "upgrade_plan",
					ActionID:    sub.NurseryID,
				})
			}
		}
	}

	return reminders, nil
}

// GetReports computes platform metrics and tier breakdowns for the superadmin.
func (s *SuperAdminService) GetReports(ctx context.Context) (*dto.PlatformReport, error) {
	c := s.ctx(ctx)
	var rep dto.PlatformReport

	s.db.WithContext(c).Model(&model.Nursery{}).Count(&rep.TotalNurseries)
	s.db.WithContext(c).Model(&model.Nursery{}).Where("status = ?", model.NurseryActive).Count(&rep.ActiveNurseries)
	s.db.WithContext(c).Model(&model.Subscription{}).Where("status = ?", model.SubPastDue).Count(&rep.PastDueNurseries)

	s.db.WithContext(database.WithCrossTenant(ctx)).Model(&model.Child{}).
		Where("deleted_at IS NULL").Count(&rep.TotalChildren)

	// Total capacity
	s.db.WithContext(c).Model(&model.Subscription{}).
		Select("COALESCE(SUM(max_students), 0)").Scan(&rep.TotalCapacity)
	if rep.TotalCapacity > 0 {
		rep.CapacityUsedPct = float64(rep.TotalChildren) / float64(rep.TotalCapacity) * 100
	}

	// MRR & ARR
	s.db.WithContext(c).Model(&model.Subscription{}).
		Joins("JOIN plans ON plans.id = subscriptions.plan_id").
		Where("subscriptions.status IN ?", []model.SubscriptionStatus{model.SubActive, model.SubPastDue}).
		Select("COALESCE(CAST(SUM(CASE WHEN plans.billing_period = 'yearly' THEN plans.price_minor / 12 ELSE plans.price_minor END) AS SIGNED), 0)").
		Scan(&rep.MRRMinor)
	rep.ARRMinor = rep.MRRMinor * 12

	// Invoice totals
	s.db.WithContext(c).Model(&model.SubscriptionInvoice{}).Count(&rep.TotalInvoices)
	s.db.WithContext(c).Model(&model.SubscriptionInvoice{}).Where("status = ?", model.InvoicePaid).Count(&rep.PaidInvoices)
	s.db.WithContext(c).Model(&model.SubscriptionInvoice{}).Where("status = ?", model.InvoiceOverdue).Count(&rep.OverdueInvoices)

	s.db.WithContext(c).Model(&model.SubscriptionInvoice{}).
		Where("status = ?", model.InvoicePaid).
		Select("COALESCE(SUM(amount_minor), 0)").Scan(&rep.PaidAmountMinor)
	s.db.WithContext(c).Model(&model.SubscriptionInvoice{}).
		Where("status = ?", model.InvoiceOverdue).
		Select("COALESCE(SUM(amount_minor), 0)").Scan(&rep.OverdueAmountMinor)

	// Tier breakdown
	var plans []model.Plan
	if err := s.db.WithContext(c).Where("is_active = ?", true).Order("price_minor ASC").Find(&plans).Error; err == nil {
		for _, p := range plans {
			var cnt int64
			s.db.WithContext(c).Model(&model.Subscription{}).Where("plan_id = ?", p.ID).Count(&cnt)
			rep.Tiers = append(rep.Tiers, dto.TierBreakdown{
				PlanCode:      p.Code,
				PlanName:      p.Name,
				BillingPeriod: string(p.BillingPeriod),
				NurseryCount:  int(cnt),
				RevenueMinor:  int64(cnt) * p.PriceMinor,
			})
		}
	}

	return &rep, nil
}


func toNurseryDTO(n *model.Nursery) dto.NurseryDTO {
	return dto.NurseryDTO{
		ID: n.ID, Name: n.Name, Slug: n.Slug, LoginIDPrefix: n.LoginIDPrefix,
		LoginRangeStart: n.LoginRangeStart, LoginRangeEnd: n.LoginRangeEnd,
		Status: string(n.Status), Locale: n.Locale, Timezone: n.Timezone,
	}
}

func orDefault(v, def string) string {
	if v == "" {
		return def
	}
	return v
}

func (s *SuperAdminService) Search(ctx context.Context, term string) (*dto.SuperAdminSearchResults, error) {
	term = strings.TrimSpace(term)
	if len(term) < 2 {
		return &dto.SuperAdminSearchResults{}, nil
	}
	c := s.ctx(ctx)
	like := "%" + term + "%"
	out := &dto.SuperAdminSearchResults{}

	// 1. Nurseries: search by name, slug, login prefix, or numeric login range
	query := s.db.WithContext(c).Model(&model.Nursery{}).
		Where("name LIKE ? OR slug LIKE ? OR login_id_prefix LIKE ?", like, like, like)
	if num, err := strconv.ParseUint(term, 10, 64); err == nil && num > 0 {
		query = s.db.WithContext(c).Model(&model.Nursery{}).
			Where("name LIKE ? OR slug LIKE ? OR login_id_prefix LIKE ? OR (login_range_start <= ? AND login_range_end >= ?)", like, like, like, num, num)
	}

	var nurseries []model.Nursery
	if err := query.Limit(6).Find(&nurseries).Error; err == nil {
		for _, n := range nurseries {
			sub := "/" + n.Slug + " • Status: " + string(n.Status)
			if n.LoginRangeStart != nil && n.LoginRangeEnd != nil {
				sub = fmt.Sprintf("Range: %d–%d • %s", *n.LoginRangeStart, *n.LoginRangeEnd, sub)
			} else if n.LoginIDPrefix != "" {
				sub = "Prefix: " + strings.ToUpper(n.LoginIDPrefix) + " • " + sub
			}
			out.Nurseries = append(out.Nurseries, dto.SuperAdminSearchHit{
				ID:    n.ID,
				Label: n.Name,
				Sub:   sub,
				Path:  fmt.Sprintf("/superadmin/nurseries/%d", n.ID),
			})
		}
	}

	// 2. Subscription Plans: search by name or code
	var plans []model.Plan
	if err := s.db.WithContext(c).Model(&model.Plan{}).
		Where("name LIKE ? OR code LIKE ?", like, like).
		Limit(5).Find(&plans).Error; err == nil {
		for _, p := range plans {
			sub := fmt.Sprintf("Code: %s • Max Students: %d • $%d/%s", p.Code, p.MaxStudents, p.PriceMinor/100, p.BillingPeriod)
			out.Plans = append(out.Plans, dto.SuperAdminSearchHit{
				ID:    p.ID,
				Label: p.Name,
				Sub:   sub,
				Path:  "/superadmin/plans",
			})
		}
	}

	// 3. Platform Invoices: search by invoice_no
	var invoices []model.SubscriptionInvoice
	if err := s.db.WithContext(c).Model(&model.SubscriptionInvoice{}).
		Where("invoice_no LIKE ?", like).
		Limit(5).Find(&invoices).Error; err == nil {
		for _, inv := range invoices {
			sub := fmt.Sprintf("Period: %s • Due: %s • Status: %s", inv.Period, inv.DueDate, inv.Status)
			out.Invoices = append(out.Invoices, dto.SuperAdminSearchHit{
				ID:    inv.NurseryID,
				Label: inv.InvoiceNo,
				Sub:   sub,
				Path:  fmt.Sprintf("/superadmin/nurseries/%d", inv.NurseryID),
			})
		}
	}

	// 4. Quick navigation pages
	navPages := []struct {
		Label string
		Sub   string
		Path  string
	}{
		{"Platform Dashboard", "Executive metrics, ARR, MRR & active centers", "/superadmin/dashboard"},
		{"Nurseries & Childcare Centers", "Tenant directory, login ranges & status", "/superadmin"},
		{"Plans & Capacity Packages", "Subscription tiers, pricing & limits", "/superadmin/plans"},
		{"Financial & Capacity Reports", "Audited financial health & capacity reports", "/superadmin/reports"},
		{"Platform Reminders & Global Alerts", "Platform-wide broadcasts and cron notifications", "/superadmin/reminders"},
		{"Platform Settings", "General settings, timezone & storage configuration", "/settings"},
		{"Audit Logs & Security", "Platform activity trail and administrative logs", "/audit"},
	}
	lowerTerm := strings.ToLower(term)
	for _, page := range navPages {
		if strings.Contains(strings.ToLower(page.Label), lowerTerm) || strings.Contains(strings.ToLower(page.Sub), lowerTerm) {
			out.Pages = append(out.Pages, dto.SuperAdminSearchHit{
				Label: page.Label,
				Sub:   page.Sub,
				Path:  page.Path,
			})
		}
	}

	return out, nil
}
