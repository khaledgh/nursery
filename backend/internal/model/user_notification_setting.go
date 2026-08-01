package model

import "time"

type UserNotificationSetting struct {
	ID                   uint64    `gorm:"primaryKey" json:"id"`
	UserID               uint64    `gorm:"not null;uniqueIndex" json:"user_id"`
	PushEnabled          bool      `gorm:"not null;default:true" json:"push_enabled"`
	MessagesEnabled      bool      `gorm:"not null;default:true" json:"messages_enabled"`
	AnnouncementsEnabled bool      `gorm:"not null;default:true" json:"announcements_enabled"`
	RemindersEnabled     bool      `gorm:"not null;default:true" json:"reminders_enabled"`
	EventsEnabled        bool      `gorm:"not null;default:true" json:"events_enabled"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}

func (u *UserNotificationSetting) GetID() uint64 { return u.ID }
