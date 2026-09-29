package service

import (
	"context"
	"time"

	"gorm.io/gorm"

	"github.com/sunnystars/backend/internal/database"
	"github.com/sunnystars/backend/internal/dto"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
	"github.com/sunnystars/backend/internal/repository"
)

type AttendanceService struct {
	db         *gorm.DB
	attendance *repository.AttendanceRepo
	children   *repository.ChildRepo
	childSvc   *ChildService
	audit      *AuditService
	notifier   Notifier
}

func NewAttendanceService(db *gorm.DB, attendance *repository.AttendanceRepo, children *repository.ChildRepo, childSvc *ChildService, audit *AuditService, notifier Notifier) *AttendanceService {
	return &AttendanceService{db: db, attendance: attendance, children: children, childSvc: childSvc, audit: audit, notifier: notifier}
}

// nurseryToday is today's date in the nursery's own timezone. Truncating a UTC
// timestamp put evening requests on the wrong day for eastern timezones.
func (s *AttendanceService) nurseryToday(ctx context.Context) time.Time {
	loc := time.UTC
	if id, ok := database.TenantFrom(ctx); ok && id != 0 {
		var n model.Nursery
		if err := s.db.WithContext(database.WithCrossTenant(ctx)).Select("timezone").First(&n, id).Error; err == nil {
			if l, err := time.LoadLocation(n.Timezone); err == nil {
				loc = l
			}
		}
	}
	today, _ := time.Parse("2006-01-02", time.Now().In(loc).Format("2006-01-02"))
	return today
}

// notifyAttendanceChange tells everyone who cares about a parent's report:
// the child's classroom teachers, the nursery admins and the other guardians.
func (s *AttendanceService) notifyAttendanceChange(ctx context.Context, ch *model.Child, reporterID uint64, title, body string) {
	data := map[string]any{"type": "attendance", "screen": "attendance", "child_id": ch.ID}
	recipients := map[uint64]bool{}
	if ch.ClassroomID != nil {
		var teacherIDs []uint64
		s.db.WithContext(ctx).Model(&model.ClassroomTeacher{}).
			Where("classroom_id = ?", *ch.ClassroomID).Pluck("teacher_user_id", &teacherIDs)
		for _, id := range teacherIDs {
			recipients[id] = true
		}
	}
	var adminIDs []uint64
	s.db.WithContext(ctx).Model(&model.User{}).
		Where("role = ? AND status = ?", model.RoleAdmin, model.UserActive).Pluck("id", &adminIDs)
	for _, id := range adminIDs {
		recipients[id] = true
	}
	var guardianIDs []uint64
	s.db.WithContext(ctx).Model(&model.Guardian{}).Where("child_id = ?", ch.ID).Pluck("parent_user_id", &guardianIDs)
	for _, id := range guardianIDs {
		recipients[id] = true
	}
	delete(recipients, reporterID)
	for id := range recipients {
		s.notifier.NotifyUser(ctx, id, model.CategoryUpdates, title, body, data)
	}
}

func (s *AttendanceService) List(ctx context.Context, role model.Role, userID, childID uint64, q dto.ListAttendanceQuery) ([]model.Attendance, int64, error) {
	if err := s.childSvc.Authorize(ctx, role, userID, childID); err != nil {
		return nil, 0, err
	}
	return s.attendance.ListForChild(ctx, childID, q)
}

// ListPending is the staff review queue of unconfirmed parent requests, scoped
// to the caller's own classrooms when they are a teacher.
func (s *AttendanceService) ListPending(ctx context.Context, q dto.PageQuery, role model.Role, userID uint64) ([]model.Attendance, int64, error) {
	rows, total, err := s.attendance.ListPending(ctx, q, role, userID)
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
	today := s.nurseryToday(ctx)
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
	ch, err := s.children.ByID(ctx, childID)
	if err != nil {
		return nil, apperr.NotFound("child not found")
	}
	// An absence for today changes the child's live status everywhere at once
	// (parent app, teacher roster, admin dashboard). Late / early pickup keep
	// the child expected, so their presence is left to the teacher's check-in.
	if status == model.AttendanceAbsent && date.Equal(today) && ch.PresentStatus != model.PresentAbs {
		ch.PresentStatus = model.PresentAbs
		if err := s.children.Update(ctx, ch); err != nil {
			return nil, apperr.Internal(err)
		}
	}
	if role == model.RoleParent {
		label := map[model.AttendanceStatus]string{
			model.AttendanceAbsent: "will be absent",
			model.AttendanceLate:   "will arrive late",
		}[status]
		if label == "" {
			label = "will be picked up early"
		}
		body := ch.FirstName + " " + label + " on " + req.Date
		if req.Note != "" {
			body += ": " + req.Note
		}
		s.notifyAttendanceChange(ctx, ch, userID, "Attendance update", body)
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
	case "absent":
		ch.PresentStatus = model.PresentAbs
		a.Status = model.AttendanceAbsent
	default:
		return nil, apperr.BadRequest("action must be check_in, check_out, or absent")
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
	// Arrival, pickup, or absence notice
	title, body := "Checked in", ch.FirstName+" arrived safely at the nursery"
	if action == "check_out" {
		title, body = "Checked out", ch.FirstName+" has been picked up"
	} else if action == "absent" {
		title, body = "Absence recorded", ch.FirstName+" has been marked absent today"
	}
	s.notifier.NotifyGuardians(ctx, childID, model.CategoryUpdates, title, body,
		map[string]any{"screen": "attendance", "child_id": childID})
	return ch, nil
}
