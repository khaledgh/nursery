package dto

// PresignUploadRequest declares what the client intends to upload so the
// server can validate and reserve a key before any bytes move.
type PresignUploadRequest struct {
	Mime string `json:"mime" validate:"required"`
	Size int64  `json:"size" validate:"required,gt=0"`
}
