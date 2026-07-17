package model

import (
	"time"

	"gorm.io/gorm"
)

// Base is embedded by most models: BIGINT PK + timestamps + soft delete.
type Base struct {
	ID        uint64         `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (b *Base) GetID() uint64 { return b.ID }

// ResetServerFields zeroes everything a client must never set via JSON
// binding (mass-assignment guard for generic create/update paths).
func (b *Base) ResetServerFields() { *b = Base{} }
