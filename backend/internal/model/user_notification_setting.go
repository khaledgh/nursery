package model

type UserNotificationSetting struct {
	Base
	UserID               uint64 `gorm:"not null;uniqueIndex" json:"user_id"`
	PushEnabled          bool   `gorm:"not null;default:true" json:"push_enabled"`
	MessagesEnabled      bool   `gorm:"not null;default:true" json:"messages_enabled"`
	AnnouncementsEnabled bool   `gorm:"not null;default:true" json:"announcements_enabled"`
	RemindersEnabled     bool   `gorm:"not null;default:true" json:"reminders_enabled"`
	EventsEnabled        bool   `gorm:"not null;default:true" json:"events_enabled"`
}
