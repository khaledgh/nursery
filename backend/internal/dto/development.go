package dto

type UpsertMilestoneCategoryRequest struct {
	Name        string `json:"name" validate:"required,min=1,max=191"`
	Description string `json:"description" validate:"omitempty,max=500"`
	Color       string `json:"color" validate:"omitempty,max=20"`
	Icon        string `json:"icon" validate:"omitempty,max=50"`
}

type AssessMilestoneRequest struct {
	CategoryID  uint64 `json:"category_id" validate:"required"`
	ProgressPct int    `json:"progress_pct" validate:"min=0,max=100"`
	Description string `json:"description" validate:"omitempty,max=1000"`
	Status      string `json:"status" validate:"omitempty,oneof=not_started in_progress achieved"`
}

type UpsertAchievementTemplateRequest struct {
	Title       string `json:"title" validate:"required,min=1,max=191"`
	Description string `json:"description" validate:"omitempty,max=500"`
	Icon        string `json:"icon" validate:"omitempty,max=50"`
	Color       string `json:"color" validate:"omitempty,max=20"`
}

type AwardAchievementRequest struct {
	AchievementTemplateID uint64 `json:"achievement_template_id" validate:"required"`
	AwardedDate           string `json:"awarded_date" validate:"required,datetime=2006-01-02"`
	Note                  string `json:"note" validate:"omitempty,max=500"`
}

type ReportRatingInput struct {
	Dimension string `json:"dimension" validate:"required,oneof=social participation listening focus hygiene eating"`
	Rating    string `json:"rating" validate:"required,oneof=thriving doing_well improving needs_support"`
	Note      string `json:"note" validate:"omitempty,max=500"`
}

type UpsertDailyReportRequest struct {
	Date             string              `json:"date" validate:"required,datetime=2006-01-02"`
	Summary          string              `json:"summary" validate:"omitempty,max=2000"`
	HighlightText    string              `json:"highlight_text" validate:"omitempty,max=1000"`
	HighlightMediaID *uint64             `json:"highlight_media_id"`
	HomeTips         []string            `json:"home_tips" validate:"omitempty,max=10,dive,max=500"`
	Moods            []ReportMoodInput   `json:"moods" validate:"omitempty,max=6,dive"`
	Ratings          []ReportRatingInput `json:"ratings" validate:"omitempty,max=10,dive"`
}

type ReportMoodInput struct {
	Key    string `json:"key" validate:"required,oneof=social creative happy calm"`
	Rating string `json:"rating" validate:"required,oneof=great good okay"`
}
