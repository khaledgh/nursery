package model

import (
	"time"

	"gorm.io/datatypes"
)

type MilestoneCategory struct {
	TenantBase
	Name        string `gorm:"size:191;not null" json:"name"`
	Description string `gorm:"size:500" json:"description"`
	Color       string `gorm:"size:20" json:"color"`
	Icon        string `gorm:"size:50" json:"icon"`
}

type ChildMilestone struct {
	TenantBase
	ChildID     uint64             `gorm:"not null;uniqueIndex:ux_milestone_child_cat" json:"child_id"`
	CategoryID  uint64             `gorm:"not null;uniqueIndex:ux_milestone_child_cat" json:"category_id"`
	Category    *MilestoneCategory `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	ProgressPct int                `gorm:"not null;default:0" json:"progress_pct"`
	Description string             `gorm:"size:1000" json:"description"`
	Status      string             `gorm:"size:30;not null;default:'in_progress'" json:"status"`
	AssessedBy  uint64             `gorm:"not null" json:"assessed_by"`
	AssessedAt  time.Time          `gorm:"not null" json:"assessed_at"`
}

type AchievementTemplate struct {
	TenantBase
	Title       string `gorm:"size:191;not null" json:"title"`
	Description string `gorm:"size:500" json:"description"`
	Icon        string `gorm:"size:50" json:"icon"`
	Color       string `gorm:"size:20" json:"color"`
}

type ChildAchievement struct {
	TenantBase
	ChildID               uint64               `gorm:"not null;index" json:"child_id"`
	AchievementTemplateID uint64               `gorm:"not null" json:"achievement_template_id"`
	Template              *AchievementTemplate `gorm:"foreignKey:AchievementTemplateID" json:"template,omitempty"`
	AwardedDate           string               `gorm:"type:date;not null" json:"awarded_date"`
	Note                  string               `gorm:"size:500" json:"note"`
	AwardedBy             uint64               `gorm:"not null" json:"awarded_by"`
}

type DailyReport struct {
	TenantBase
	ChildID          uint64         `gorm:"not null;uniqueIndex:ux_report_child_date" json:"child_id"`
	Date             string         `gorm:"type:date;not null;uniqueIndex:ux_report_child_date" json:"date"`
	Summary          string         `gorm:"size:2000" json:"summary"`
	HighlightText    string         `gorm:"size:1000" json:"highlight_text"`
	HighlightMediaID *uint64        `json:"highlight_media_id"`
	HighlightMedia   *Media         `gorm:"foreignKey:HighlightMediaID" json:"highlight_media,omitempty"`
	HomeTipsJSON     datatypes.JSON `json:"home_tips"`
	MoodsJSON        datatypes.JSON `json:"moods"` // [{key: social|creative|happy|calm, rating: great|good|okay}]
	CreatedBy        uint64         `gorm:"not null" json:"created_by"`
	Ratings          []ReportRating `json:"ratings,omitempty"`
}

type ReportRating struct {
	ID            uint64 `gorm:"primaryKey" json:"-"`
	DailyReportID uint64 `gorm:"not null;uniqueIndex:ux_rating_report_dim" json:"-"`
	Dimension     string `gorm:"size:30;not null;uniqueIndex:ux_rating_report_dim" json:"dimension"`
	Rating        string `gorm:"type:enum('thriving','doing_well','improving','needs_support');not null" json:"rating"`
	Note          string `gorm:"size:500" json:"note"`
}
