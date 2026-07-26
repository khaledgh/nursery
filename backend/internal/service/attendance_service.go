package service

import (
	"context"
	"time"

	"github.com/sunnystars/backend/internal/dto"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
	"github.com/sunnystars/backend/internal/repository"
)

type AttendanceService struct {
	attendance *repository.AttendanceRepo
	children   *repository.ChildRepo
	childSvc   *ChildService
	audit      *AuditService
	notifier   Notifier
}

func NewAttendanceService(attendance *repository.AttendanceRepo, children *repository.ChildRepo, childSvc *ChildService, audit *AuditService, notifier Notifier) *AttendanceService {
	return &AttendanceService{attendance: attendance, children: children, childSvc: childSvc, audit: audit, notifier: notifier}
}

func (s *AttendanceService) List(ctx context.Context, role model.Role, userID, childID uint64, q dto.ListAttendanceQuery) ([]model.Attendance, int64, error) {
	if err := s.childSvc.Authorize(ctx, role, userID, childID); err != nil {
		return nil, 0, err
	}
	return s.attendance.ListForChild(ctx, childID, q)
}

// ListPending is the staff review queue of unconfirmed parent requests.
func (s *AttendanceService) ListPending(ctx context.Context, q dto.PageQuery) ([]model.Attendance, int64, error) {
	rows, total, err := s.attendance.ListPending(ctx, q)
	if err != nil {
		return nil, 0, apperr.Internal(err)
	}
	return rows, total, nil
}

// Request records a parent's attendance request (absent / late / early
// pickup) or a teacher/admin's direct entry. Parents cannot mark "present" —
// presence comes from teacher check-in.
func (s *AttendanceService) Request(ctx context.Context, role model.Role, userID, childID uint64, req *dto.AttendanceRequest, ip string) (*model.Attendance, error) {
	if err := s.childSvc.Authorize(ctx, role, userID, childID); err != nil {
		return nil, err
	}
	status := model.AttendanceStatus(req.Status)
	if role == model.RoleParent && status == model.AttendancePresent {
		return nil, apperr.Forbidden("parents cannot mark a child present; teachers confirm check-in")
	}
	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		return nil, apperr.BadRequest("invalid date")
	}
	today := time.Now().Truncate(24 * time.Hour)
	if date.Before(today) {
		return nil, apperr.BadRequest("attendance can only be requested for today or a future date")
	}

	a := &model.Attendance{
		ChildID:     childID,
		Date:        date,
		Status:      status,
		Note:        req.Note,
		RequestedBy: &userID,
	}
	if err := s.attendance.Upsert(ctx, a); err != nil {
		return nil, apperr.Internal(err)
	}
	stored, err := s.attendance.ForChildOnDate(ctx, childID, date)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, userID, "request", "attendance", stored.ID,
		map[string]any{"child_id": childID, "status": req.Status, "date": req.Date}, ip)
	// Sits in the staff review queue until someone confirms it, so tell them
	// it is there rather than relying on the queue being checked.
	if role == model.RoleParent {
		s.notifier.NotifyRole(ctx, string(model.RoleTeacher), model.CategoryUpdates,
			"New attendance request", "A parent submitted a request for "+req.Date,
			map[string]any{"screen": "attendance", "child_id": childID})
	}
	return stored, nil
}

// Confirm lets a teacher (of the child's classroom) or admin confirm a
// pending request, optionally performing the physical check-in/out.
func (s *AttendanceService) Confirm(ctx context.Context, role model.Role, userID, attendanceID uint64, ip string) (*model.Attendance, error) {
	a, err := s.attendance.ByID(ctx, attendanceID)
	if err != nil {
		return nil, apperr.NotFound("attendance record not found")
	}
	if err := s.childSvc.Authorize(ctx, role, userID, a.ChildID); err != nil {
		return nil, err
	}
	now := time.Now()
	a.ConfirmedBy = &userID
	a.ConfirmedAt = &now
	if err := s.attendance.Update(ctx, a); err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, userID, "confirm", "attendance", a.ID, nil, ip)
	// The parent raised this request and has been waiting on an answer.
	s.notifier.NotifyGuardians(ctx, a.ChildID, model.CategoryUpdates,
		"Attendance confirmed", "The nursery confirmed your attendance request",
		map[string]any{"screen": "attendance", "child_id": a.ChildID})
	return a, nil
}

// CheckInOut is the teacher action that flips the child's live presence and
// stamps today's attendance row.
func (s *AttendanceService) CheckInOut(ctx context.Context, role model.Role, userID, childID uint64, action string, ip string) (*model.Child, error) {
	if err := s.childSvc.Authorize(ctx, role, userID, childID); err != nil {
		return nil, err
	}
	ch, err := s.children.ByID(ctx, childID)
	if err != nil {
		return nil, apperr.NotFound("child not found")
	}
	now := time.Now()
	today, _ := time.Parse("2006-01-02", now.Format("2006-01-02"))

	a, err := s.attendance.ForChildOnDate(ctx, childID, today)
	if repository.IsNotFound(err) {
		a = &model.Attendance{ChildID: childID, Date: today, Status: model.AttendancePresent}
		if err := s.attendance.Upsert(ctx, a); err != nil {
			return nil, apperr.Internal(err)
		}
		if a, err = s.attendance.ForChildOnDate(ctx, childID, today); err != nil {
			return nil, apperr.Internal(err)
		}
	} else if err != nil {
		return nil, apperr.Internal(err)
	}

	switch action {
	case "check_in":
		ch.PresentStatus = model.PresentIn
		ch.CheckedInAt = &now
		a.Status = model.AttendancePresent
		a.CheckedInAt = &now
	case "check_out":
		ch.PresentStatus = model.PresentOut
		a.CheckedOutAt = &now
	default:
		return nil, apperr.BadRequest("action must be check_in or check_out")
	}
	a.ConfirmedBy = &userID
	a.ConfirmedAt = &now

	if err := s.attendance.Update(ctx, a); err != nil {
		return nil, apperr.Internal(err)
	}
	if err := s.children.Update(ctx, ch); err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, userID, action, "attendance", a.ID, map[string]any{"child_id": childID}, ip)
	// Arrival and pickup are the two moments a parent most wants confirmed.
	title, body := "Checked in", ch.FirstName+" arrived safely at the nursery"
	if action == "check_out" {
		title, body = "Checked out", ch.FirstName+" has been picked up"
	}
	s.notifier.NotifyGuardians(ctx, childID, model.CategoryUpdates, title, body,
		map[string]any{"screen": "attendance", "child_id": childID})
	return ch, nil
}
