package service

import (
	"context"
	"encoding/json"
	"time"

	"gorm.io/datatypes"

	"github.com/sunnystars/backend/internal/dto"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
	"github.com/sunnystars/backend/internal/repository"
)

type CareService struct {
	care       *repository.CareRepo
	children   *repository.ChildRepo
	classrooms *repository.ClassroomRepo
	childSvc   *ChildService
	notifier   Notifier
	audit      *AuditService
}

func NewCareService(care *repository.CareRepo, children *repository.ChildRepo, classrooms *repository.ClassroomRepo, childSvc *ChildService, notifier Notifier, audit *AuditService) *CareService {
	return &CareService{care: care, children: children, classrooms: classrooms, childSvc: childSvc, notifier: notifier, audit: audit}
}

// --- diary ---

// shouldNotifyDiary reports whether guardians get a push for this entry.
//
// Nil means the client did not send the field, which must keep notifying: the
// admin panel and older app builds predate the flag. Staff posting a burst of
// photos from the phone opt out explicitly so twenty pictures do not become
// twenty lock-screen notifications.
func shouldNotifyDiary(req *dto.CreateDiaryEntryRequest) bool {
	return req.Notify == nil || *req.Notify
}

func (s *CareService) ListDiary(ctx context.Context, role model.Role, userID, childID uint64, q dto.RangeQuery) ([]model.DiaryEntry, int64, error) {
	if err := s.childSvc.Authorize(ctx, role, userID, childID); err != nil {
		return nil, 0, err
	}
	return s.care.ListDiary(ctx, childID, q)
}

func (s *CareService) CreateDiary(ctx context.Context, role model.Role, userID, childID uint64, req *dto.CreateDiaryEntryRequest, ip string) (*model.DiaryEntry, error) {
	if err := s.childSvc.Authorize(ctx, role, userID, childID); err != nil {
		return nil, err
	}
	occurredAt := time.Now()
	if req.OccurredAt != "" {
		t, err := time.Parse(time.RFC3339, req.OccurredAt)
		if err != nil {
			return nil, apperr.BadRequest("invalid occurred_at")
		}
		occurredAt = t
	}
	entry := &model.DiaryEntry{
		ChildID:        childID,
		Type:           model.DiaryType(req.Type),
		Title:          req.Title,
		Body:           req.Body,
		OccurredAt:     occurredAt,
		LoggedByUserID: userID,
		IsLive:         req.IsLive,
	}
	for i, mid := range req.MediaIDs {
		entry.Media = append(entry.Media, model.DiaryMedia{MediaID: mid, Sort: i})
	}
	if err := s.care.CreateDiary(ctx, entry); err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, userID, "create", "diary_entry", entry.ID, map[string]any{"child_id": childID, "type": req.Type}, ip)
	if shouldNotifyDiary(req) {
		s.notifier.NotifyGuardians(ctx, childID, "updates", "New diary update", req.Title,
			map[string]any{"screen": "diary", "child_id": childID, "entry_id": entry.ID})
	}
	return entry, nil
}

// --- meals ---

func (s *CareService) ListMeals(ctx context.Context, role model.Role, userID, childID uint64, q dto.RangeQuery) ([]model.MealLog, int64, error) {
	if err := s.childSvc.Authorize(ctx, role, userID, childID); err != nil {
		return nil, 0, err
	}
	return s.care.ListMeals(ctx, childID, q)
}

func (s *CareService) CreateMeal(ctx context.Context, role model.Role, userID, childID uint64, req *dto.CreateMealLogRequest, ip string) (*model.MealLog, error) {
	if err := s.childSvc.Authorize(ctx, role, userID, childID); err != nil {
		return nil, err
	}
	servedAt := time.Now()
	if req.ServedAt != "" {
		t, err := time.Parse(time.RFC3339, req.ServedAt)
		if err != nil {
			return nil, apperr.BadRequest("invalid served_at")
		}
		servedAt = t
	}
	m := &model.MealLog{
		ChildID:  childID,
		MealType: req.MealType,
		Status:   req.Status,
		ServedAt: servedAt,
		Note:     req.Note,
		ImageID:  req.ImageID,
	}
	if err := s.care.CreateMeal(ctx, m); err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, userID, "create", "meal_log", m.ID, map[string]any{"child_id": childID}, ip)
	return m, nil
}

// --- sleep ---

func (s *CareService) ListSleep(ctx context.Context, role model.Role, userID, childID uint64, q dto.RangeQuery) ([]model.SleepLog, int64, error) {
	if err := s.childSvc.Authorize(ctx, role, userID, childID); err != nil {
		return nil, 0, err
	}
	return s.care.ListSleep(ctx, childID, q)
}

func (s *CareService) CreateSleep(ctx context.Context, role model.Role, userID, childID uint64, req *dto.CreateSleepLogRequest, ip string) (*model.SleepLog, error) {
	if err := s.childSvc.Authorize(ctx, role, userID, childID); err != nil {
		return nil, err
	}
	start, err := time.Parse(time.RFC3339, req.StartAt)
	if err != nil {
		return nil, apperr.BadRequest("invalid start_at")
	}
	end, err := time.Parse(time.RFC3339, req.EndAt)
	if err != nil {
		return nil, apperr.BadRequest("invalid end_at")
	}
	if !end.After(start) {
		return nil, apperr.BadRequest("end_at must be after start_at")
	}
	if end.Sub(start) > 24*time.Hour {
		return nil, apperr.BadRequest("a sleep session cannot exceed 24 hours")
	}
	sl := &model.SleepLog{
		ChildID:        childID,
		StartAt:        start,
		EndAt:          end,
		TotalMinutes:   int(end.Sub(start).Minutes()),
		QualityPct:     req.QualityPct,
		MoodAfter:      req.MoodAfter,
		DeepMin:        req.DeepMin,
		LightMin:       req.LightMin,
		AwakeMin:       req.AwakeMin,
		TookToSleepMin: req.TookToSleepMin,
	}
	if err := s.care.CreateSleep(ctx, sl); err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, userID, "create", "sleep_log", sl.ID, map[string]any{"child_id": childID}, ip)
	return sl, nil
}

// --- diapers ---

func (s *CareService) ListDiapers(ctx context.Context, role model.Role, userID, childID uint64, q dto.RangeQuery) ([]model.DiaperLog, int64, error) {
	if err := s.childSvc.Authorize(ctx, role, userID, childID); err != nil {
		return nil, 0, err
	}
	return s.care.ListDiapers(ctx, childID, q)
}

func (s *CareService) CreateDiaper(ctx context.Context, role model.Role, userID, childID uint64, req *dto.CreateDiaperLogRequest, ip string) (*model.DiaperLog, error) {
	if err := s.childSvc.Authorize(ctx, role, userID, childID); err != nil {
		return nil, err
	}
	timeStr := req.Time
	if timeStr == "" {
		timeStr = req.OccurredAt
	}
	var t time.Time
	var err error
	if timeStr != "" {
		t, err = time.Parse(time.RFC3339, timeStr)
		if err != nil {
			return nil, apperr.BadRequest("invalid time format")
		}
	} else {
		t = time.Now()
	}
	stool, comfort := req.Stool, req.Comfort
	if stool == "" {
		stool = "none"
	}
	if comfort == "" {
		comfort = "happy"
	}
	d := &model.DiaperLog{
		ChildID: childID,
		Time:    t,
		Wetness: req.Wetness,
		Stool:   stool,
		Comfort: comfort,
		Note:    req.Note,
	}
	if err := s.care.CreateDiaper(ctx, d); err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, userID, "create", "diaper_log", d.ID, map[string]any{"child_id": childID}, ip)
	return d, nil
}

// --- hydration ---

func (s *CareService) ListHydration(ctx context.Context, role model.Role, userID, childID uint64, q dto.RangeQuery) ([]model.HydrationLog, int64, error) {
	if err := s.childSvc.Authorize(ctx, role, userID, childID); err != nil {
		return nil, 0, err
	}
	return s.care.ListHydration(ctx, childID, q)
}

func (s *CareService) UpsertHydration(ctx context.Context, role model.Role, userID, childID uint64, req *dto.UpsertHydrationRequest, ip string) (*model.HydrationLog, error) {
	if err := s.childSvc.Authorize(ctx, role, userID, childID); err != nil {
		return nil, err
	}
	date, _ := time.Parse("2006-01-02", req.Date)
	h := &model.HydrationLog{ChildID: childID, Date: date, Cups: req.Cups, Rating: req.Rating}
	if err := s.care.UpsertHydration(ctx, h); err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, userID, "upsert", "hydration_log", h.ID, map[string]any{"child_id": childID}, ip)
	return h, nil
}

// --- weekly menus ---

// AuthorizeClassroom mirrors child authorization for classroom-scoped reads:
// teachers must be assigned, parents must have a child there, admins pass.
func (s *CareService) AuthorizeClassroom(ctx context.Context, role model.Role, userID, classroomID uint64) error {
	switch role {
	case model.RoleAdmin:
		return nil
	case model.RoleTeacher:
		ok, err := s.classrooms.TeacherInClassroom(ctx, userID, classroomID)
		if err != nil {
			return apperr.Internal(err)
		}
		if !ok {
			return apperr.NotFound("classroom not found")
		}
		return nil
	default: // parent
		children, _, err := s.children.List(ctx, dto.PageQuery{Page: 1, PerPage: 100}, role, userID)
		if err != nil {
			return apperr.Internal(err)
		}
		for _, ch := range children {
			if ch.ClassroomID != nil && *ch.ClassroomID == classroomID {
				return nil
			}
		}
		return apperr.NotFound("classroom not found")
	}
}

func (s *CareService) MenuForWeek(ctx context.Context, role model.Role, userID, classroomID uint64, week string) ([]model.WeeklyMenu, error) {
	if err := s.AuthorizeClassroom(ctx, role, userID, classroomID); err != nil {
		return nil, err
	}
	weekStart := startOfWeek(time.Now())
	if week != "" {
		t, err := time.Parse("2006-01-02", week)
		if err != nil {
			return nil, apperr.BadRequest("invalid week date")
		}
		weekStart = startOfWeek(t)
	}
	menus, err := s.care.MenuForWeek(ctx, classroomID, weekStart)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return menus, nil
}

func (s *CareService) UpsertMenu(ctx context.Context, role model.Role, userID, classroomID uint64, req *dto.UpsertMenuRequest, ip string) (*model.WeeklyMenu, error) {
	if err := s.AuthorizeClassroom(ctx, role, userID, classroomID); err != nil {
		return nil, err
	}
	date, _ := time.Parse("2006-01-02", req.Date)
	items, err := json.Marshal(req.Items)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	m := &model.WeeklyMenu{
		ClassroomID: classroomID,
		Date:        date,
		MealType:    req.MealType,
		DishName:    req.DishName,
		ItemsJSON:   datatypes.JSON(items),
		IsBalanced:  req.IsBalanced,
		ImageID:     req.ImageID,
	}
	if err := s.care.UpsertMenu(ctx, m); err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, userID, "upsert", "weekly_menu", m.ID, map[string]any{"classroom_id": classroomID, "date": req.Date}, ip)
	return m, nil
}

// RateMenu lets a parent record how their child takes a dish.
func (s *CareService) RateMenu(ctx context.Context, role model.Role, userID, menuID uint64, req *dto.RateMenuRequest, ip string) (*model.MenuRating, error) {
	if _, err := s.care.MenuByID(ctx, menuID); err != nil {
		return nil, apperr.NotFound("menu not found")
	}
	// The rating is on behalf of a child — caller must be its guardian (or staff).
	if err := s.childSvc.Authorize(ctx, role, userID, req.ChildID); err != nil {
		return nil, err
	}
	rating := &model.MenuRating{WeeklyMenuID: menuID, ChildID: req.ChildID, Rating: req.Rating}
	if err := s.care.UpsertMenuRating(ctx, rating); err != nil {
		return nil, apperr.Internal(err)
	}
	return rating, nil
}

// --- classroom schedule ---

func (s *CareService) Schedule(ctx context.Context, role model.Role, userID, classroomID uint64) ([]model.ClassroomScheduleItem, error) {
	if err := s.AuthorizeClassroom(ctx, role, userID, classroomID); err != nil {
		return nil, err
	}
	items, err := s.care.Schedule(ctx, classroomID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return items, nil
}

func (s *CareService) ReplaceSchedule(ctx context.Context, role model.Role, userID, classroomID uint64, req *dto.ReplaceScheduleRequest, ip string) ([]model.ClassroomScheduleItem, error) {
	if err := s.AuthorizeClassroom(ctx, role, userID, classroomID); err != nil {
		return nil, err
	}
	items := make([]model.ClassroomScheduleItem, len(req.Items))
	for i, in := range req.Items {
		items[i] = model.ClassroomScheduleItem{
			Weekday: in.Weekday, StartsAt: in.StartsAt, Title: in.Title,
			Description: in.Description, Icon: in.Icon, Color: in.Color, Sort: in.Sort,
		}
	}
	if err := s.care.ReplaceSchedule(ctx, classroomID, items); err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, userID, "replace", "classroom_schedule", classroomID, map[string]any{"items": len(items)}, ip)
	return items, nil
}

// --- weekly learning plans ---

// PlanForWeek returns nil (not an error) when no plan exists for the week.
func (s *CareService) PlanForWeek(ctx context.Context, role model.Role, userID, classroomID uint64, week string) (*model.WeeklyPlan, error) {
	if err := s.AuthorizeClassroom(ctx, role, userID, classroomID); err != nil {
		return nil, err
	}
	weekStart := startOfWeek(time.Now())
	if week != "" {
		t, err := time.Parse("2006-01-02", week)
		if err != nil {
			return nil, apperr.BadRequest("invalid week date")
		}
		weekStart = startOfWeek(t)
	}
	plan, err := s.care.PlanForWeek(ctx, classroomID, weekStart)
	if err != nil {
		if repository.IsNotFound(err) {
			return nil, nil
		}
		return nil, apperr.Internal(err)
	}
	return plan, nil
}

func (s *CareService) UpsertPlan(ctx context.Context, role model.Role, userID, classroomID uint64, req *dto.UpsertWeeklyPlanRequest, ip string) (*model.WeeklyPlan, error) {
	if err := s.AuthorizeClassroom(ctx, role, userID, classroomID); err != nil {
		return nil, err
	}
	t, err := time.Parse("2006-01-02", req.Week)
	if err != nil {
		return nil, apperr.BadRequest("invalid week date")
	}
	plan := &model.WeeklyPlan{ClassroomID: classroomID, WeekStart: startOfWeek(t), Note: req.Note, CreatedBy: userID}
	items := make([]model.WeeklyPlanItem, len(req.Items))
	for i, in := range req.Items {
		items[i] = model.WeeklyPlanItem{
			Kind: model.WeeklyPlanItemKind(in.Kind), Day: in.Day, Title: in.Title,
			Description: in.Description, Icon: in.Icon, Color: in.Color, Sort: in.Sort,
		}
	}
	if err := s.care.UpsertPlan(ctx, plan, items); err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, userID, "upsert", "weekly_plan", plan.ID, map[string]any{"classroom_id": classroomID, "week": req.Week}, ip)
	return plan, nil
}

// --- classmates ---

// Classmates is the parent-safe roster: only first names and avatars leave
// the API, and only to people already authorized for the classroom.
func (s *CareService) Classmates(ctx context.Context, role model.Role, userID, classroomID uint64) ([]map[string]any, error) {
	if err := s.AuthorizeClassroom(ctx, role, userID, classroomID); err != nil {
		return nil, err
	}
	children, err := s.care.ChildrenInClassroom(ctx, classroomID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	out := make([]map[string]any, len(children))
	for i, ch := range children {
		out[i] = map[string]any{"id": ch.ID, "first_name": ch.FirstName, "avatar": ch.Avatar}
	}
	return out, nil
}

// --- dashboard ---

// Dashboard is the mobile home aggregate: child + today's care summary.
func (s *CareService) Dashboard(ctx context.Context, role model.Role, userID, childID uint64) (map[string]any, error) {
	child, err := s.childSvc.Get(ctx, role, userID, childID)
	if err != nil {
		return nil, err
	}
	summary, err := s.care.TodaySummary(ctx, childID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	summary["child"] = child
	return summary, nil
}

// startOfWeek returns the Monday of t's week (UTC date).
func startOfWeek(t time.Time) time.Time {
	t = time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
	weekday := int(t.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	return t.AddDate(0, 0, 1-weekday)
}
