package service

import (
	"context"
	"encoding/json"
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/sunnystars/backend/internal/dto"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
	"github.com/sunnystars/backend/internal/repository"
)

type EngagementService struct {
	db           *gorm.DB
	children     *repository.ChildRepo
	childSvc     *ChildService
	notifier     Notifier
	audit        *AuditService
	translations *TranslationService
}

func NewEngagementService(db *gorm.DB, children *repository.ChildRepo, childSvc *ChildService, notifier Notifier, audit *AuditService, translations *TranslationService) *EngagementService {
	return &EngagementService{db: db, children: children, childSvc: childSvc, notifier: notifier, audit: audit, translations: translations}
}

// localizeEvents overlays content translations for the requested locale.
func (s *EngagementService) localizeEvents(ctx context.Context, events []model.Event, locale string) {
	if locale == "" || len(events) == 0 {
		return
	}
	ids := make([]uint64, len(events))
	for i := range events {
		ids[i] = events[i].ID
	}
	tr := s.translations.FetchMap(ctx, "event", ids, locale)
	for i := range events {
		if m, ok := tr[events[i].ID]; ok {
			if v := m["title"]; v != "" {
				events[i].Title = v
			}
			if v := m["description"]; v != "" {
				events[i].Description = v
			}
			if v := m["location"]; v != "" {
				events[i].Location = v
			}
		}
	}
}

func (s *EngagementService) localizeAnnouncements(ctx context.Context, anns []model.Announcement, locale string) {
	if locale == "" || len(anns) == 0 {
		return
	}
	ids := make([]uint64, len(anns))
	for i := range anns {
		ids[i] = anns[i].ID
	}
	tr := s.translations.FetchMap(ctx, "announcement", ids, locale)
	for i := range anns {
		if m, ok := tr[anns[i].ID]; ok {
			if v := m["title"]; v != "" {
				anns[i].Title = v
			}
			if v := m["body"]; v != "" {
				anns[i].Body = v
			}
		}
	}
}

// ---------- events ----------

func (s *EngagementService) ListEvents(ctx context.Context, locale, tab string, q dto.PageQuery) ([]model.Event, int64, error) {
	var (
		events []model.Event
		total  int64
	)
	tx := s.db.WithContext(ctx).Model(&model.Event{})
	now := time.Now()
	switch tab {
	case "previous":
		tx = tx.Where("starts_at < ? OR status = 'completed'", now).Order("starts_at DESC")
	default: // upcoming
		tx = tx.Where("starts_at >= ? AND status = 'upcoming'", now).Order("starts_at ASC")
	}
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, apperr.Internal(err)
	}
	if err := tx.Limit(q.PerPage).Offset(q.Offset()).Preload("CoverMedia").Find(&events).Error; err != nil {
		return nil, 0, apperr.Internal(err)
	}
	s.localizeEvents(ctx, events, locale)
	return events, total, nil
}

// GetEvent with locale="" returns the source-language event (internal use).
func (s *EngagementService) GetEvent(ctx context.Context, id uint64) (*model.Event, error) {
	var ev model.Event
	if err := s.db.WithContext(ctx).Preload("CoverMedia").Preload("RSVPs").First(&ev, id).Error; err != nil {
		return nil, apperr.NotFound("event not found")
	}
	return &ev, nil
}

func (s *EngagementService) GetEventLocalized(ctx context.Context, id uint64, locale string) (*model.Event, error) {
	ev, err := s.GetEvent(ctx, id)
	if err != nil {
		return nil, err
	}
	events := []model.Event{*ev}
	s.localizeEvents(ctx, events, locale)
	return &events[0], nil
}

// GetEventForUser bundles the event with the caller's own RSVP and feedback
// so clients can render persisted state ("you said you loved it").
func (s *EngagementService) GetEventForUser(ctx context.Context, id uint64, locale string, userID uint64) (map[string]any, error) {
	ev, err := s.GetEventLocalized(ctx, id, locale)
	if err != nil {
		return nil, err
	}
	out := map[string]any{"event": ev, "my_rsvp": nil, "my_feedback": nil}
	var rsvp model.EventRSVP
	if err := s.db.WithContext(ctx).Where("event_id = ? AND user_id = ?", id, userID).First(&rsvp).Error; err == nil {
		out["my_rsvp"] = rsvp
	}
	var fb model.EventFeedback
	if err := s.db.WithContext(ctx).Where("event_id = ? AND user_id = ?", id, userID).First(&fb).Error; err == nil {
		out["my_feedback"] = fb
	}
	return out, nil
}

func (s *EngagementService) CreateEvent(ctx context.Context, req *dto.CreateEventRequest, actorID uint64, ip string) (*model.Event, error) {
	starts, err := time.Parse(time.RFC3339, req.StartsAt)
	if err != nil {
		return nil, apperr.BadRequest("invalid starts_at")
	}
	ev := &model.Event{
		Title:        req.Title,
		Description:  req.Description,
		Location:     req.Location,
		Lat:          req.Lat,
		Lng:          req.Lng,
		Audience:     defaultStr(req.Audience, "all"),
		StartsAt:     starts,
		CoverMediaID: req.CoverMediaID,
		Status:       "upcoming",
		CreatedBy:    actorID,
	}
	if req.EndsAt != "" {
		ends, err := time.Parse(time.RFC3339, req.EndsAt)
		if err != nil || !ends.After(starts) {
			return nil, apperr.BadRequest("ends_at must be a valid time after starts_at")
		}
		ev.EndsAt = &ends
	}
	if err := s.db.WithContext(ctx).Create(ev).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, actorID, "create", "event", ev.ID, map[string]any{"title": ev.Title}, ip)
	s.notifier.NotifyRole(ctx, string(model.RoleParent), "events", "New event 📅", ev.Title,
		map[string]any{"screen": "events", "event_id": ev.ID})
	return ev, nil
}

func (s *EngagementService) UpdateEventStatus(ctx context.Context, id uint64, status string, actorID uint64, ip string) (*model.Event, error) {
	ev, err := s.GetEvent(ctx, id)
	if err != nil {
		return nil, err
	}
	ev.Status = status
	if err := s.db.WithContext(ctx).Save(ev).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, actorID, "update", "event", ev.ID, map[string]any{"status": status}, ip)
	return ev, nil
}

func (s *EngagementService) RSVP(ctx context.Context, role model.Role, userID, eventID uint64, req *dto.RSVPRequest) (*model.EventRSVP, error) {
	if _, err := s.GetEvent(ctx, eventID); err != nil {
		return nil, err
	}
	if req.ChildID != nil {
		if err := s.childSvc.Authorize(ctx, role, userID, *req.ChildID); err != nil {
			return nil, err
		}
	}
	rsvp := &model.EventRSVP{EventID: eventID, UserID: userID, ChildID: req.ChildID, Response: req.Response}
	err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "event_id"}, {Name: "user_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"response", "child_id", "updated_at"}),
	}).Create(rsvp).Error
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return rsvp, nil
}

func (s *EngagementService) EventFeedback(ctx context.Context, userID, eventID uint64, req *dto.EventFeedbackRequest) (*model.EventFeedback, error) {
	if _, err := s.GetEvent(ctx, eventID); err != nil {
		return nil, err
	}
	fb := &model.EventFeedback{EventID: eventID, UserID: userID, Loved: req.Loved, Comment: req.Comment}
	err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "event_id"}, {Name: "user_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"loved", "comment", "updated_at"}),
	}).Create(fb).Error
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return fb, nil
}

func (s *EngagementService) ListEventMedia(ctx context.Context, eventID uint64) ([]model.EventMedia, error) {
	if _, err := s.GetEvent(ctx, eventID); err != nil {
		return nil, err
	}
	var media []model.EventMedia
	if err := s.db.WithContext(ctx).Where("event_id = ?", eventID).Preload("Media").Find(&media).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	return media, nil
}

func (s *EngagementService) AddEventMedia(ctx context.Context, eventID, actorID uint64, req *dto.AddEventMediaRequest, ip string) (*model.EventMedia, error) {
	if _, err := s.GetEvent(ctx, eventID); err != nil {
		return nil, err
	}
	em := &model.EventMedia{EventID: eventID, MediaID: req.MediaID, Caption: req.Caption, ChildID: req.ChildID, UploadedBy: actorID}
	if err := s.db.WithContext(ctx).Create(em).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, actorID, "create", "event_media", em.ID, map[string]any{"event_id": eventID}, ip)
	return em, nil
}

// ---------- announcements ----------

// ListAnnouncements returns published announcements with the caller's read
// state; tab=unread filters out the ones already read.
func (s *EngagementService) ListAnnouncements(ctx context.Context, userID uint64, locale, tab string, q dto.PageQuery) ([]map[string]any, int64, error) {
	var (
		anns  []model.Announcement
		total int64
	)
	tx := s.db.WithContext(ctx).Model(&model.Announcement{}).Where("published_at IS NOT NULL")
	archivedIDs := s.db.Model(&model.AnnouncementRead{}).
		Select("announcement_id").Where("user_id = ? AND archived_at IS NOT NULL", userID)
	switch tab {
	case "unread":
		tx = tx.Where("id NOT IN (?)", s.db.Model(&model.AnnouncementRead{}).
			Select("announcement_id").Where("user_id = ? AND read_at IS NOT NULL", userID)).
			Where("id NOT IN (?)", archivedIDs)
	case "archived":
		tx = tx.Where("id IN (?)", archivedIDs)
	default: // all — archived items live only under their own tab
		tx = tx.Where("id NOT IN (?)", archivedIDs)
	}
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, apperr.Internal(err)
	}
	if err := tx.Order("published_at DESC").Limit(q.PerPage).Offset(q.Offset()).
		Preload("Attachments").Preload("Attachments.Media").
		Find(&anns).Error; err != nil {
		return nil, 0, apperr.Internal(err)
	}

	s.localizeAnnouncements(ctx, anns, locale)

	ids := make([]uint64, len(anns))
	for i, a := range anns {
		ids[i] = a.ID
	}
	reads := map[uint64]model.AnnouncementRead{}
	if len(ids) > 0 {
		var rows []model.AnnouncementRead
		if err := s.db.WithContext(ctx).
			Where("user_id = ? AND announcement_id IN ?", userID, ids).
			Find(&rows).Error; err != nil {
			return nil, 0, apperr.Internal(err)
		}
		for _, r := range rows {
			reads[r.AnnouncementID] = r
		}
	}
	out := make([]map[string]any, len(anns))
	for i, a := range anns {
		r := reads[a.ID]
		out[i] = map[string]any{
			"announcement":    a,
			"read_at":         r.ReadAt,
			"acknowledged_at": r.AcknowledgedAt,
			"archived_at":     r.ArchivedAt,
		}
	}
	return out, total, nil
}

// GetAnnouncement returns one announcement (localized) and marks it read.
func (s *EngagementService) GetAnnouncement(ctx context.Context, userID, id uint64, locale string) (*model.Announcement, error) {
	var ann model.Announcement
	if err := s.db.WithContext(ctx).Where("published_at IS NOT NULL").
		Preload("Attachments").Preload("Attachments.Media").
		First(&ann, id).Error; err != nil {
		return nil, apperr.NotFound("announcement not found")
	}
	anns := []model.Announcement{ann}
	s.localizeAnnouncements(ctx, anns, locale)
	ann = anns[0]
	now := time.Now()
	read := &model.AnnouncementRead{AnnouncementID: id, UserID: userID, ReadAt: &now}
	_ = s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "announcement_id"}, {Name: "user_id"}},
		DoUpdates: clause.Assignments(map[string]any{"read_at": gorm.Expr("COALESCE(read_at, ?)", now)}),
	}).Create(read).Error
	return &ann, nil
}

// Acknowledge records the explicit "Got it" tap.
func (s *EngagementService) Acknowledge(ctx context.Context, userID, id uint64) error {
	var ann model.Announcement
	if err := s.db.WithContext(ctx).Where("published_at IS NOT NULL").First(&ann, id).Error; err != nil {
		return apperr.NotFound("announcement not found")
	}
	now := time.Now()
	read := &model.AnnouncementRead{AnnouncementID: id, UserID: userID, ReadAt: &now, AcknowledgedAt: &now}
	err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "announcement_id"}, {Name: "user_id"}},
		DoUpdates: clause.Assignments(map[string]any{
			"read_at":         gorm.Expr("COALESCE(read_at, ?)", now),
			"acknowledged_at": now,
		}),
	}).Create(read).Error
	if err != nil {
		return apperr.Internal(err)
	}
	return nil
}

// SetArchived moves the announcement in or out of the caller's archive.
func (s *EngagementService) SetArchived(ctx context.Context, userID, id uint64, archived bool) error {
	var ann model.Announcement
	if err := s.db.WithContext(ctx).Where("published_at IS NOT NULL").First(&ann, id).Error; err != nil {
		return apperr.NotFound("announcement not found")
	}
	now := time.Now()
	var archivedAt *time.Time
	if archived {
		archivedAt = &now
	}
	read := &model.AnnouncementRead{AnnouncementID: id, UserID: userID, ReadAt: &now, ArchivedAt: archivedAt}
	err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "announcement_id"}, {Name: "user_id"}},
		DoUpdates: clause.Assignments(map[string]any{
			"read_at":     gorm.Expr("COALESCE(read_at, ?)", now),
			"archived_at": archivedAt,
		}),
	}).Create(read).Error
	if err != nil {
		return apperr.Internal(err)
	}
	return nil
}

func (s *EngagementService) CreateAnnouncement(ctx context.Context, req *dto.CreateAnnouncementRequest, actorID uint64, ip string) (*model.Announcement, error) {
	ann := &model.Announcement{
		Title:     req.Title,
		Body:      req.Body,
		Category:  defaultStr(req.Category, "general"),
		Badge:     req.Badge,
		CreatedBy: actorID,
	}
	if req.Publish {
		now := time.Now()
		ann.PublishedAt = &now
	}
	for _, mid := range req.MediaIDs {
		ann.Attachments = append(ann.Attachments, model.AnnouncementAttachment{MediaID: mid})
	}
	if err := s.db.WithContext(ctx).Create(ann).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, actorID, "create", "announcement", ann.ID, map[string]any{"title": ann.Title}, ip)
	if ann.PublishedAt != nil {
		s.notifier.NotifyRole(ctx, "", ann.Category, ann.Title, truncate(ann.Body, 120),
			map[string]any{"screen": "announcements", "announcement_id": ann.ID})
	}
	return ann, nil
}

// ---------- community ----------

func (s *EngagementService) ListPosts(ctx context.Context, q dto.PageQuery) ([]model.CommunityPost, int64, error) {
	var (
		posts []model.CommunityPost
		total int64
	)
	tx := s.db.WithContext(ctx).Model(&model.CommunityPost{})
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, apperr.Internal(err)
	}
	err := tx.Order("created_at DESC").Limit(q.PerPage).Offset(q.Offset()).
		Preload("Author").Preload("Media").Preload("Media.Media").
		Preload("Comments").Preload("Comments.Author").
		Preload("Likes").Preload("Meetup").Preload("Meetup.RSVPs").
		Find(&posts).Error
	if err != nil {
		return nil, 0, apperr.Internal(err)
	}
	return posts, total, nil
}

func (s *EngagementService) CreatePost(ctx context.Context, role model.Role, userID uint64, req *dto.CreateCommunityPostRequest, ip string) (*model.CommunityPost, error) {
	if req.ChildID != nil {
		if err := s.childSvc.Authorize(ctx, role, userID, *req.ChildID); err != nil {
			return nil, err
		}
	}
	post := &model.CommunityPost{
		AuthorUserID: userID,
		Type:         defaultStr(req.Type, "moment"),
		Body:         req.Body,
		ChildID:      req.ChildID,
	}
	for i, mid := range req.MediaIDs {
		post.Media = append(post.Media, model.CommunityPostMedia{MediaID: mid, Sort: i})
	}
	txErr := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(post).Error; err != nil {
			return err
		}
		if req.Meetup != nil {
			starts, err := time.Parse(time.RFC3339, req.Meetup.StartsAt)
			if err != nil {
				return apperr.BadRequest("invalid meetup starts_at")
			}
			return tx.Create(&model.Meetup{
				PostID: post.ID, Title: req.Meetup.Title, Location: req.Meetup.Location,
				Lat: req.Meetup.Lat, Lng: req.Meetup.Lng, StartsAt: starts,
			}).Error
		}
		return nil
	})
	if txErr != nil {
		return nil, apperr.From(txErr)
	}
	s.audit.Record(ctx, userID, "create", "community_post", post.ID, nil, ip)
	return post, nil
}

// DeletePost: author removes their own; teachers/admins moderate anything.
func (s *EngagementService) DeletePost(ctx context.Context, role model.Role, userID, postID uint64, ip string) error {
	var post model.CommunityPost
	if err := s.db.WithContext(ctx).First(&post, postID).Error; err != nil {
		return apperr.NotFound("post not found")
	}
	if post.AuthorUserID != userID && role == model.RoleParent {
		return apperr.Forbidden("you can only delete your own posts")
	}
	if err := s.db.WithContext(ctx).Delete(&post).Error; err != nil {
		return apperr.Internal(err)
	}
	s.audit.Record(ctx, userID, "delete", "community_post", postID, nil, ip)
	return nil
}

func (s *EngagementService) Comment(ctx context.Context, userID, postID uint64, body string) (*model.CommunityComment, error) {
	var post model.CommunityPost
	if err := s.db.WithContext(ctx).First(&post, postID).Error; err != nil {
		return nil, apperr.NotFound("post not found")
	}
	comment := &model.CommunityComment{PostID: postID, AuthorUserID: userID, Body: body}
	if err := s.db.WithContext(ctx).Create(comment).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	if post.AuthorUserID != userID {
		s.notifier.NotifyUser(ctx, post.AuthorUserID, "messages", "New reply 💬", truncate(body, 120),
			map[string]any{"screen": "community", "post_id": postID})
	}
	return comment, nil
}

func (s *EngagementService) DeleteComment(ctx context.Context, role model.Role, userID, commentID uint64, ip string) error {
	var comment model.CommunityComment
	if err := s.db.WithContext(ctx).First(&comment, commentID).Error; err != nil {
		return apperr.NotFound("comment not found")
	}
	if comment.AuthorUserID != userID && role == model.RoleParent {
		return apperr.Forbidden("you can only delete your own comments")
	}
	if err := s.db.WithContext(ctx).Delete(&comment).Error; err != nil {
		return apperr.Internal(err)
	}
	s.audit.Record(ctx, userID, "delete", "community_comment", commentID, nil, ip)
	return nil
}

// ToggleLike likes the post, or unlikes if already liked. Returns liked state.
func (s *EngagementService) ToggleLike(ctx context.Context, userID, postID uint64) (bool, error) {
	var post model.CommunityPost
	if err := s.db.WithContext(ctx).First(&post, postID).Error; err != nil {
		return false, apperr.NotFound("post not found")
	}
	res := s.db.WithContext(ctx).Where("post_id = ? AND user_id = ?", postID, userID).Delete(&model.CommunityLike{})
	if res.Error != nil {
		return false, apperr.Internal(res.Error)
	}
	if res.RowsAffected > 0 {
		return false, nil // was liked → now unliked
	}
	if err := s.db.WithContext(ctx).Create(&model.CommunityLike{PostID: postID, UserID: userID}).Error; err != nil {
		return false, apperr.Internal(err)
	}
	return true, nil
}

func (s *EngagementService) MeetupRSVP(ctx context.Context, userID, meetupID uint64, response string) (*model.MeetupRSVP, error) {
	var meetup model.Meetup
	if err := s.db.WithContext(ctx).First(&meetup, meetupID).Error; err != nil {
		return nil, apperr.NotFound("meetup not found")
	}
	rsvp := &model.MeetupRSVP{MeetupID: meetupID, UserID: userID, Response: response}
	err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "meetup_id"}, {Name: "user_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"response", "updated_at"}),
	}).Create(rsvp).Error
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return rsvp, nil
}

// ---------- reminders ----------

// ListReminders resolves what applies to the caller: global ones, plus
// classroom-scoped for classrooms they belong to (via children for parents,
// assignments for teachers), plus child-scoped for their children.
func (s *EngagementService) ListReminders(ctx context.Context, role model.Role, userID uint64, locale string) ([]model.Reminder, error) {
	var reminders []model.Reminder
	tx := s.db.WithContext(ctx).Order("date IS NULL, date ASC")

	if role == model.RoleAdmin {
		if err := tx.Find(&reminders).Error; err != nil {
			return nil, apperr.Internal(err)
		}
		s.localizeReminders(ctx, reminders, locale)
		return reminders, nil
	}

	children, _, err := s.children.List(ctx, dto.PageQuery{Page: 1, PerPage: 100}, role, userID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	childIDs := make([]uint64, 0, len(children))
	classroomIDs := make([]uint64, 0, len(children))
	for _, ch := range children {
		childIDs = append(childIDs, ch.ID)
		if ch.ClassroomID != nil {
			classroomIDs = append(classroomIDs, *ch.ClassroomID)
		}
	}

	cond := tx.Where("scope = 'global'")
	if len(classroomIDs) > 0 {
		cond = cond.Or("scope = 'classroom' AND scope_id IN ?", classroomIDs)
	}
	if len(childIDs) > 0 {
		cond = cond.Or("scope = 'child' AND scope_id IN ?", childIDs)
	}
	if err := cond.Find(&reminders).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	s.localizeReminders(ctx, reminders, locale)
	return reminders, nil
}

func (s *EngagementService) localizeReminders(ctx context.Context, reminders []model.Reminder, locale string) {
	if locale == "" || len(reminders) == 0 {
		return
	}
	ids := make([]uint64, len(reminders))
	for i := range reminders {
		ids[i] = reminders[i].ID
	}
	tr := s.translations.FetchMap(ctx, "reminder", ids, locale)
	for i := range reminders {
		if m, ok := tr[reminders[i].ID]; ok {
			if v := m["title"]; v != "" {
				reminders[i].Title = v
			}
			if v := m["description"]; v != "" {
				reminders[i].Description = v
			}
		}
	}
}

func (s *EngagementService) CreateReminder(ctx context.Context, req *dto.CreateReminderRequest, actorID uint64, ip string) (*model.Reminder, error) {
	items, err := json.Marshal(req.Items)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	r := &model.Reminder{
		Scope:        req.Scope,
		ScopeID:      req.ScopeID,
		Title:        req.Title,
		Description:  req.Description,
		Date:         req.Date,
		ItemsJSON:    datatypes.JSON(items),
		Kind:         defaultStr(req.Kind, "general"),
		WeatherAlert: req.WeatherAlert,
		Icon:         req.Icon,
		CreatedBy:    actorID,
	}
	if err := s.db.WithContext(ctx).Create(r).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	s.audit.Record(ctx, actorID, "create", "reminder", r.ID, map[string]any{"scope": r.Scope}, ip)
	return r, nil
}

func (s *EngagementService) DeleteReminder(ctx context.Context, id, actorID uint64, ip string) error {
	res := s.db.WithContext(ctx).Delete(&model.Reminder{}, id)
	if res.Error != nil {
		return apperr.Internal(res.Error)
	}
	if res.RowsAffected == 0 {
		return apperr.NotFound("reminder not found")
	}
	s.audit.Record(ctx, actorID, "delete", "reminder", id, nil, ip)
	return nil
}

// ---------- helpers ----------

func defaultStr(v, def string) string {
	if v == "" {
		return def
	}
	return v
}

func truncate(s string, n int) string {
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n]) + "…"
}
