package dto

type CreateUserRequest struct {
	Name     string `json:"name" validate:"required,min=2,max=191"`
	Email    string `json:"email" validate:"required,email,max=191"`
	Phone    string `json:"phone" validate:"omitempty,max=32"`
	Password string `json:"password" validate:"required,min=8,max=72"`
	Role     string `json:"role" validate:"required,oneof=admin teacher parent"`
	Locale   string `json:"locale" validate:"omitempty,max=10"`
}

type UpdateUserRequest struct {
	Name     *string `json:"name" validate:"omitempty,min=2,max=191"`
	Email    *string `json:"email" validate:"omitempty,email,max=191"`
	Phone    *string `json:"phone" validate:"omitempty,max=32"`
	Password *string `json:"password" validate:"omitempty,min=8,max=72"`
	Locale   *string `json:"locale" validate:"omitempty,max=10"`
	Status   *string `json:"status" validate:"omitempty,oneof=active inactive"`
	AvatarID *uint64 `json:"avatar_id"`
}

// UpdateMyAvatarRequest lets any signed-in user change their own photo.
type UpdateMyAvatarRequest struct {
	MediaID *uint64 `json:"media_id"`
}

type ListUsersQuery struct {
	PageQuery
	Role string `query:"role" validate:"omitempty,oneof=admin teacher parent"`
}
