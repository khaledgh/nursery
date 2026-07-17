package service

import (
	"context"

	"github.com/sunnystars/backend/internal/dto"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
	"github.com/sunnystars/backend/internal/repository"
)

type ClassroomService struct {
	classrooms *repository.ClassroomRepo
	users      *repository.UserRepo
	locales    *LocaleService
	audit      *AuditService
}

func NewClassroomService(classrooms *repository.ClassroomRepo, users *repository.UserRepo, locales *LocaleService, audit *AuditService) *ClassroomService {
	return &ClassroomService{classrooms: classrooms, users: users, locales: locales, audit: audit}
}

func (s *ClassroomService) List(ctx context.Context, q dto.PageQuery, locale string) ([]model.Classroom, int64, error) {
	rooms, total, err := s.classrooms.List(ctx, q)
	if err != nil {
		return nil, 0, apperr.Internal(err)
	}
	for i := range rooms {
		localizeClassroom(&rooms[i], locale)
	}
	return rooms, total, nil
}

func (s *ClassroomService) Get(ctx context.Context, id uint64, locale string) (*model.Classroom, error) {
	room, err := s.classrooms.ByID(ctx, id)
	if err != nil {
		return nil, apperr.NotFound("classroom not found")
	}
	localizeClassroom(room, locale)
	return room, nil
}

// localizeClassroom overlays the translation for the requested locale, if any.
func localizeClassroom(cr *model.Classroom, locale string) {
	for _, t := range cr.Translations {
		if t.Locale == locale && t.Name != "" {
			cr.Name = t.Name
			return
		}
	}
}

func (s *ClassroomService) Create(ctx context.Context, req *dto.CreateClassroomRequest, actorID uint64, ip string) (*model.Classroom, error) {
	translations, err := s.toTranslations(req.Translations)
	if err != nil {
		return nil, err
	}
	cr := &model.Classroom{
		Name:         req.Name,
		RoomLocation: req.RoomLocation,
		AgeGroup:     req.AgeGroup,
		Capacity:     req.Capacity,
		OpensAt:      req.OpensAt,
		ClosesAt:     req.ClosesAt,
		ImageID:      req.ImageID,
	}
	if err := s.classrooms.Save(ctx, cr, translations); err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, actorID, "create", "classroom", cr.ID, map[string]any{"name": cr.Name}, ip)
	return cr, nil
}

func (s *ClassroomService) Update(ctx context.Context, id uint64, req *dto.UpdateClassroomRequest, actorID uint64, ip string) (*model.Classroom, error) {
	cr, err := s.classrooms.ByID(ctx, id)
	if err != nil {
		return nil, apperr.NotFound("classroom not found")
	}
	if req.Name != nil {
		cr.Name = *req.Name
	}
	if req.RoomLocation != nil {
		cr.RoomLocation = *req.RoomLocation
	}
	if req.AgeGroup != nil {
		cr.AgeGroup = *req.AgeGroup
	}
	if req.Capacity != nil {
		cr.Capacity = *req.Capacity
	}
	if req.OpensAt != nil {
		cr.OpensAt = *req.OpensAt
	}
	if req.ClosesAt != nil {
		cr.ClosesAt = *req.ClosesAt
	}
	if req.ImageID != nil {
		cr.ImageID = req.ImageID
	}
	var translations []model.ClassroomTranslation
	if req.Translations != nil {
		translations, err = s.toTranslations(req.Translations)
		if err != nil {
			return nil, err
		}
	}
	cr.Translations = nil // replaced separately inside Save
	if err := s.classrooms.Save(ctx, cr, translations); err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, actorID, "update", "classroom", cr.ID, nil, ip)
	return cr, nil
}

func (s *ClassroomService) toTranslations(inputs []dto.ClassroomTranslationInput) ([]model.ClassroomTranslation, error) {
	if inputs == nil {
		return nil, nil
	}
	out := make([]model.ClassroomTranslation, 0, len(inputs))
	seen := map[string]bool{}
	for _, in := range inputs {
		if !s.locales.IsActive(in.Locale) {
			return nil, apperr.BadRequest("unknown or inactive locale: " + in.Locale)
		}
		if seen[in.Locale] {
			return nil, apperr.BadRequest("duplicate locale: " + in.Locale)
		}
		seen[in.Locale] = true
		out = append(out, model.ClassroomTranslation{Locale: in.Locale, Name: in.Name})
	}
	return out, nil
}

func (s *ClassroomService) Delete(ctx context.Context, id, actorID uint64, ip string) error {
	if _, err := s.classrooms.ByID(ctx, id); err != nil {
		return apperr.NotFound("classroom not found")
	}
	if err := s.classrooms.Delete(ctx, id); err != nil {
		return apperr.Internal(err)
	}
	s.audit.Record(ctx, actorID, "delete", "classroom", id, nil, ip)
	return nil
}

func (s *ClassroomService) AssignTeacher(ctx context.Context, classroomID uint64, req *dto.AssignTeacherRequest, actorID uint64, ip string) error {
	if _, err := s.classrooms.ByID(ctx, classroomID); err != nil {
		return apperr.NotFound("classroom not found")
	}
	teacher, err := s.users.ByID(ctx, req.TeacherUserID)
	if err != nil {
		return apperr.NotFound("teacher user not found")
	}
	if teacher.Role != model.RoleTeacher {
		return apperr.BadRequest("assignee must be a user with the teacher role")
	}
	already, err := s.classrooms.TeacherInClassroom(ctx, req.TeacherUserID, classroomID)
	if err != nil {
		return apperr.Internal(err)
	}
	if already {
		return apperr.Conflict("teacher is already assigned to this classroom")
	}
	ct := &model.ClassroomTeacher{
		ClassroomID:   classroomID,
		TeacherUserID: req.TeacherUserID,
		Role:          req.Role,
	}
	if err := s.classrooms.AssignTeacher(ctx, ct); err != nil {
		return apperr.Internal(err)
	}
	s.audit.Record(ctx, actorID, "create", "classroom_teacher", ct.ID,
		map[string]any{"classroom_id": classroomID, "teacher_user_id": req.TeacherUserID}, ip)
	return nil
}

func (s *ClassroomService) UnassignTeacher(ctx context.Context, classroomID, teacherUserID, actorID uint64, ip string) error {
	assigned, err := s.classrooms.TeacherInClassroom(ctx, teacherUserID, classroomID)
	if err != nil {
		return apperr.Internal(err)
	}
	if !assigned {
		return apperr.NotFound("assignment not found")
	}
	if err := s.classrooms.UnassignTeacher(ctx, classroomID, teacherUserID); err != nil {
		return apperr.Internal(err)
	}
	s.audit.Record(ctx, actorID, "delete", "classroom_teacher", 0,
		map[string]any{"classroom_id": classroomID, "teacher_user_id": teacherUserID}, ip)
	return nil
}
