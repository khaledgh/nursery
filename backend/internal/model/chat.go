package model

import "time"

type ConversationType string

const (
	ConversationParentTeacher ConversationType = "parent_teacher"
	ConversationParentAdmin   ConversationType = "parent_admin"
)

type Conversation struct {
	ID                 uint64           `gorm:"primaryKey" json:"id"`
	Type               ConversationType `gorm:"type:enum('parent_teacher','parent_admin');not null;default:'parent_teacher'" json:"type"`
	ParentUserID       uint64           `gorm:"not null;index" json:"parent_user_id"`
	ParentUser         *User            `gorm:"foreignKey:ParentUserID" json:"parent_user,omitempty"`
	RecipientUserID    uint64           `gorm:"not null;index" json:"recipient_user_id"`
	RecipientUser      *User            `gorm:"foreignKey:RecipientUserID" json:"recipient_user,omitempty"`
	ChildID            *uint64          `json:"child_id"`
	Child              *Child           `gorm:"foreignKey:ChildID" json:"child,omitempty"`
	LastMessageAt      *time.Time       `gorm:"index" json:"last_message_at"`
	LastMessagePreview string           `gorm:"size:500" json:"last_message_preview"`
	UnreadCount        int              `gorm:"-" json:"unread_count"`
	CreatedAt          time.Time        `json:"created_at"`
	UpdatedAt          time.Time        `json:"updated_at"`
}

func (c *Conversation) GetID() uint64 { return c.ID }

type ChatMessage struct {
	ID             uint64        `gorm:"primaryKey" json:"id"`
	ConversationID uint64        `gorm:"not null;index" json:"conversation_id"`
	Conversation   *Conversation `gorm:"foreignKey:ConversationID" json:"conversation,omitempty"`
	SenderUserID   uint64        `gorm:"not null;index" json:"sender_user_id"`
	SenderUser     *User         `gorm:"foreignKey:SenderUserID" json:"sender_user,omitempty"`
	Body           string        `gorm:"type:text;not null" json:"body"`
	MediaID        *uint64       `json:"media_id"`
	Media          *Media        `gorm:"foreignKey:MediaID" json:"media,omitempty"`
	ReadAt         *time.Time    `json:"read_at"`
	CreatedAt      time.Time     `json:"created_at"`
	UpdatedAt      time.Time     `json:"updated_at"`
}

func (m *ChatMessage) GetID() uint64 { return m.ID }
