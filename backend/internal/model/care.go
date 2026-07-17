package model

import (
	"time"

	"gorm.io/datatypes"
)

type DiaryType string

const (
	DiaryMeal     DiaryType = "meal"
	DiarySleep    DiaryType = "sleep"
	DiaryActivity DiaryType = "activity"
	DiaryDiaper   DiaryType = "diaper"
	DiaryNote     DiaryType = "note"
	DiaryPhoto    DiaryType = "photo"
)

type DiaryEntry struct {
	Base
	ChildID        uint64       `gorm:"not null;index:idx_diary_child_time" json:"child_id"`
	Type           DiaryType    `gorm:"type:enum('meal','sleep','activity','diaper','note','photo');not null" json:"type"`
	Title          string       `gorm:"size:191;not null" json:"title"`
	Body           string       `gorm:"size:2000" json:"body"`
	OccurredAt     time.Time    `gorm:"not null;index:idx_diary_child_time" json:"occurred_at"`
	LoggedByUserID uint64       `gorm:"not null" json:"logged_by_user_id"`
	LoggedBy       *User        `gorm:"foreignKey:LoggedByUserID" json:"logged_by,omitempty"`
	IsLive         bool         `gorm:"not null;default:true" json:"is_live"`
	Media          []DiaryMedia `json:"media,omitempty"`
}

type DiaryMedia struct {
	ID           uint64 `gorm:"primaryKey" json:"-"`
	DiaryEntryID uint64 `gorm:"not null;index" json:"-"`
	MediaID      uint64 `gorm:"not null" json:"media_id"`
	Media        *Media `gorm:"foreignKey:MediaID" json:"media,omitempty"`
	Sort         int    `gorm:"not null;default:0" json:"sort"`
}

type MealLog struct {
	Base
	ChildID  uint64    `gorm:"not null;index:idx_meal_child_time" json:"child_id"`
	MealType string    `gorm:"type:enum('breakfast','lunch','snack','dinner');not null" json:"meal_type"`
	Status   string    `gorm:"type:enum('ate_well','ate_half','ate_little','didnt_eat');not null" json:"status"`
	ServedAt time.Time `gorm:"not null;index:idx_meal_child_time" json:"served_at"`
	Note     string    `gorm:"size:500" json:"note"`
	ImageID  *uint64   `json:"image_id"`
	Image    *Media    `gorm:"foreignKey:ImageID" json:"image,omitempty"`
}

type HydrationLog struct {
	Base
	ChildID uint64    `gorm:"not null;uniqueIndex:ux_hydration_child_date" json:"child_id"`
	Date    time.Time `gorm:"type:date;not null;uniqueIndex:ux_hydration_child_date" json:"date"`
	Cups    int       `gorm:"not null;default:0" json:"cups"`
	Rating  string    `gorm:"size:20" json:"rating"`
}

type WeeklyMenu struct {
	Base
	ClassroomID uint64         `gorm:"not null;uniqueIndex:ux_menu_room_date_type" json:"classroom_id"`
	Date        time.Time      `gorm:"type:date;not null;uniqueIndex:ux_menu_room_date_type" json:"date"`
	MealType    string         `gorm:"type:enum('breakfast','lunch','snack','dinner');not null;uniqueIndex:ux_menu_room_date_type" json:"meal_type"`
	DishName    string         `gorm:"size:191;not null" json:"dish_name"`
	ItemsJSON   datatypes.JSON `json:"items"`
	IsBalanced  bool           `gorm:"not null;default:true" json:"is_balanced"`
	ImageID     *uint64        `json:"image_id"`
	Image       *Media         `gorm:"foreignKey:ImageID" json:"image,omitempty"`
	Ratings     []MenuRating   `json:"ratings,omitempty"`
}

type MenuRating struct {
	Base
	WeeklyMenuID uint64 `gorm:"not null;uniqueIndex:ux_rating_menu_child" json:"weekly_menu_id"`
	ChildID      uint64 `gorm:"not null;uniqueIndex:ux_rating_menu_child" json:"child_id"`
	Rating       string `gorm:"type:enum('eats','sometimes','doesnt_eat');not null" json:"rating"`
}

type SleepLog struct {
	Base
	ChildID        uint64    `gorm:"not null;index:idx_sleep_child_start" json:"child_id"`
	StartAt        time.Time `gorm:"not null;index:idx_sleep_child_start" json:"start_at"`
	EndAt          time.Time `gorm:"not null" json:"end_at"`
	TotalMinutes   int       `gorm:"not null" json:"total_minutes"`
	QualityPct     int       `gorm:"not null;default:0" json:"quality_pct"`
	MoodAfter      string    `gorm:"size:30" json:"mood_after"`
	DeepMin        int       `gorm:"not null;default:0" json:"deep_min"`
	LightMin       int       `gorm:"not null;default:0" json:"light_min"`
	AwakeMin       int       `gorm:"not null;default:0" json:"awake_min"`
	TookToSleepMin int       `gorm:"not null;default:0" json:"took_to_sleep_min"`
}

type DiaperLog struct {
	Base
	ChildID uint64    `gorm:"not null;index:idx_diaper_child_time" json:"child_id"`
	Time    time.Time `gorm:"not null;index:idx_diaper_child_time" json:"time"`
	Wetness string    `gorm:"type:enum('dry','wet','heavy');not null" json:"wetness"`
	Stool   string    `gorm:"type:enum('none','hard','normal','soft','loose','diarrhea');not null;default:'none'" json:"stool"`
	Comfort string    `gorm:"type:enum('happy','fussy');not null;default:'happy'" json:"comfort"`
	Note    string    `gorm:"size:500" json:"note"`
}
