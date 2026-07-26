package service

import (
	"context"

	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
)

// childResourcePtr is the constraint for generic CRUD over child-scoped rows
// (health sub-resources). The pointer type must expose the mass-assignment
// guard and the child-id setter.
type childResourcePtr[T any] interface {
	*T
	GetID() uint64
	ResetServerFields()
	SetChildID(uint64)
}

// ListChildResource returns all rows of T for the child, newest first.
func ListChildResource[T any, PT childResourcePtr[T]](s *HealthService, ctx context.Context, role model.Role, userID, childID uint64) ([]T, error) {
	if err := s.childSvc.Authorize(ctx, role, userID, childID); err != nil {
		return nil, err
	}
	var items []T
	if err := s.db.WithContext(ctx).Where("child_id = ?", childID).Order("id DESC").Limit(500).Find(&items).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	return items, nil
}

// CreateChildResource inserts a bound row after stripping any client-supplied
// server fields and forcing the child id from the route.
func CreateChildResource[T any, PT childResourcePtr[T]](s *HealthService, ctx context.Context, role model.Role, userID, childID uint64, item PT, entity, ip string) error {
	if err := s.childSvc.Authorize(ctx, role, userID, childID); err != nil {
		return err
	}
	item.ResetServerFields()
	item.SetChildID(childID)
	if err := s.db.WithContext(ctx).Create(item).Error; err != nil {
		return apperr.Internal(err)
	}
	s.audit.Record(ctx, userID, "create", entity, item.GetID(), map[string]any{"child_id": childID}, ip)
	// Staff add these from the dashboard, where the parent is not present to be
	// told in person. Only the time-sensitive types notify — paperwork like
	// insurance or documents would just be noise.
	if title, ok := healthNotificationTitle(entity); ok && s.notifier != nil {
		s.notifier.NotifyGuardians(ctx, childID, model.CategoryUpdates,
			title, "Tap to view the details",
			map[string]any{"screen": "health", "child_id": childID})
	}
	return nil
}

// healthNotificationTitle names the area without disclosing specifics: a push
// is shown on a lock screen, outside the app's access controls. The second
// return reports whether this record type is worth notifying about at all.
func healthNotificationTitle(entity string) (string, bool) {
	switch entity {
	case "illness_log":
		return "New illness report", true
	case "medication":
		return "Medication record updated", true
	case "allergy":
		return "Allergy record updated", true
	case "vital_log":
		return "New health check recorded", true
	case "health_note":
		return "New health note", true
	default:
		// immunization, checkup, growth_record, emergency_contact, insurance_info,
		// medical_document: recorded for the file, not urgent for the parent.
		return "", false
	}
}

// UpdateChildResource overwrites an existing row (verified to belong to the
// child in the route) with the bound payload.
func UpdateChildResource[T any, PT childResourcePtr[T]](s *HealthService, ctx context.Context, role model.Role, userID, childID, itemID uint64, item PT, entity, ip string) error {
	if err := s.childSvc.Authorize(ctx, role, userID, childID); err != nil {
		return err
	}
	var existing T
	if err := s.db.WithContext(ctx).Where("id = ? AND child_id = ?", itemID, childID).First(&existing).Error; err != nil {
		return apperr.NotFound("record not found")
	}
	item.ResetServerFields()
	item.SetChildID(childID)
	// Select("*") makes zero values (false, 0, "") persist; Omit shields the
	// columns the server owns.
	if err := s.db.WithContext(ctx).Model(&existing).Where("id = ?", itemID).
		Select("*").Omit("id", "child_id", "created_at", "deleted_at").
		Updates(item).Error; err != nil {
		return apperr.Internal(err)
	}
	s.audit.Record(ctx, userID, "update", entity, itemID, map[string]any{"child_id": childID}, ip)
	return nil
}

// DeleteChildResource soft-deletes a row owned by the child in the route.
func DeleteChildResource[T any, PT childResourcePtr[T]](s *HealthService, ctx context.Context, role model.Role, userID, childID, itemID uint64, entity, ip string) error {
	if err := s.childSvc.Authorize(ctx, role, userID, childID); err != nil {
		return err
	}
	var existing T
	if err := s.db.WithContext(ctx).Where("id = ? AND child_id = ?", itemID, childID).First(&existing).Error; err != nil {
		return apperr.NotFound("record not found")
	}
	if err := s.db.WithContext(ctx).Delete(&existing).Error; err != nil {
		return apperr.Internal(err)
	}
	s.audit.Record(ctx, userID, "delete", entity, itemID, map[string]any{"child_id": childID}, ip)
	return nil
}
