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
	Slug         string        `gorm:"size:64;not null;uniqueIndex" json:"slug"`
	ContactEmail string        `gorm:"size:191" json:"contact_email"`
	ContactPhone string        `gorm:"size:32" json:"contact_phone"`
	Locale       string        `gorm:"size:10;not null;default:'en'" json:"locale"`
	Timezone     string        `gorm:"size:64;not null;default:'Europe/Stockholm'" json:"timezone"`
	Status       NurseryStatus `gorm:"type:enum('active','suspended','cancelled');not null;default:'active'" json:"status"`
	LogoMediaID  *uint64       `json:"logo_media_id"`
	Logo         *Media        `gorm:"foreignKey:LogoMediaID" json:"logo,omitempty"`
}

func (n Nursery) IsOperational() bool { return n.Status == NurseryActive }
