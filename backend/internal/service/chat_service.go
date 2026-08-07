package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/rs/zerolog"
	"gorm.io/gorm"

	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
)

// RealtimePublisher pushes an event to one user's open sockets. Kept as an
// interface so the service does not depend on the ws package (and so tests can
// pass nil).
type RealtimePublisher interface {
	Publish(nurseryID, userID uint64, eventType string, data any)
}

type ChatService struct {
	db       *gorm.DB
	notifier Notifier
	hub      RealtimePublisher
	log      zerolog.Logger
}

func NewChatService(db *gorm.DB, notifier Notifier, hub RealtimePublisher, log zerolog.Logger) *ChatService {
	return &ChatService{
		db:       db,
		notifier: notifier,
		hub:      hub,
		log:      log,
	}
}

// publish is a no-op when no hub is wired, so chat still works without the
// realtime layer — clients fall back to polling.
func (s *ChatService) publish(nurseryID, userID uint64, eventType string, data any) {
	if s.hub != nil {
		s.hub.Publish(nurseryID, userID, eventType, data)
	}
}

func (s *ChatService) GetConversations(ctx context.Context, userID uint64, role model.Role) ([]model.Conversation, error) {
	var convs []model.Conversation
	q := s.db.WithContext(ctx).
		Preload("ParentUser").
		Preload("RecipientUser").
		Preload("Child")

	if role == model.RoleAdmin {
		// Admin can see all admin conversations or recipient conversations
		q = q.Where("recipient_user_id = ? OR parent_user_id = ? OR type = ?", userID, userID, model.ConversationParentAdmin)
	} else if role == model.RoleTeacher {
		q = q.Where("recipient_user_id = ? OR parent_user_id = ?", userID, userID)
	} else {
		q = q.Where("parent_user_id = ? OR recipient_user_id = ?", userID, userID)
	}

	if err := q.Order("last_message_at DESC, created_at DESC").Find(&convs).Error; err != nil {
		return nil, err
	}

	for i := range convs {
		var unread int64
		_ = s.db.WithContext(ctx).Model(&model.ChatMessage{}).
			Where("conversation_id = ? AND sender_user_id != ? AND read_at IS NULL", convs[i].ID, userID).
			Count(&unread).Error
		convs[i].UnreadCount = int(unread)
	}

	return convs, nil
}

func (s *ChatService) GetOrCreateConversation(ctx context.Context, parentID, recipientID uint64, convType model.ConversationType, childID *uint64) (*model.Conversation, error) {
	if convType == model.ConversationParentAdmin && recipientID == 0 {
		var adminUser model.User
		if err := s.db.WithContext(ctx).Where("role = ? AND status = 'active'", model.RoleAdmin).First(&adminUser).Error; err != nil {
			return nil, errors.New("no active admin found")
		}
		recipientID = adminUser.ID
	}

	if recipientID == 0 {
		return nil, errors.New("recipient user required")
	}

	var conv model.Conversation
	err := s.db.WithContext(ctx).
		Where("parent_user_id = ? AND recipient_user_id = ? AND type = ?", parentID, recipientID, convType).
		First(&conv).Error

	if err == nil {
		return &conv, nil
	}

	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	conv = model.Conversation{
		Type:            convType,
		ParentUserID:    parentID,
		RecipientUserID: recipientID,
		ChildID:         childID,
	}

	if err := s.db.WithContext(ctx).Create(&conv).Error; err != nil {
		return nil, err
	}

	_ = s.db.WithContext(ctx).
		Preload("ParentUser").
		Preload("RecipientUser").
		Preload("Child").
		First(&conv, conv.ID)

	return &conv, nil
}

// authorize loads a conversation and confirms the caller may act on it.
//
// Every conversation-scoped operation funnels through this. Without it the
// conversation id from the URL is trusted outright, so any authenticated user
// can read or post into any thread by guessing a sequential integer.
//
// Returns NotFound rather than Forbidden, matching ChildService.Authorize:
// don't confirm a conversation exists to someone who isn't in it.
func (s *ChatService) authorize(ctx context.Context, conversationID, userID uint64, role model.Role) (*model.Conversation, error) {
	var conv model.Conversation
	if err := s.db.WithContext(ctx).First(&conv, conversationID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.NotFound("conversation not found")
		}
		return nil, apperr.Internal(err)
	}
	if conv.ParentUserID == userID || conv.RecipientUserID == userID {
		return &conv, nil
	}
	// Admins staff the parent_admin queue collectively, so any admin may pick up
	// such a thread. Tenancy scoping keeps this inside their own nursery.
	if role == model.RoleAdmin && conv.Type == model.ConversationParentAdmin {
		return &conv, nil
	}
	return nil, apperr.NotFound("conversation not found")
}

func (s *ChatService) GetMessages(ctx context.Context, conversationID, userID uint64, role model.Role, page, limit int) ([]model.ChatMessage, error) {
	if _, err := s.authorize(ctx, conversationID, userID, role); err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = 50
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit

	var msgs []model.ChatMessage
	err := s.db.WithContext(ctx).
		Preload("SenderUser").
		Preload("Media").
		Where("conversation_id = ?", conversationID).
		Order("created_at ASC").
		Offset(offset).
		Limit(limit).
		Find(&msgs).Error

	if err != nil {
		return nil, err
	}

	// Auto mark as read — authorize already ran at the top of this method.
	_ = s.markRead(ctx, conversationID, userID)

	return msgs, nil
}

func (s *ChatService) SendMessage(ctx context.Context, conversationID, senderID uint64, role model.Role, body string, mediaID *uint64) (*model.ChatMessage, error) {
	// Doubles as the participant check — the send path used to load the
	// conversation only to pick a push target, never to authorize.
	conv, err := s.authorize(ctx, conversationID, senderID, role)
	if err != nil {
		return nil, err
	}

	msg := model.ChatMessage{
		ConversationID: conversationID,
		SenderUserID:   senderID,
		Body:           body,
		MediaID:        mediaID,
	}

	if err := s.db.WithContext(ctx).Create(&msg).Error; err != nil {
		return nil, err
	}

	now := time.Now()
	preview := body
	if len(preview) > 100 {
		preview = preview[:97] + "..."
	}
	_ = s.db.WithContext(ctx).Model(conv).Updates(map[string]any{
		"last_message_at":      now,
		"last_message_preview": preview,
	}).Error

	_ = s.db.WithContext(ctx).Preload("SenderUser").Preload("Media").First(&msg, msg.ID)

	// Determine push notification recipient
	recipientID := conv.RecipientUserID
	if senderID == conv.RecipientUserID {
		recipientID = conv.ParentUserID
	}

	senderName := "New Message"
	if msg.SenderUser != nil && msg.SenderUser.Name != "" {
		senderName = msg.SenderUser.Name
	}

	s.notifier.NotifyUser(ctx, recipientID, model.CategoryMessages, senderName, body, map[string]any{
		"type":            "chat",
		"conversation_id": conversationID,
		"sender_id":       senderID,
		"url":             fmt.Sprintf("/chat/%d", conversationID),
	})

	// Same fire-and-forget seam as the push above: both participants get the
	// message instantly, and the sender's other devices stay in sync.
	s.publish(conv.NurseryID, recipientID, "message.created", &msg)
	s.publish(conv.NurseryID, senderID, "message.created", &msg)

	return &msg, nil
}

func (s *ChatService) MarkAsRead(ctx context.Context, conversationID, userID uint64, role model.Role) error {
	if _, err := s.authorize(ctx, conversationID, userID, role); err != nil {
		return err
	}
	return s.markRead(ctx, conversationID, userID)
}

// markRead is the unauthorized inner write, for callers that have already
// passed authorize. Do not call it from a handler.
func (s *ChatService) markRead(ctx context.Context, conversationID, userID uint64) error {
	return s.db.WithContext(ctx).Model(&model.ChatMessage{}).
		Where("conversation_id = ? AND sender_user_id != ? AND read_at IS NULL", conversationID, userID).
		Update("read_at", time.Now()).Error
}
