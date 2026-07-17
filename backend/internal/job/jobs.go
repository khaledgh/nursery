// Package job schedules the recurring background work: overdue invoices,
// token cleanup, and event/bring reminders.
package job

import (
	"context"
	"time"

	"github.com/robfig/cron/v3"
	"github.com/rs/zerolog"
	"gorm.io/gorm"

	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/repository"
	"github.com/sunnystars/backend/internal/service"
)

type Runner struct {
	cron     *cron.Cron
	db       *gorm.DB
	payments *service.PaymentService
	tokens   *repository.TokenRepo
	notifier service.Notifier
	log      zerolog.Logger
}

func NewRunner(db *gorm.DB, payments *service.PaymentService, tokens *repository.TokenRepo, notifier service.Notifier, log zerolog.Logger) *Runner {
	return &Runner{
		cron:     cron.New(),
		db:       db,
		payments: payments,
		tokens:   tokens,
		notifier: notifier,
		log:      log,
	}
}

func (r *Runner) Start() {
	r.add("0 6 * * *", "mark-overdue-invoices", r.markOverdueInvoices)
	r.add("30 3 * * *", "cleanup-expired-tokens", r.cleanupTokens)
	r.add("0 17 * * *", "event-reminders", r.eventReminders)
	r.add("0 7 * * *", "what-to-bring-today", r.bringReminders)
	r.cron.Start()
	r.log.Info().Msg("cron jobs started")
}

func (r *Runner) Stop() { r.cron.Stop() }

func (r *Runner) add(spec, name string, fn func(context.Context) error) {
	_, err := r.cron.AddFunc(spec, func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()
		if err := fn(ctx); err != nil {
			r.log.Error().Err(err).Str("job", name).Msg("cron job failed")
			return
		}
		r.log.Info().Str("job", name).Msg("cron job completed")
	})
	if err != nil {
		r.log.Error().Err(err).Str("job", name).Msg("failed to schedule job")
	}
}

func (r *Runner) markOverdueInvoices(ctx context.Context) error {
	return r.payments.MarkOverdueInvoices(ctx)
}

func (r *Runner) cleanupTokens(ctx context.Context) error {
	// Expired tokens are useless for revocation forensics after 30 days.
	return r.tokens.DeleteExpired(ctx, time.Now().AddDate(0, 0, -30))
}

// eventReminders pings parents about events starting tomorrow.
func (r *Runner) eventReminders(ctx context.Context) error {
	tomorrowStart := time.Now().AddDate(0, 0, 1).Truncate(24 * time.Hour)
	var events []model.Event
	if err := r.db.WithContext(ctx).
		Where("status = 'upcoming' AND starts_at >= ? AND starts_at < ?",
			tomorrowStart, tomorrowStart.AddDate(0, 0, 1)).
		Find(&events).Error; err != nil {
		return err
	}
	for _, ev := range events {
		r.notifier.NotifyRole(ctx, string(model.RoleParent), "events",
			"Event tomorrow 📅", ev.Title,
			map[string]any{"screen": "events", "event_id": ev.ID})
	}
	return nil
}

// bringReminders pushes today's dated "what to bring" reminders.
func (r *Runner) bringReminders(ctx context.Context) error {
	today := time.Now().Format("2006-01-02")
	var reminders []model.Reminder
	if err := r.db.WithContext(ctx).
		Where("date = ?", today).
		Find(&reminders).Error; err != nil {
		return err
	}
	for _, rem := range reminders {
		switch rem.Scope {
		case "global":
			r.notifier.NotifyRole(ctx, string(model.RoleParent), "reminders", rem.Title, rem.Description,
				map[string]any{"screen": "reminders", "reminder_id": rem.ID})
		case "child":
			if rem.ScopeID != nil {
				r.notifier.NotifyGuardians(ctx, *rem.ScopeID, "reminders", rem.Title, rem.Description,
					map[string]any{"screen": "reminders", "reminder_id": rem.ID})
			}
		case "classroom":
			if rem.ScopeID == nil {
				continue
			}
			var childIDs []uint64
			if err := r.db.WithContext(ctx).Model(&model.Child{}).
				Where("classroom_id = ?", *rem.ScopeID).Pluck("id", &childIDs).Error; err != nil {
				continue
			}
			for _, cid := range childIDs {
				r.notifier.NotifyGuardians(ctx, cid, "reminders", rem.Title, rem.Description,
					map[string]any{"screen": "reminders", "reminder_id": rem.ID})
			}
		}
	}
	return nil
}
