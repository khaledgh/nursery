package service

import (
	"context"
	"sync"
	"time"

	"gorm.io/gorm"

	"github.com/sunnystars/backend/internal/model"
)

// LocaleService caches the active locale set (read on every request by the
// locale middleware) and refreshes it periodically or when admins change it.
type LocaleService struct {
	db            *gorm.DB
	fallback      string // from config, used until/unless the DB defines a default
	mu            sync.RWMutex
	active        map[string]bool
	defaultLocale string
	loadedAt      time.Time
}

const localeCacheTTL = time.Minute

func NewLocaleService(db *gorm.DB, fallback string) *LocaleService {
	s := &LocaleService{db: db, fallback: fallback, active: map[string]bool{fallback: true}, defaultLocale: fallback}
	s.refresh()
	return s
}

// Active implements middleware.ActiveLocales.
func (s *LocaleService) Active() (map[string]bool, string) {
	s.mu.RLock()
	stale := time.Since(s.loadedAt) > localeCacheTTL
	active, def := s.active, s.defaultLocale
	s.mu.RUnlock()
	if stale {
		s.refresh()
		s.mu.RLock()
		active, def = s.active, s.defaultLocale
		s.mu.RUnlock()
	}
	return active, def
}

func (s *LocaleService) IsActive(code string) bool {
	active, _ := s.Active()
	return active[code]
}

// Invalidate forces a reload on next access (call after admin locale edits).
func (s *LocaleService) Invalidate() {
	s.mu.Lock()
	s.loadedAt = time.Time{}
	s.mu.Unlock()
}

func (s *LocaleService) List(ctx context.Context) ([]model.Locale, error) {
	var locales []model.Locale
	err := s.db.WithContext(ctx).Order("sort_order ASC").Find(&locales).Error
	return locales, err
}

func (s *LocaleService) refresh() {
	var locales []model.Locale
	if err := s.db.Where("is_active = ?", true).Find(&locales).Error; err != nil {
		return // keep serving the previous (or fallback) set
	}
	active := make(map[string]bool, len(locales))
	def := s.fallback
	for _, l := range locales {
		active[l.Code] = true
		if l.IsDefault {
			def = l.Code
		}
	}
	if len(active) == 0 {
		active[s.fallback] = true
	}
	s.mu.Lock()
	s.active, s.defaultLocale, s.loadedAt = active, def, time.Now()
	s.mu.Unlock()
}
