package model

// UITranslation is Layer A: live-editable UI strings served to clients as
// i18n bundles (GET /i18n/:locale) so admins can fix copy without a release.
type UITranslation struct {
	ID        uint64 `gorm:"primaryKey" json:"id"`
	Locale    string `gorm:"size:10;not null;uniqueIndex:ux_ui_translations" json:"locale"`
	Namespace string `gorm:"size:50;not null;default:'common';uniqueIndex:ux_ui_translations" json:"namespace"`
	Key       string `gorm:"size:191;not null;uniqueIndex:ux_ui_translations" json:"key"`
	Value     string `gorm:"type:text;not null" json:"value"`
}

// ContentTranslation is Layer B: one row per translated field of any entity
// (events, announcements, reminders, menu dishes, ...). The generic shape
// lets the admin translations UI cover new entities without schema changes.
type ContentTranslation struct {
	ID         uint64 `gorm:"primaryKey" json:"id"`
	EntityType string `gorm:"size:50;not null;uniqueIndex:ux_content_translations" json:"entity_type"`
	EntityID   uint64 `gorm:"not null;uniqueIndex:ux_content_translations" json:"entity_id"`
	Locale     string `gorm:"size:10;not null;uniqueIndex:ux_content_translations" json:"locale"`
	Field      string `gorm:"size:50;not null;uniqueIndex:ux_content_translations" json:"field"`
	Value      string `gorm:"type:text;not null" json:"value"`
}
