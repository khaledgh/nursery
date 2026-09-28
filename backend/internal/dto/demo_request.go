package dto

// CreateDemoRequest is the public landing-site form.
type CreateDemoRequest struct {
	FullName             string `json:"full_name" validate:"required,min=2,max=120"`
	NurseryName          string `json:"nursery_name" validate:"required,min=2,max=160"`
	Email                string `json:"email" validate:"required,email,max=190"`
	Phone                string `json:"phone" validate:"required,min=6,max=40"`
	City                 string `json:"city" validate:"omitempty,max=100"`
	Country              string `json:"country" validate:"omitempty,max=100"`
	ChildrenRange        string `json:"children_range" validate:"omitempty,oneof=lt30 30_60 60_100 100_150 gt150"`
	PreferredContactTime string `json:"preferred_contact_time" validate:"omitempty,max=60"`
	Message              string `json:"message" validate:"omitempty,max=2000"`
	Locale               string `json:"locale" validate:"omitempty,oneof=en ar fr"`
	// Honeypot: hidden on the form, so only bots fill it.
	Website string `json:"website"`
}

type UpdateDemoRequest struct {
	Status     *string `json:"status" validate:"omitempty,oneof=new contacted scheduled converted rejected"`
	AdminNotes *string `json:"admin_notes" validate:"omitempty,max=4000"`
}
