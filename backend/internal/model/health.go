package model

// Health sub-resources. Date-only fields are strings ("2006-01-02") backed by
// DATE columns so clients exchange plain dates. Each type implements
// SetChildID for the generic child-resource service; the child_id a client
// sends is always overwritten from the route.

type Allergy struct {
	Base
	ChildID  uint64 `gorm:"not null;index" json:"child_id"`
	Name     string `gorm:"size:191;not null" json:"name"`
	Severity string `gorm:"type:enum('mild','moderate','severe');not null;default:'mild'" json:"severity"`
}

func (m *Allergy) SetChildID(id uint64) { m.ChildID = id }

type IllnessLog struct {
	Base
	ChildID     uint64  `gorm:"not null;index" json:"child_id"`
	Title       string  `gorm:"size:191;not null" json:"title"`
	Status      string  `gorm:"type:enum('active','recovered','resolved');not null;default:'active'" json:"status"`
	Temperature float32 `json:"temperature"`
	Date        string  `gorm:"type:date" json:"date"`
	Note        string  `gorm:"size:1000" json:"note"`
}

func (m *IllnessLog) SetChildID(id uint64) { m.ChildID = id }

type Medication struct {
	Base
	ChildID   uint64 `gorm:"not null;index" json:"child_id"`
	Name      string `gorm:"size:191;not null" json:"name"`
	Dosage    string `gorm:"size:100" json:"dosage"`
	Schedule  string `gorm:"size:191" json:"schedule"`
	StartDate string `gorm:"type:date" json:"start_date"`
	EndDate   string `gorm:"type:date" json:"end_date"`
	Active    bool   `gorm:"not null;default:true" json:"active"`
}

func (m *Medication) SetChildID(id uint64) { m.ChildID = id }

type Immunization struct {
	Base
	ChildID     uint64 `gorm:"not null;index" json:"child_id"`
	Vaccine     string `gorm:"size:191;not null" json:"vaccine"`
	GivenDate   string `gorm:"type:date" json:"given_date"`
	NextDueDate string `gorm:"type:date" json:"next_due_date"`
	Status      string `gorm:"size:30" json:"status"`
}

func (m *Immunization) SetChildID(id uint64) { m.ChildID = id }

type Checkup struct {
	Base
	ChildID uint64 `gorm:"not null;index" json:"child_id"`
	Type    string `gorm:"size:100;not null" json:"type"`
	Date    string `gorm:"type:date" json:"date"`
	Outcome string `gorm:"size:500" json:"outcome"`
	Doctor  string `gorm:"size:191" json:"doctor"`
}

func (m *Checkup) SetChildID(id uint64) { m.ChildID = id }

type GrowthRecord struct {
	Base
	ChildID    uint64  `gorm:"not null;index" json:"child_id"`
	Date       string  `gorm:"type:date;not null" json:"date"`
	HeightCm   float32 `json:"height_cm"`
	WeightKg   float32 `json:"weight_kg"`
	HeadCircCm float32 `json:"head_circ_cm"`
}

func (m *GrowthRecord) SetChildID(id uint64) { m.ChildID = id }

type VitalLog struct {
	Base
	ChildID      uint64  `gorm:"not null;index" json:"child_id"`
	Date         string  `gorm:"type:date;not null" json:"date"`
	Temperature  float32 `json:"temperature"`
	Mood         string  `gorm:"size:30" json:"mood"`
	Energy       string  `gorm:"size:30" json:"energy"`
	Appetite     string  `gorm:"size:30" json:"appetite"`
	SleepSummary string  `gorm:"size:191" json:"sleep_summary"`
}

func (m *VitalLog) SetChildID(id uint64) { m.ChildID = id }

type EmergencyContact struct {
	Base
	ChildID  uint64 `gorm:"not null;index" json:"child_id"`
	Name     string `gorm:"size:191;not null" json:"name"`
	Relation string `gorm:"size:50" json:"relation"`
	Phone    string `gorm:"size:32;not null" json:"phone"`
	Priority int    `gorm:"not null;default:0" json:"priority"`
}

func (m *EmergencyContact) SetChildID(id uint64) { m.ChildID = id }

type InsuranceInfo struct {
	Base
	ChildID    uint64 `gorm:"not null;index" json:"child_id"`
	Provider   string `gorm:"size:191;not null" json:"provider"`
	PolicyNo   string `gorm:"size:100" json:"policy_no"`
	Status     string `gorm:"size:30" json:"status"`
	ValidUntil string `gorm:"type:date" json:"valid_until"`
}

func (m *InsuranceInfo) SetChildID(id uint64) { m.ChildID = id }

type MedicalDocument struct {
	Base
	ChildID uint64 `gorm:"not null;index" json:"child_id"`
	MediaID uint64 `gorm:"not null" json:"media_id"`
	Media   *Media `gorm:"foreignKey:MediaID" json:"media,omitempty"`
	Title   string `gorm:"size:191;not null" json:"title"`
	Kind    string `gorm:"size:50" json:"kind"`
}

func (m *MedicalDocument) SetChildID(id uint64) { m.ChildID = id }

type HealthNote struct {
	Base
	ChildID    uint64 `gorm:"not null;index" json:"child_id"`
	Title      string `gorm:"size:191;not null" json:"title"`
	Body       string `gorm:"size:2000" json:"body"`
	AuthoredBy uint64 `gorm:"not null" json:"authored_by"`
}

func (m *HealthNote) SetChildID(id uint64) { m.ChildID = id }
