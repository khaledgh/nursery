package model

import (
	"time"

	"gorm.io/datatypes"
)

type Media struct {
	Base
	Disk       string  `gorm:"type:enum('local','s3');not null" json:"-"`
	Path       string  `gorm:"size:500;not null" json:"-"`
	URL        string  `gorm:"size:500;not null" json:"url"`
	Mime       string  `gorm:"size:100;not null" json:"mime"`
	Size       int64   `gorm:"not null" json:"size"`
	Width      int     `json:"width,omitempty"`
	Height     int     `json:"height,omitempty"`
	UploadedBy uint64  `gorm:"not null;index" json:"-"`
}

type Locale struct {
	Code       string `gorm:"primaryKey;size:10" json:"code"`
	Name       string `gorm:"size:100;not null" json:"name"`
	NativeName string `gorm:"size:100;not null" json:"native_name"`
	Direction  string `gorm:"type:enum('ltr','rtl');not null;default:'ltr'" json:"direction"`
	IsActive   bool   `gorm:"not null;default:true" json:"is_active"`
	IsDefault  bool   `gorm:"not null;default:false" json:"is_default"`
	SortOrder  int    `gorm:"not null;default:0" json:"sort_order"`
}

type Setting struct {
	Key       string         `gorm:"primaryKey;size:100" json:"key"`
	ValueJSON datatypes.JSON `gorm:"not null" json:"value"`
	UpdatedAt time.Time      `json:"updated_at"`
}

type AuditLog struct {
	ID          uint64         `gorm:"primaryKey" json:"id"`
	ActorUserID uint64         `gorm:"not null;index" json:"actor_user_id"`
	Action      string         `gorm:"size:50;not null" json:"action"` // create | update | delete | login | ...
	Entity      string         `gorm:"size:100;not null;index" json:"entity"`
	EntityID    uint64         `gorm:"index" json:"entity_id"`
	DiffJSON    datatypes.JSON `json:"diff"`
	IP          string         `gorm:"size:45" json:"ip"`
	CreatedAt   time.Time      `json:"created_at"`
}

type Notification struct {
	Base
	UserID   uint64         `gorm:"not null;index" json:"user_id"`
	Category string         `gorm:"size:30;not null" json:"category"` // updates | reminders | events | messages
	Title    string         `gorm:"size:191;not null" json:"title"`
	Body     string         `gorm:"size:1000" json:"body"`
	DataJSON datatypes.JSON `json:"data"`
	ReadAt   *time.Time     `json:"read_at"`
	SentAt   *time.Time     `json:"sent_at"`
}
