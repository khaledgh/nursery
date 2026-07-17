package dto

type CreateChildRequest struct {
	FirstName   string  `json:"first_name" validate:"required,min=1,max=100"`
	LastName    string  `json:"last_name" validate:"required,min=1,max=100"`
	DOB         string  `json:"dob" validate:"required,datetime=2006-01-02"`
	Gender      string  `json:"gender" validate:"omitempty,max=20"`
	BloodType   string  `json:"blood_type" validate:"omitempty,max=5"`
	ClassroomID *uint64 `json:"classroom_id"`
	AvatarID    *uint64 `json:"avatar_id"`
}

type UpdateChildRequest struct {
	FirstName   *string `json:"first_name" validate:"omitempty,min=1,max=100"`
	LastName    *string `json:"last_name" validate:"omitempty,min=1,max=100"`
	DOB         *string `json:"dob" validate:"omitempty,datetime=2006-01-02"`
	Gender      *string `json:"gender" validate:"omitempty,max=20"`
	BloodType   *string `json:"blood_type" validate:"omitempty,max=5"`
	ClassroomID *uint64 `json:"classroom_id"`
	AvatarID    *uint64 `json:"avatar_id"`
	Status      *string `json:"status" validate:"omitempty,oneof=active inactive"`
}

type AddGuardianRequest struct {
	ParentUserID uint64 `json:"parent_user_id" validate:"required"`
	Relationship string `json:"relationship" validate:"required,oneof=mother father guardian grandparent other"`
	IsPrimary    bool   `json:"is_primary"`
	CanPickup    bool   `json:"can_pickup"`
}
