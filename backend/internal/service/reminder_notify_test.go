package service

import (
	"context"
	"testing"

	"github.com/sunnystars/backend/internal/model"
)

type recordedNotification struct {
	Kind     string // "role" | "guardians" | "classroom"
	Target   uint64
	Role     string
	Category string
	Title    string
}

// spyNotifier records calls instead of sending them.
type spyNotifier struct{ sent []recordedNotification }

func (s *spyNotifier) NotifyGuardians(_ context.Context, childID uint64, category, title, _ string, _ map[string]any) {
	s.sent = append(s.sent, recordedNotification{Kind: "guardians", Target: childID, Category: category, Title: title})
}

func (s *spyNotifier) NotifyUser(_ context.Context, userID uint64, category, title, _ string, _ map[string]any) {
	s.sent = append(s.sent, recordedNotification{Kind: "user", Target: userID, Category: category, Title: title})
}

func (s *spyNotifier) NotifyRole(_ context.Context, role, category, title, _ string, _ map[string]any) {
	s.sent = append(s.sent, recordedNotification{Kind: "role", Role: role, Category: category, Title: title})
}

func (s *spyNotifier) NotifyClassroomGuardians(_ context.Context, classroomID uint64, category, title, _ string, _ map[string]any) {
	s.sent = append(s.sent, recordedNotification{Kind: "classroom", Target: classroomID, Category: category, Title: title})
}

func TestNotifyReminderTargetsItsScope(t *testing.T) {
	classroomID := uint64(7)
	childID := uint64(42)

	cases := []struct {
		name     string
		reminder model.Reminder
		want     recordedNotification
	}{
		{
			name:     "global reaches every parent",
			reminder: model.Reminder{Scope: "global", Title: "Wear boots"},
			want:     recordedNotification{Kind: "role", Role: "parent", Category: model.CategoryReminders, Title: "Wear boots"},
		},
		{
			name:     "child reaches that child's guardians",
			reminder: model.Reminder{Scope: "child", ScopeID: &childID, Title: "Bring inhaler"},
			want:     recordedNotification{Kind: "guardians", Target: childID, Category: model.CategoryReminders, Title: "Bring inhaler"},
		},
		{
			// One deduplicated send, not one per child in the room.
			name:     "classroom reaches the room's guardians once",
			reminder: model.Reminder{Scope: "classroom", ScopeID: &classroomID, Title: "Trip tomorrow"},
			want:     recordedNotification{Kind: "classroom", Target: classroomID, Category: model.CategoryReminders, Title: "Trip tomorrow"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			spy := &spyNotifier{}
			svc := &EngagementService{notifier: spy}
			svc.NotifyReminder(context.Background(), &tc.reminder)

			if len(spy.sent) != 1 {
				t.Fatalf("sent %d notifications, want 1: %+v", len(spy.sent), spy.sent)
			}
			if spy.sent[0] != tc.want {
				t.Errorf("sent %+v, want %+v", spy.sent[0], tc.want)
			}
		})
	}
}

// A scoped reminder with no target would otherwise notify nobody silently or
// dereference a nil pointer.
func TestNotifyReminderSkipsScopedReminderWithoutTarget(t *testing.T) {
	for _, scope := range []string{"child", "classroom"} {
		spy := &spyNotifier{}
		svc := &EngagementService{notifier: spy}
		svc.NotifyReminder(context.Background(), &model.Reminder{Scope: scope, Title: "Orphan"})

		if len(spy.sent) != 0 {
			t.Errorf("scope %q with nil ScopeID sent %+v", scope, spy.sent)
		}
	}
}
