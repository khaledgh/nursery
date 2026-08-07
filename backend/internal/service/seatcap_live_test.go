//go:build livedb

// Seat-cap concurrency proven against real MySQL.
//
// Count-then-insert is a classic race: without a lock, N simultaneous creates
// each read the same "seats used" value, all pass the check, and the nursery
// ends up over its plan. Only a real database with real transactions can show
// whether the SELECT ... FOR UPDATE actually serialises them.
//
//	TEST_DSN='root:@tcp(127.0.0.1:3306)/nursery_race?parseTime=true' \
//	  go test -tags livedb ./internal/service/ -v -run TestLiveSeat
package service

import (
	"context"
	"os"
	"sync"
	"testing"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/sunnystars/backend/internal/database"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
)

func seatDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DSN")
	if dsn == "" {
		t.Skip("TEST_DSN not set")
	}
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{Logger: logger.Discard})
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	if err := database.RegisterTenancy(db, true); err != nil {
		t.Fatalf("RegisterTenancy: %v", err)
	}
	return db
}

// setCap leaves exactly `free` seats available and returns a cleanup func.
func setCap(t *testing.T, db *gorm.DB, free int) (cap int) {
	t.Helper()
	ctx := database.WithCrossTenant(context.Background())

	var used int64
	db.WithContext(ctx).Model(&model.Child{}).Where("nursery_id = ?", 1).Count(&used)
	cap = int(used) + free

	var prev int
	db.WithContext(ctx).Model(&model.Subscription{}).
		Where("nursery_id = ?", 1).Select("max_students").Scan(&prev)

	if err := db.WithContext(ctx).Model(&model.Subscription{}).
		Where("nursery_id = ?", 1).Update("max_students", cap).Error; err != nil {
		t.Fatalf("set cap: %v", err)
	}
	t.Cleanup(func() {
		db.WithContext(ctx).Where("last_name = ?", "RaceTest").Unscoped().Delete(&model.Child{})
		db.WithContext(ctx).Model(&model.Subscription{}).
			Where("nursery_id = ?", 1).Update("max_students", prev)
	})
	return cap
}

// The race this guards against: many admins (or one impatient admin, or a
// retrying client) creating children at the same moment while the plan has
// only a few places left.
func TestLiveSeatCapHoldsUnderConcurrency(t *testing.T) {
	db := seatDB(t)
	const (
		free     = 5
		attempts = 40
	)
	cap := setCap(t, db, free)
	seats := NewSubscriptionService(db)

	var (
		wg        sync.WaitGroup
		mu        sync.Mutex
		succeeded int
		refused   int
	)
	start := make(chan struct{})

	for i := 0; i < attempts; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			<-start // release all goroutines together for maximum contention

			ctx := database.WithTenant(context.Background(), 1)
			child := &model.Child{
				FirstName:     "Race",
				LastName:      "RaceTest",
				DOB:           time.Date(2022, 1, 1, 0, 0, 0, 0, time.UTC),
				Status:        "active",
				PresentStatus: model.PresentOut,
			}
			err := seats.WithSeatCheck(ctx, 1, func(tx *gorm.DB) error {
				return tx.WithContext(ctx).Create(child).Error
			})

			mu.Lock()
			defer mu.Unlock()
			switch {
			case err == nil:
				succeeded++
			case apperr.From(err).Code == apperr.CodeSeatLimit:
				refused++
			default:
				t.Errorf("goroutine %d: unexpected error: %v", n, err)
			}
		}(i)
	}
	close(start)
	wg.Wait()

	if succeeded != free {
		t.Fatalf("succeeded = %d, want exactly %d — the cap was overshot or under-filled", succeeded, free)
	}
	if refused != attempts-free {
		t.Fatalf("refused = %d, want %d", refused, attempts-free)
	}

	// The database is the authority: the roster must sit exactly on the cap.
	var active int64
	db.WithContext(database.WithCrossTenant(context.Background())).
		Model(&model.Child{}).Where("nursery_id = ?", 1).Count(&active)
	if int(active) != cap {
		t.Fatalf("active children = %d, want %d (the plan's cap)", active, cap)
	}
}

// With no free seats, every concurrent attempt must be refused — none may slip
// through on a stale count.
func TestLiveSeatCapRefusesAllWhenFull(t *testing.T) {
	db := seatDB(t)
	setCap(t, db, 0)
	seats := NewSubscriptionService(db)

	var wg sync.WaitGroup
	var mu sync.Mutex
	succeeded := 0

	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ctx := database.WithTenant(context.Background(), 1)
			err := seats.WithSeatCheck(ctx, 1, func(tx *gorm.DB) error {
				return tx.WithContext(ctx).Create(&model.Child{
					FirstName: "Race", LastName: "RaceTest",
					DOB:    time.Date(2022, 1, 1, 0, 0, 0, 0, time.UTC),
					Status: "active", PresentStatus: model.PresentOut,
				}).Error
			})
			if err == nil {
				mu.Lock()
				succeeded++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()

	if succeeded != 0 {
		t.Fatalf("%d creates slipped past a full plan", succeeded)
	}
}
