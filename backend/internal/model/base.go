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

// TenantBase is Base plus the nursery that owns the row. Embed it on any model
// whose table carries nursery_id (see database.TenantTables).
//
// NurseryID is stamped automatically by the tenancy callback on insert and is
// never client-settable — ResetServerFields clears it along with the rest.
type TenantBase struct {
	Base
	NurseryID uint64 `gorm:"not null;index" json:"nursery_id"`
}

func (t *TenantBase) ResetServerFields() { *t = TenantBase{} }

// ResetServerFields zeroes everything a client must never set via JSON
// binding (mass-assignment guard for generic create/update paths).
func (b *Base) ResetServerFields() { *b = Base{} }
