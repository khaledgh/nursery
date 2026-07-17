package model

import "time"

type AttendanceStatus string

const (
	AttendancePresent     AttendanceStatus = "present"
	AttendanceAbsent      AttendanceStatus = "absent"
	AttendanceLate        AttendanceStatus = "late"
	AttendanceEarlyPickup AttendanceStatus = "early_pickup"
)

func (s AttendanceStatus) Valid() bool {
	switch s {
	case AttendancePresent, AttendanceAbsent, AttendanceLate, AttendanceEarlyPickup:
		return true
	}
	return false
}

type Attendance struct {
	Base
	ChildID       uint64           `gorm:"not null;index;uniqueIndex:ux_attendance_child_date" json:"child_id"`
	Child         *Child           `gorm:"foreignKey:ChildID" json:"child,omitempty"`
	Date          time.Time        `gorm:"type:date;not null;uniqueIndex:ux_attendance_child_date" json:"date"`
	Status        AttendanceStatus `gorm:"type:enum('present','absent','late','early_pickup');not null" json:"status"`
	CheckedInAt   *time.Time       `json:"checked_in_at"`
	CheckedOutAt  *time.Time       `json:"checked_out_at"`
	Note          string           `gorm:"size:500" json:"note"`
	RequestedBy   *uint64          `json:"requested_by"` // parent who requested absence/late/early pickup
	ConfirmedBy   *uint64          `json:"confirmed_by"` // teacher who confirmed
	ConfirmedAt   *time.Time       `json:"confirmed_at"`
}
