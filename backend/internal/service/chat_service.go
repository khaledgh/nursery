package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/rs/zerolog"
	"gorm.io/gorm"

	"github.com/sunnystars/backend/internal/model"
)

type ChatService struct {
	db       *gorm.DB
	notifier Notifier
	log      zerolog.Logger
}

func NewChatService(db *gorm.DB, notifier Notifier, log zerolog.Logger) *ChatService {
	return &ChatService{
		db:       db,
		notifier: notifier,
		log:      log,
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

func (s *ChatService) GetMessages(ctx context.Context, conversationID, userID uint64, page, limit int) ([]model.ChatMessage, error) {
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

	// Auto mark as read
	_ = s.MarkAsRead(ctx, conversationID, userID)

	return msgs, nil
}

func (s *ChatService) SendMessage(ctx context.Context, conversationID, senderID uint64, body string, mediaID *uint64) (*model.ChatMessage, error) {
	var conv model.Conversation
	if err := s.db.WithContext(ctx).Preload("ParentUser").Preload("RecipientUser").First(&conv, conversationID).Error; err != nil {
		return nil, errors.New("conversation not found")
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
	_ = s.db.WithContext(ctx).Model(&conv).Updates(map[string]any{
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

	return &msg, nil
}

func (s *ChatService) MarkAsRead(ctx context.Context, conversationID, userID uint64) error {
	now := time.Now()
	return s.db.WithContext(ctx).Model(&model.ChatMessage{}).
		Where("conversation_id = ? AND sender_user_id != ? AND read_at IS NULL", conversationID, userID).
		Update("read_at", now).Error
}
