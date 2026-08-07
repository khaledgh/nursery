package model

import "time"

// ClassroomScheduleItem is one recurring slot in a classroom's weekly routine
// ("Circle Time 09:00"). Weekday follows Go's time.Weekday (0=Sunday).
type ClassroomScheduleItem struct {
	TenantBase
	ClassroomID uint64 `gorm:"not null;index:idx_schedule_room_day" json:"classroom_id"`
	Weekday     int    `gorm:"not null;index:idx_schedule_room_day" json:"weekday"`
	StartsAt    string `gorm:"size:8;not null" json:"starts_at"` // "09:00"
	Title       string `gorm:"size:191;not null" json:"title"`
	Description string `gorm:"size:500" json:"description"`
	Icon        string `gorm:"size:50" json:"icon"`
	Color       string `gorm:"size:20" json:"color"`
	Sort        int    `gorm:"not null;default:0" json:"sort"`
}

type WeeklyPlanItemKind string

const (
	PlanLearningArea WeeklyPlanItemKind = "learning_area"
	PlanActivity     WeeklyPlanItemKind = "activity"
	PlanGain         WeeklyPlanItemKind = "gain"
)

// WeeklyPlan is a classroom's curated learning plan for one Monday-start week:
// learning areas, per-day activities and the values/skills being nurtured.
type WeeklyPlan struct {
	TenantBase
	ClassroomID uint64           `gorm:"not null;uniqueIndex:ux_plan_room_week" json:"classroom_id"`
	WeekStart   time.Time        `gorm:"type:date;not null;uniqueIndex:ux_plan_room_week" json:"week_start"`
	Note        string           `gorm:"size:1000" json:"note"`
	CreatedBy   uint64           `gorm:"not null" json:"created_by"`
	Items       []WeeklyPlanItem `json:"items,omitempty"`
}

type WeeklyPlanItem struct {
	ID           uint64             `gorm:"primaryKey" json:"id"`
	WeeklyPlanID uint64             `gorm:"not null;index:idx_plan_item_plan" json:"-"`
	Kind         WeeklyPlanItemKind `gorm:"type:enum('learning_area','activity','gain');not null" json:"kind"`
	Day          *int               `json:"day"` // 0=Sunday..6=Saturday; set only for activities
	Title        string             `gorm:"size:191;not null" json:"title"`
	Description  string             `gorm:"size:500" json:"description"`
	Icon         string             `gorm:"size:50" json:"icon"`
	Color        string             `gorm:"size:20" json:"color"`
	Sort         int                `gorm:"not null;default:0" json:"sort"`
}
