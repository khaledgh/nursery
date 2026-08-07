package model

import "time"

type Role string

const (
	// RoleSuperAdmin operates above every nursery: it provisions tenants, sets
	// plans and seat caps, and is the only role not bound to a nursery_id.
	RoleSuperAdmin Role = "superadmin"
	RoleAdmin      Role = "admin"
	RoleTeacher    Role = "teacher"
	RoleParent     Role = "parent"
)

func (r Role) Valid() bool {
	switch r {
	case RoleSuperAdmin, RoleAdmin, RoleTeacher, RoleParent:
		return true
	}
	return false
}

// AssignableByAdmin reports whether a nursery admin may grant this role.
// Superadmin is deliberately excluded: only the seeder mints one, so a
// compromised admin account cannot escalate to platform level.
func (r Role) AssignableByAdmin() bool {
	switch r {
	case RoleAdmin, RoleTeacher, RoleParent:
		return true
	}
	return false
}

type UserStatus string

const (
	UserActive   UserStatus = "active"
	UserInactive UserStatus = "inactive"
)

type User struct {
	Base
	// Overrides TenantBase's plain index to form the composite unique key with
	// Email below; semantics are otherwise identical.
	NurseryID uint64 `gorm:"not null;index;uniqueIndex:ux_users_nursery_email,priority:1" json:"nursery_id"`
	Name      string `gorm:"size:191;not null" json:"name"`
	// Email is unique per nursery, not globally: the same person may be a
	// parent at two nurseries. LoginID is what disambiguates them at login.
	Email string `gorm:"size:191;not null;uniqueIndex:ux_users_nursery_email,priority:2" json:"email"`
	// LoginID is the nursery-issued mobile credential ("<slug>-<n>"). Globally
	// unique so one lookup resolves both the user and their nursery. Null for
	// superadmins and web-only admins.
	LoginID      *string    `gorm:"size:32;uniqueIndex" json:"login_id,omitempty"`
	Phone        string     `gorm:"size:32" json:"phone"`
	PasswordHash string     `gorm:"size:191;not null" json:"-"`
	Role         Role       `gorm:"type:enum('admin','teacher','parent');not null" json:"role"`
	Locale       string     `gorm:"size:10;not null;default:'en'" json:"locale"`
	AvatarID     *uint64    `json:"avatar_id"`
	Avatar       *Media     `gorm:"foreignKey:AvatarID" json:"avatar,omitempty"`
	Status       UserStatus `gorm:"type:enum('active','inactive');not null;default:'active'" json:"status"`
	LastLoginAt  *time.Time `json:"last_login_at"`
}

// RefreshToken stores only the SHA-256 hash of the opaque refresh token.
// Rotation: each use revokes the row and issues a new one; reuse of a revoked
// token signals theft and revokes the whole chain.
type RefreshToken struct {
	ID         uint64    `gorm:"primaryKey"`
	UserID     uint64    `gorm:"not null;index"`
	User       User      `gorm:"foreignKey:UserID"`
	TokenHash  string    `gorm:"size:64;not null;uniqueIndex"`
	DeviceInfo string    `gorm:"size:255"`
	ExpiresAt  time.Time `gorm:"not null"`
	RevokedAt  *time.Time
	// ReplacedByHash links a rotated token to its successor for reuse detection.
	ReplacedByHash string `gorm:"size:64"`
	CreatedAt      time.Time
}

// PasswordReset stores hashed single-use reset tokens.
type PasswordReset struct {
	ID        uint64    `gorm:"primaryKey"`
	UserID    uint64    `gorm:"not null;index"`
	TokenHash string    `gorm:"size:64;not null;uniqueIndex"`
	ExpiresAt time.Time `gorm:"not null"`
	UsedAt    *time.Time
	CreatedAt time.Time
}

// DeviceToken maps a user to a OneSignal player id for push targeting.
type DeviceToken struct {
	TenantBase
	UserID            uint64     `gorm:"not null;index" json:"user_id"`
	OneSignalPlayerID string     `gorm:"size:191;not null;uniqueIndex" json:"onesignal_player_id"`
	Platform          string     `gorm:"size:20;not null" json:"platform"` // ios | android | web
	Locale            string     `gorm:"size:10" json:"locale"`
	LastSeenAt        *time.Time `json:"last_seen_at"`
}
