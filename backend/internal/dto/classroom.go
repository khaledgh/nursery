package dto

type ClassroomTranslationInput struct {
	Locale string `json:"locale" validate:"required,max=10"`
	Name   string `json:"name" validate:"required,min=1,max=191"`
}

type CreateClassroomRequest struct {
	Name         string                      `json:"name" validate:"required,min=1,max=191"`
	RoomLocation string                      `json:"room_location" validate:"omitempty,max=191"`
	AgeGroup     string                      `json:"age_group" validate:"omitempty,max=50"`
	Capacity     int                         `json:"capacity" validate:"omitempty,min=0,max=500"`
	OpensAt      string                      `json:"opens_at" validate:"omitempty,datetime=15:04"`
	ClosesAt     string                      `json:"closes_at" validate:"omitempty,datetime=15:04"`
	ImageID      *uint64                     `json:"image_id"`
	Translations []ClassroomTranslationInput `json:"translations" validate:"omitempty,dive"`
}

type UpdateClassroomRequest struct {
	Name         *string                     `json:"name" validate:"omitempty,min=1,max=191"`
	RoomLocation *string                     `json:"room_location" validate:"omitempty,max=191"`
	AgeGroup     *string                     `json:"age_group" validate:"omitempty,max=50"`
	Capacity     *int                        `json:"capacity" validate:"omitempty,min=0,max=500"`
	OpensAt      *string                     `json:"opens_at" validate:"omitempty,datetime=15:04"`
	ClosesAt     *string                     `json:"closes_at" validate:"omitempty,datetime=15:04"`
	ImageID      *uint64                     `json:"image_id"`
	Translations []ClassroomTranslationInput `json:"translations" validate:"omitempty,dive"`
}

type AssignTeacherRequest struct {
	TeacherUserID uint64 `json:"teacher_user_id" validate:"required"`
	Role          string `json:"role" validate:"required,oneof=lead assistant"`
}
