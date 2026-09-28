package model

type DemoRequestStatus string

const (
	DemoRequestNew       DemoRequestStatus = "new"
	DemoRequestContacted DemoRequestStatus = "contacted"
	DemoRequestScheduled DemoRequestStatus = "scheduled"
	DemoRequestConverted DemoRequestStatus = "converted"
	DemoRequestRejected  DemoRequestStatus = "rejected"
)

// DemoRequest is a lead from the public landing site. Platform-global: it is
// never scoped to a nursery, so it is absent from database.TenantTables.
type DemoRequest struct {
	Base
	FullName             string            `gorm:"size:120;not null" json:"full_name"`
	NurseryName          string            `gorm:"size:160;not null" json:"nursery_name"`
	Email                string            `gorm:"size:190;not null" json:"email"`
	Phone                string            `gorm:"size:40;not null" json:"phone"`
	City                 *string           `gorm:"size:100" json:"city"`
	Country              *string           `gorm:"size:100" json:"country"`
	ChildrenRange        *string           `gorm:"type:enum('lt30','30_60','60_100','100_150','gt150')" json:"children_range"`
	PreferredContactTime *string           `gorm:"size:60" json:"preferred_contact_time"`
	Message              *string           `gorm:"type:text" json:"message"`
	Locale               string            `gorm:"size:5;not null;default:'en'" json:"locale"`
	Status               DemoRequestStatus `gorm:"type:enum('new','contacted','scheduled','converted','rejected');not null;default:'new'" json:"status"`
	AdminNotes           *string           `gorm:"type:text" json:"admin_notes"`
	IPAddress            *string           `gorm:"size:45" json:"ip_address"`
	UserAgent            *string           `gorm:"size:255" json:"user_agent"`
}
