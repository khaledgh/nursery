package dto

// AttendanceRequest is what a parent submits (absent / late / early pickup)
// or a teacher logs directly.
type AttendanceRequest struct {
	Date   string `json:"date" validate:"required,datetime=2006-01-02"`
	Status string `json:"status" validate:"required,oneof=present absent late early_pickup"`
	Note   string `json:"note" validate:"omitempty,max=500"`
}

type CheckInOutRequest struct {
	Action string `json:"action" validate:"required,oneof=check_in check_out"`
}

type ListAttendanceQuery struct {
	PageQuery
	From string `query:"from" validate:"omitempty,datetime=2006-01-02"`
	To   string `query:"to" validate:"omitempty,datetime=2006-01-02"`
}
