package dto

type CreateEventRequest struct {
	Title        string   `json:"title" validate:"required,min=1,max=191"`
	Description  string   `json:"description" validate:"omitempty,max=2000"`
	Location     string   `json:"location" validate:"omitempty,max=255"`
	Lat          *float64 `json:"lat" validate:"omitempty,min=-90,max=90"`
	Lng          *float64 `json:"lng" validate:"omitempty,min=-180,max=180"`
	Audience     string   `json:"audience" validate:"omitempty,max=30"`
	StartsAt     string   `json:"starts_at" validate:"required,datetime=2006-01-02T15:04:05Z07:00"`
	EndsAt       string   `json:"ends_at" validate:"omitempty,datetime=2006-01-02T15:04:05Z07:00"`
	CoverMediaID *uint64  `json:"cover_media_id"`
}

type UpdateEventStatusRequest struct {
	Status string `json:"status" validate:"required,oneof=upcoming completed cancelled"`
}

type RSVPRequest struct {
	Response string  `json:"response" validate:"required,oneof=yes maybe no"`
	ChildID  *uint64 `json:"child_id"`
}

type EventFeedbackRequest struct {
	Loved   bool   `json:"loved"`
	Comment string `json:"comment" validate:"omitempty,max=1000"`
}

type AddEventMediaRequest struct {
	MediaID uint64  `json:"media_id" validate:"required"`
	Caption string  `json:"caption" validate:"omitempty,max=255"`
	ChildID *uint64 `json:"child_id"`
}

type CreateAnnouncementRequest struct {
	Title    string   `json:"title" validate:"required,min=1,max=191"`
	Body     string   `json:"body" validate:"required,min=1,max=5000"`
	Category string   `json:"category" validate:"omitempty,oneof=updates reminders events health general"`
	Badge    string   `json:"badge" validate:"omitempty,max=30"`
	MediaIDs []uint64 `json:"media_ids" validate:"omitempty,max=10"`
	Publish  bool     `json:"publish"`
}

type CreateCommunityPostRequest struct {
	Type     string   `json:"type" validate:"omitempty,oneof=moment activity"`
	Body     string   `json:"body" validate:"required,min=1,max=5000"`
	ChildID  *uint64  `json:"child_id"`
	MediaIDs []uint64 `json:"media_ids" validate:"omitempty,max=10"`
	// Optional meetup attached to the post.
	Meetup *CreateMeetupInput `json:"meetup" validate:"omitempty"`
}

type CreateMeetupInput struct {
	Title    string   `json:"title" validate:"required,min=1,max=191"`
	Location string   `json:"location" validate:"omitempty,max=255"`
	Lat      *float64 `json:"lat" validate:"omitempty,min=-90,max=90"`
	Lng      *float64 `json:"lng" validate:"omitempty,min=-180,max=180"`
	StartsAt string   `json:"starts_at" validate:"required,datetime=2006-01-02T15:04:05Z07:00"`
}

type CreateCommentRequest struct {
	Body string `json:"body" validate:"required,min=1,max=2000"`
}

type MeetupRSVPRequest struct {
	Response string `json:"response" validate:"required,oneof=going interested"`
}

type CreateReminderRequest struct {
	Scope        string   `json:"scope" validate:"required,oneof=global classroom child"`
	ScopeID      *uint64  `json:"scope_id" validate:"required_unless=Scope global"`
	Title        string   `json:"title" validate:"required,min=1,max=191"`
	Description  string   `json:"description" validate:"omitempty,max=1000"`
	Date         string   `json:"date" validate:"omitempty,datetime=2006-01-02"`
	Items        []string `json:"items" validate:"omitempty,max=20,dive,max=191"`
	Kind         string   `json:"kind" validate:"omitempty,oneof=upcoming general"`
	WeatherAlert bool     `json:"weather_alert"`
	Icon         string   `json:"icon" validate:"omitempty,max=50"`
}

type RegisterDeviceRequest struct {
	OneSignalPlayerID string `json:"onesignal_player_id" validate:"required,max=191"`
	Platform          string `json:"platform" validate:"required,oneof=ios android web"`
	Locale            string `json:"locale" validate:"omitempty,max=10"`
}
