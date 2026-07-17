package dto

type CreateDiaryEntryRequest struct {
	Type       string   `json:"type" validate:"required,oneof=meal sleep activity diaper note photo"`
	Title      string   `json:"title" validate:"required,min=1,max=191"`
	Body       string   `json:"body" validate:"omitempty,max=2000"`
	OccurredAt string   `json:"occurred_at" validate:"omitempty,datetime=2006-01-02T15:04:05Z07:00"`
	MediaIDs   []uint64 `json:"media_ids" validate:"omitempty,max=10"`
	IsLive     bool     `json:"is_live"`
}

type CreateMealLogRequest struct {
	MealType string  `json:"meal_type" validate:"required,oneof=breakfast lunch snack dinner"`
	Status   string  `json:"status" validate:"required,oneof=ate_well ate_half ate_little didnt_eat"`
	ServedAt string  `json:"served_at" validate:"omitempty,datetime=2006-01-02T15:04:05Z07:00"`
	Note     string  `json:"note" validate:"omitempty,max=500"`
	ImageID  *uint64 `json:"image_id"`
}

type CreateSleepLogRequest struct {
	StartAt        string `json:"start_at" validate:"required,datetime=2006-01-02T15:04:05Z07:00"`
	EndAt          string `json:"end_at" validate:"required,datetime=2006-01-02T15:04:05Z07:00"`
	QualityPct     int    `json:"quality_pct" validate:"min=0,max=100"`
	MoodAfter      string `json:"mood_after" validate:"omitempty,max=30"`
	DeepMin        int    `json:"deep_min" validate:"min=0,max=1440"`
	LightMin       int    `json:"light_min" validate:"min=0,max=1440"`
	AwakeMin       int    `json:"awake_min" validate:"min=0,max=1440"`
	TookToSleepMin int    `json:"took_to_sleep_min" validate:"min=0,max=1440"`
}

type CreateDiaperLogRequest struct {
	Time    string `json:"time" validate:"required,datetime=2006-01-02T15:04:05Z07:00"`
	Wetness string `json:"wetness" validate:"required,oneof=dry wet heavy"`
	Stool   string `json:"stool" validate:"omitempty,oneof=none hard normal soft loose diarrhea"`
	Comfort string `json:"comfort" validate:"omitempty,oneof=happy fussy"`
	Note    string `json:"note" validate:"omitempty,max=500"`
}

type UpsertHydrationRequest struct {
	Date   string `json:"date" validate:"required,datetime=2006-01-02"`
	Cups   int    `json:"cups" validate:"min=0,max=30"`
	Rating string `json:"rating" validate:"omitempty,max=20"`
}

type UpsertMenuRequest struct {
	Date       string   `json:"date" validate:"required,datetime=2006-01-02"`
	MealType   string   `json:"meal_type" validate:"required,oneof=breakfast lunch snack dinner"`
	DishName   string   `json:"dish_name" validate:"required,min=1,max=191"`
	Items      []string `json:"items" validate:"omitempty,max=20,dive,max=191"`
	IsBalanced bool     `json:"is_balanced"`
	ImageID    *uint64  `json:"image_id"`
}

type RateMenuRequest struct {
	ChildID uint64 `json:"child_id" validate:"required"`
	Rating  string `json:"rating" validate:"required,oneof=eats sometimes doesnt_eat"`
}

type ScheduleItemInput struct {
	Weekday     int    `json:"weekday" validate:"min=0,max=6"`
	StartsAt    string `json:"starts_at" validate:"required,datetime=15:04"`
	Title       string `json:"title" validate:"required,min=1,max=191"`
	Description string `json:"description" validate:"omitempty,max=500"`
	Icon        string `json:"icon" validate:"omitempty,max=50"`
	Color       string `json:"color" validate:"omitempty,max=20"`
	Sort        int    `json:"sort"`
}

// ReplaceScheduleRequest swaps a classroom's full weekly routine in one call.
type ReplaceScheduleRequest struct {
	Items []ScheduleItemInput `json:"items" validate:"max=100,dive"`
}

type WeeklyPlanItemInput struct {
	Kind        string `json:"kind" validate:"required,oneof=learning_area activity gain"`
	Day         *int   `json:"day" validate:"omitempty,min=0,max=6"`
	Title       string `json:"title" validate:"required,min=1,max=191"`
	Description string `json:"description" validate:"omitempty,max=500"`
	Icon        string `json:"icon" validate:"omitempty,max=50"`
	Color       string `json:"color" validate:"omitempty,max=20"`
	Sort        int    `json:"sort"`
}

type UpsertWeeklyPlanRequest struct {
	Week  string                `json:"week" validate:"required,datetime=2006-01-02"`
	Note  string                `json:"note" validate:"omitempty,max=1000"`
	Items []WeeklyPlanItemInput `json:"items" validate:"max=100,dive"`
}

// RangeQuery filters time-series logs.
type RangeQuery struct {
	PageQuery
	From string `query:"from" validate:"omitempty,datetime=2006-01-02"`
	To   string `query:"to" validate:"omitempty,datetime=2006-01-02"`
}
