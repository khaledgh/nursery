package model

import "time"

type PresentStatus string

const (
	PresentIn  PresentStatus = "checked_in"
	PresentOut PresentStatus = "checked_out"
	PresentAbs PresentStatus = "absent"
)

type Child struct {
	Base
	FirstName     string        `gorm:"size:100;not null" json:"first_name"`
	LastName      string        `gorm:"size:100;not null" json:"last_name"`
	DOB           time.Time     `gorm:"type:date;not null" json:"dob"`
	Gender        string        `gorm:"size:20" json:"gender"`
	BloodType     string        `gorm:"size:5" json:"blood_type"`
	AvatarID      *uint64       `json:"avatar_id"`
	Avatar        *Media        `gorm:"foreignKey:AvatarID" json:"avatar,omitempty"`
	ClassroomID   *uint64       `gorm:"index" json:"classroom_id"`
	Classroom     *Classroom    `gorm:"foreignKey:ClassroomID" json:"classroom,omitempty"`
	Status        string        `gorm:"size:20;not null;default:'active'" json:"status"`
	PresentStatus PresentStatus `gorm:"type:enum('checked_in','checked_out','absent');not null;default:'checked_out'" json:"present_status"`
	CheckedInAt   *time.Time    `json:"checked_in_at"`
	Guardians     []Guardian    `json:"guardians,omitempty"`
}

type GuardianRelationship string

type Guardian struct {
	Base
	ParentUserID uint64 `gorm:"not null;index;uniqueIndex:ux_guardian_parent_child" json:"parent_user_id"`
	Parent       *User  `gorm:"foreignKey:ParentUserID" json:"parent,omitempty"`
	ChildID      uint64 `gorm:"not null;index;uniqueIndex:ux_guardian_parent_child" json:"child_id"`
	Child        *Child `gorm:"foreignKey:ChildID" json:"-"`
	Relationship string `gorm:"size:30;not null" json:"relationship"` // mother | father | guardian | ...
	IsPrimary    bool   `gorm:"not null;default:false" json:"is_primary"`
	CanPickup    bool   `gorm:"not null;default:true" json:"can_pickup"`
}

type Classroom struct {
	Base
	Name         string                 `gorm:"size:191;not null" json:"name"` // default-locale name; translations override
	RoomLocation string                 `gorm:"size:191" json:"room_location"`
	AgeGroup     string                 `gorm:"size:50" json:"age_group"`
	Capacity     int                    `gorm:"not null;default:0" json:"capacity"`
	OpensAt      string                 `gorm:"size:8" json:"opens_at"`  // "07:30"
	ClosesAt     string                 `gorm:"size:8" json:"closes_at"` // "17:30"
	ImageID      *uint64                `json:"image_id"`
	Image        *Media                 `gorm:"foreignKey:ImageID" json:"image,omitempty"`
	Translations []ClassroomTranslation `json:"-"`
	Teachers     []ClassroomTeacher     `json:"teachers,omitempty"`
}

type ClassroomTranslation struct {
	ID          uint64 `gorm:"primaryKey" json:"-"`
	ClassroomID uint64 `gorm:"not null;uniqueIndex:ux_classroom_locale" json:"-"`
	Locale      string `gorm:"size:10;not null;uniqueIndex:ux_classroom_locale" json:"locale"`
	Name        string `gorm:"size:191;not null" json:"name"`
}

type ClassroomTeacher struct {
	Base
	ClassroomID   uint64 `gorm:"not null;index;uniqueIndex:ux_classroom_teacher" json:"classroom_id"`
	TeacherUserID uint64 `gorm:"not null;index;uniqueIndex:ux_classroom_teacher" json:"teacher_user_id"`
	Teacher       *User  `gorm:"foreignKey:TeacherUserID" json:"teacher,omitempty"`
	Role          string `gorm:"type:enum('lead','assistant');not null;default:'assistant'" json:"role"`
}
