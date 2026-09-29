package model

type NurseryStatus string

const (
	NurseryActive    NurseryStatus = "active"
	NurserySuspended NurseryStatus = "suspended"
	NurseryCancelled NurseryStatus = "cancelled"
)

// Nursery is the tenant root. Every tenant-owned row carries its id, and the
// tenancy callback in internal/database scopes queries to it automatically.
//
// It embeds Base, not TenantBase: a nursery is not owned by a nursery.
type Nursery struct {
	Base
	Name         string        `gorm:"size:191;not null" json:"name"`
	Slug          string        `gorm:"size:64;not null;uniqueIndex" json:"slug"`
	LoginIDPrefix string        `gorm:"size:32" json:"login_id_prefix,omitempty"`
	LoginRangeStart *uint64     `json:"login_range_start,omitempty"`
	LoginRangeEnd   *uint64     `json:"login_range_end,omitempty"`
	ContactEmail  string        `gorm:"size:191" json:"contact_email"`
	ContactPhone string        `gorm:"size:32" json:"contact_phone"`
	Locale       string        `gorm:"size:10;not null;default:'en'" json:"locale"`
	Timezone     string        `gorm:"size:64;not null;default:'Europe/Stockholm'" json:"timezone"`
	Status       NurseryStatus `gorm:"type:enum('active','suspended','cancelled');not null;default:'active'" json:"status"`
	LogoMediaID  *uint64       `json:"logo_media_id"`
	Logo         *Media        `gorm:"foreignKey:LogoMediaID" json:"logo,omitempty"`
	// Currency is the ISO code the nursery bills parents in (set by its admin).
	Currency string `gorm:"size:3;not null;default:'USD'" json:"currency"`
	// Watermark is burned into child photos on upload when enabled.
	WatermarkEnabled  bool    `gorm:"not null;default:false" json:"watermark_enabled"`
	WatermarkMediaID  *uint64 `json:"watermark_media_id"`
	WatermarkPosition string  `gorm:"type:enum('bottom_right','bottom_left','top_right','top_left','center');not null;default:'bottom_right'" json:"watermark_position"`
	WatermarkOpacity  uint8   `gorm:"not null;default:60" json:"watermark_opacity"`
}

func (n Nursery) IsOperational() bool { return n.Status == NurseryActive }
