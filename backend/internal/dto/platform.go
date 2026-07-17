package dto

type UpsertLocaleRequest struct {
	Code       string `json:"code" validate:"required,min=2,max=10,lowercase"`
	Name       string `json:"name" validate:"required,min=1,max=100"`
	NativeName string `json:"native_name" validate:"required,min=1,max=100"`
	Direction  string `json:"direction" validate:"omitempty,oneof=ltr rtl"`
	IsActive   bool   `json:"is_active"`
	IsDefault  bool   `json:"is_default"`
	SortOrder  int    `json:"sort_order" validate:"min=0,max=1000"`
}

type UpsertUITranslationRequest struct {
	Locale    string `json:"locale" validate:"required,max=10"`
	Namespace string `json:"namespace" validate:"omitempty,max=50"`
	Key       string `json:"key" validate:"required,min=1,max=191"`
	Value     string `json:"value" validate:"required,max=5000"`
}

type UpsertContentTranslationRequest struct {
	EntityType string `json:"entity_type" validate:"required,max=50"`
	EntityID   uint64 `json:"entity_id" validate:"required"`
	Locale     string `json:"locale" validate:"required,max=10"`
	Field      string `json:"field" validate:"required,max=50"`
	Value      string `json:"value" validate:"required,max=10000"`
}
