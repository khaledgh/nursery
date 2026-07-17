package service

import (
	"context"

	"gorm.io/gorm"

	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
)

// HealthService backs the health module. The eleven sub-resources share one
// generic CRUD path (see resource.go); this service provides the shared
// dependencies plus the aggregate profile endpoint.
type HealthService struct {
	db       *gorm.DB
	childSvc *ChildService
	audit    *AuditService
}

func NewHealthService(db *gorm.DB, childSvc *ChildService, audit *AuditService) *HealthService {
	return &HealthService{db: db, childSvc: childSvc, audit: audit}
}

func (s *HealthService) DB() *gorm.DB             { return s.db }
func (s *HealthService) Children() *ChildService  { return s.childSvc }
func (s *HealthService) Audit() *AuditService     { return s.audit }

// Profile returns the full health screen aggregate in one round trip.
// PII guard: only authorized guardians/teachers/admins get here, and the
// access itself is recorded in the audit log per the security plan.
func (s *HealthService) Profile(ctx context.Context, role model.Role, userID, childID uint64, ip string) (map[string]any, error) {
	child, err := s.childSvc.Get(ctx, role, userID, childID)
	if err != nil {
		return nil, err
	}

	out := map[string]any{"child": child}
	load := func(key string, dest any, orderBy string) error {
		return s.db.WithContext(ctx).Where("child_id = ?", childID).Order(orderBy).Find(dest).Error
	}

	var (
		allergies     []model.Allergy
		illnesses     []model.IllnessLog
		medications   []model.Medication
		immunizations []model.Immunization
		checkups      []model.Checkup
		growth        []model.GrowthRecord
		vitals        []model.VitalLog
		contacts      []model.EmergencyContact
		insurance     []model.InsuranceInfo
		documents     []model.MedicalDocument
		notes         []model.HealthNote
	)
	steps := []struct {
		key     string
		dest    any
		orderBy string
	}{
		{"allergies", &allergies, "severity DESC"},
		{"illnesses", &illnesses, "date DESC"},
		{"medications", &medications, "active DESC, start_date DESC"},
		{"immunizations", &immunizations, "given_date DESC"},
		{"checkups", &checkups, "date DESC"},
		{"growth", &growth, "date DESC"},
		{"vitals", &vitals, "date DESC"},
		{"emergency_contacts", &contacts, "priority ASC"},
		{"insurance", &insurance, "id DESC"},
		{"documents", &documents, "id DESC"},
		{"notes", &notes, "id DESC"},
	}
	for _, st := range steps {
		if err := load(st.key, st.dest, st.orderBy); err != nil {
			return nil, apperr.Internal(err)
		}
	}
	// MedicalDocument media needs an extra preload pass.
	if err := s.db.WithContext(ctx).Where("child_id = ?", childID).Preload("Media").Find(&documents).Error; err != nil {
		return nil, apperr.Internal(err)
	}

	out["allergies"] = allergies
	out["illnesses"] = illnesses
	out["medications"] = medications
	out["immunizations"] = immunizations
	out["checkups"] = checkups
	out["growth"] = growth
	out["vitals"] = vitals
	out["emergency_contacts"] = contacts
	out["insurance"] = insurance
	out["documents"] = documents
	out["notes"] = notes

	s.audit.Record(ctx, userID, "read", "health_profile", childID, nil, ip)
	return out, nil
}
