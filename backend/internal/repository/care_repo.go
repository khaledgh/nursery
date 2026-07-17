package repository

import (
	"context"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/sunnystars/backend/internal/dto"
	"github.com/sunnystars/backend/internal/model"
)

type CareRepo struct{ db *gorm.DB }

func NewCareRepo(db *gorm.DB) *CareRepo { return &CareRepo{db: db} }

// listLogs pages any child-scoped log table ordered by timeCol descending.
func listLogs[T any](ctx context.Context, db *gorm.DB, childID uint64, timeCol string, q dto.RangeQuery, preloads ...string) ([]T, int64, error) {
	var (
		items []T
		total int64
		t     T
	)
	tx := db.WithContext(ctx).Model(&t).Where("child_id = ?", childID)
	if q.From != "" {
		tx = tx.Where(timeCol+" >= ?", q.From)
	}
	if q.To != "" {
		tx = tx.Where(timeCol+" < DATE_ADD(?, INTERVAL 1 DAY)", q.To)
	}
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	for _, p := range preloads {
		tx = tx.Preload(p)
	}
	err := tx.Order(timeCol + " DESC").Limit(q.PerPage).Offset(q.Offset()).Find(&items).Error
	return items, total, err
}

func (r *CareRepo) ListDiary(ctx context.Context, childID uint64, q dto.RangeQuery) ([]model.DiaryEntry, int64, error) {
	return listLogs[model.DiaryEntry](ctx, r.db, childID, "occurred_at", q, "Media", "Media.Media", "LoggedBy")
}

func (r *CareRepo) CreateDiary(ctx context.Context, entry *model.DiaryEntry) error {
	return r.db.WithContext(ctx).Create(entry).Error
}

func (r *CareRepo) ListMeals(ctx context.Context, childID uint64, q dto.RangeQuery) ([]model.MealLog, int64, error) {
	return listLogs[model.MealLog](ctx, r.db, childID, "served_at", q, "Image")
}

func (r *CareRepo) CreateMeal(ctx context.Context, m *model.MealLog) error {
	return r.db.WithContext(ctx).Create(m).Error
}

func (r *CareRepo) ListSleep(ctx context.Context, childID uint64, q dto.RangeQuery) ([]model.SleepLog, int64, error) {
	return listLogs[model.SleepLog](ctx, r.db, childID, "start_at", q)
}

func (r *CareRepo) CreateSleep(ctx context.Context, s *model.SleepLog) error {
	return r.db.WithContext(ctx).Create(s).Error
}

func (r *CareRepo) ListDiapers(ctx context.Context, childID uint64, q dto.RangeQuery) ([]model.DiaperLog, int64, error) {
	return listLogs[model.DiaperLog](ctx, r.db, childID, "time", q)
}

func (r *CareRepo) CreateDiaper(ctx context.Context, d *model.DiaperLog) error {
	return r.db.WithContext(ctx).Create(d).Error
}

func (r *CareRepo) ListHydration(ctx context.Context, childID uint64, q dto.RangeQuery) ([]model.HydrationLog, int64, error) {
	return listLogs[model.HydrationLog](ctx, r.db, childID, "date", q)
}

func (r *CareRepo) UpsertHydration(ctx context.Context, h *model.HydrationLog) error {
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "child_id"}, {Name: "date"}},
		DoUpdates: clause.AssignmentColumns([]string{"cups", "rating", "updated_at"}),
	}).Create(h).Error
}

// MenuForWeek returns the classroom menu for the 7 days starting weekStart.
func (r *CareRepo) MenuForWeek(ctx context.Context, classroomID uint64, weekStart time.Time) ([]model.WeeklyMenu, error) {
	var menus []model.WeeklyMenu
	err := r.db.WithContext(ctx).
		Where("classroom_id = ? AND date >= ? AND date < ?",
			classroomID, weekStart.Format("2006-01-02"), weekStart.AddDate(0, 0, 7).Format("2006-01-02")).
		Order("date ASC, meal_type ASC").
		Preload("Image").Preload("Ratings").
		Find(&menus).Error
	return menus, err
}

func (r *CareRepo) UpsertMenu(ctx context.Context, m *model.WeeklyMenu) error {
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "classroom_id"}, {Name: "date"}, {Name: "meal_type"}},
		DoUpdates: clause.AssignmentColumns([]string{"dish_name", "items_json", "is_balanced", "image_id", "updated_at"}),
	}).Create(m).Error
}

func (r *CareRepo) MenuByID(ctx context.Context, id uint64) (*model.WeeklyMenu, error) {
	var m model.WeeklyMenu
	err := r.db.WithContext(ctx).First(&m, id).Error
	return &m, err
}

func (r *CareRepo) UpsertMenuRating(ctx context.Context, rating *model.MenuRating) error {
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "weekly_menu_id"}, {Name: "child_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"rating", "updated_at"}),
	}).Create(rating).Error
}

// --- classroom schedule ---

func (r *CareRepo) Schedule(ctx context.Context, classroomID uint64) ([]model.ClassroomScheduleItem, error) {
	var items []model.ClassroomScheduleItem
	err := r.db.WithContext(ctx).
		Where("classroom_id = ?", classroomID).
		Order("weekday ASC, starts_at ASC, sort ASC").
		Find(&items).Error
	return items, err
}

// ReplaceSchedule swaps the classroom's full weekly routine atomically.
func (r *CareRepo) ReplaceSchedule(ctx context.Context, classroomID uint64, items []model.ClassroomScheduleItem) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Unscoped().Where("classroom_id = ?", classroomID).Delete(&model.ClassroomScheduleItem{}).Error; err != nil {
			return err
		}
		if len(items) == 0 {
			return nil
		}
		for i := range items {
			items[i].ClassroomID = classroomID
			items[i].ID = 0
		}
		return tx.Create(&items).Error
	})
}

// --- weekly learning plans ---

func (r *CareRepo) PlanForWeek(ctx context.Context, classroomID uint64, weekStart time.Time) (*model.WeeklyPlan, error) {
	var plan model.WeeklyPlan
	err := r.db.WithContext(ctx).
		Where("classroom_id = ? AND week_start = ?", classroomID, weekStart.Format("2006-01-02")).
		Preload("Items", func(db *gorm.DB) *gorm.DB { return db.Order("sort ASC, id ASC") }).
		First(&plan).Error
	if err != nil {
		return nil, err
	}
	return &plan, nil
}

// UpsertPlan writes the week's plan and replaces its items atomically.
func (r *CareRepo) UpsertPlan(ctx context.Context, plan *model.WeeklyPlan, items []model.WeeklyPlanItem) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "classroom_id"}, {Name: "week_start"}},
			DoUpdates: clause.AssignmentColumns([]string{"note", "created_by", "updated_at"}),
		}).Create(plan).Error; err != nil {
			return err
		}
		var stored model.WeeklyPlan
		if err := tx.Where("classroom_id = ? AND week_start = ?",
			plan.ClassroomID, plan.WeekStart.Format("2006-01-02")).First(&stored).Error; err != nil {
			return err
		}
		plan.ID = stored.ID
		if err := tx.Where("weekly_plan_id = ?", stored.ID).Delete(&model.WeeklyPlanItem{}).Error; err != nil {
			return err
		}
		if len(items) == 0 {
			return nil
		}
		for i := range items {
			items[i].WeeklyPlanID = stored.ID
			items[i].ID = 0
		}
		if err := tx.Create(&items).Error; err != nil {
			return err
		}
		plan.Items = items
		return nil
	})
}

// ChildrenInClassroom returns active children with avatars for the
// parent-safe classmates list (caller restricts the exposed fields).
func (r *CareRepo) ChildrenInClassroom(ctx context.Context, classroomID uint64) ([]model.Child, error) {
	var children []model.Child
	err := r.db.WithContext(ctx).
		Where("classroom_id = ? AND status = 'active'", classroomID).
		Order("first_name ASC").
		Preload("Avatar").
		Find(&children).Error
	return children, err
}

// TodaySummary aggregates today's care data for the home dashboard.
func (r *CareRepo) TodaySummary(ctx context.Context, childID uint64) (map[string]any, error) {
	today := time.Now().Format("2006-01-02")
	q := dto.RangeQuery{From: today, To: today}
	q.PageQuery = dto.PageQuery{Page: 1, PerPage: 20}

	meals, _, err := r.ListMeals(ctx, childID, q)
	if err != nil {
		return nil, err
	}
	sleeps, _, err := r.ListSleep(ctx, childID, q)
	if err != nil {
		return nil, err
	}
	diapers, _, err := r.ListDiapers(ctx, childID, q)
	if err != nil {
		return nil, err
	}
	var hydration model.HydrationLog
	if err := r.db.WithContext(ctx).
		Where("child_id = ? AND date = ?", childID, today).
		First(&hydration).Error; err != nil && !IsNotFound(err) {
		return nil, err
	}
	diary, _, err := r.ListDiary(ctx, childID, q)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"meals":     meals,
		"sleep":     sleeps,
		"diapers":   diapers,
		"hydration": hydration,
		"diary":     diary,
	}, nil
}
