package model

import (
	"time"

	"gorm.io/datatypes"
)

type Event struct {
	Base
	Title        string      `gorm:"size:191;not null" json:"title"`
	Description  string      `gorm:"size:2000" json:"description"`
	Location     string      `gorm:"size:255" json:"location"`
	Lat          *float64    `json:"lat"`
	Lng          *float64    `json:"lng"`
	Audience     string      `gorm:"size:30;not null;default:'all'" json:"audience"` // all | parents | classroom:<id>
	StartsAt     time.Time   `gorm:"not null;index" json:"starts_at"`
	EndsAt       *time.Time  `json:"ends_at"`
	CoverMediaID *uint64     `json:"cover_media_id"`
	CoverMedia   *Media      `gorm:"foreignKey:CoverMediaID" json:"cover_media,omitempty"`
	Status       string      `gorm:"type:enum('upcoming','completed','cancelled');not null;default:'upcoming'" json:"status"`
	CreatedBy    uint64      `gorm:"not null" json:"created_by"`
	RSVPs        []EventRSVP `json:"rsvps,omitempty"`
}

type EventRSVP struct {
	Base
	EventID  uint64  `gorm:"not null;uniqueIndex:ux_rsvp_event_user" json:"event_id"`
	UserID   uint64  `gorm:"not null;uniqueIndex:ux_rsvp_event_user" json:"user_id"`
	ChildID  *uint64 `json:"child_id"`
	Response string  `gorm:"type:enum('yes','maybe','no');not null" json:"response"`
}

type EventMedia struct {
	Base
	EventID    uint64  `gorm:"not null;index" json:"event_id"`
	MediaID    uint64  `gorm:"not null" json:"media_id"`
	Media      *Media  `gorm:"foreignKey:MediaID" json:"media,omitempty"`
	Caption    string  `gorm:"size:255" json:"caption"`
	ChildID    *uint64 `json:"child_id"`
	UploadedBy uint64  `gorm:"not null" json:"uploaded_by"`
}

type EventFeedback struct {
	Base
	EventID uint64 `gorm:"not null;uniqueIndex:ux_feedback_event_user" json:"event_id"`
	UserID  uint64 `gorm:"not null;uniqueIndex:ux_feedback_event_user" json:"user_id"`
	Loved   bool   `gorm:"not null;default:true" json:"loved"`
	Comment string `gorm:"size:1000" json:"comment"`
}

type Announcement struct {
	Base
	Title       string                   `gorm:"size:191;not null" json:"title"`
	Body        string                   `gorm:"size:5000;not null" json:"body"`
	Category    string                   `gorm:"type:enum('updates','reminders','events','health','general');not null;default:'general'" json:"category"`
	Badge       string                   `gorm:"size:30" json:"badge"`
	PublishedAt *time.Time               `gorm:"index" json:"published_at"`
	CreatedBy   uint64                   `gorm:"not null" json:"created_by"`
	Attachments []AnnouncementAttachment `json:"attachments,omitempty"`
	Reads       []AnnouncementRead       `json:"-"`
}

type AnnouncementAttachment struct {
	ID             uint64 `gorm:"primaryKey" json:"-"`
	AnnouncementID uint64 `gorm:"not null;index" json:"-"`
	MediaID        uint64 `gorm:"not null" json:"media_id"`
	Media          *Media `gorm:"foreignKey:MediaID" json:"media,omitempty"`
}

type AnnouncementRead struct {
	ID             uint64     `gorm:"primaryKey" json:"-"`
	AnnouncementID uint64     `gorm:"not null;uniqueIndex:ux_read_ann_user" json:"announcement_id"`
	UserID         uint64     `gorm:"not null;uniqueIndex:ux_read_ann_user" json:"user_id"`
	ReadAt         *time.Time `json:"read_at"`
	AcknowledgedAt *time.Time `json:"acknowledged_at"`
	ArchivedAt     *time.Time `json:"archived_at"`
}

type CommunityPost struct {
	Base
	AuthorUserID uint64               `gorm:"not null;index" json:"author_user_id"`
	Author       *User                `gorm:"foreignKey:AuthorUserID" json:"author,omitempty"`
	Type         string               `gorm:"type:enum('moment','activity');not null;default:'moment'" json:"type"`
	Body         string               `gorm:"size:5000;not null" json:"body"`
	ChildID      *uint64              `json:"child_id"`
	Media        []CommunityPostMedia `gorm:"foreignKey:PostID" json:"media,omitempty"`
	Comments     []CommunityComment   `gorm:"foreignKey:PostID" json:"comments,omitempty"`
	Likes        []CommunityLike      `gorm:"foreignKey:PostID" json:"likes,omitempty"`
	Meetup       *Meetup              `gorm:"foreignKey:PostID" json:"meetup,omitempty"`
}

type CommunityPostMedia struct {
	ID      uint64 `gorm:"primaryKey" json:"-"`
	PostID  uint64 `gorm:"not null;index" json:"-"`
	MediaID uint64 `gorm:"not null" json:"media_id"`
	Media   *Media `gorm:"foreignKey:MediaID" json:"media,omitempty"`
	Sort    int    `gorm:"not null;default:0" json:"sort"`
}

type CommunityComment struct {
	Base
	PostID       uint64 `gorm:"not null;index" json:"post_id"`
	AuthorUserID uint64 `gorm:"not null" json:"author_user_id"`
	Author       *User  `gorm:"foreignKey:AuthorUserID" json:"author,omitempty"`
	Body         string `gorm:"size:2000;not null" json:"body"`
}

type CommunityLike struct {
	ID     uint64 `gorm:"primaryKey" json:"-"`
	PostID uint64 `gorm:"not null;uniqueIndex:ux_like_post_user" json:"post_id"`
	UserID uint64 `gorm:"not null;uniqueIndex:ux_like_post_user" json:"user_id"`
}

type Meetup struct {
	Base
	PostID   uint64       `gorm:"not null;uniqueIndex" json:"post_id"`
	Title    string       `gorm:"size:191;not null" json:"title"`
	Location string       `gorm:"size:255" json:"location"`
	Lat      *float64     `json:"lat"`
	Lng      *float64     `json:"lng"`
	StartsAt time.Time    `gorm:"not null" json:"starts_at"`
	RSVPs    []MeetupRSVP `json:"rsvps,omitempty"`
}

type MeetupRSVP struct {
	Base
	MeetupID uint64 `gorm:"not null;uniqueIndex:ux_rsvp_meetup_user" json:"meetup_id"`
	UserID   uint64 `gorm:"not null;uniqueIndex:ux_rsvp_meetup_user" json:"user_id"`
	Response string `gorm:"type:enum('going','interested');not null" json:"response"`
}

type Reminder struct {
	Base
	Scope        string         `gorm:"type:enum('global','classroom','child');not null;default:'global'" json:"scope"`
	ScopeID      *uint64        `json:"scope_id"` // classroom_id or child_id depending on scope
	Title        string         `gorm:"size:191;not null" json:"title"`
	Description  string         `gorm:"size:1000" json:"description"`
	Date         string         `gorm:"type:date" json:"date"`
	ItemsJSON    datatypes.JSON `json:"items"`
	Kind         string         `gorm:"type:enum('upcoming','general');not null;default:'general'" json:"kind"`
	WeatherAlert bool           `gorm:"not null;default:false" json:"weather_alert"`
	Icon         string         `gorm:"size:50" json:"icon"`
	CreatedBy    uint64         `gorm:"not null" json:"created_by"`
	// Set once the reminder has been announced, whether at creation (same-day)
	// or by the morning cron. Keeps a cron re-run from notifying twice.
	NotifiedAt *time.Time `json:"notified_at"`
}
