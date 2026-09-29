package service

import (
	"context"
	"testing"

	"github.com/sunnystars/backend/internal/model"
)

// recordingNotifier records which audience each notification was sent to.
type recordingNotifier struct {
	NoopNotifier
	calls []string
}

func (r *recordingNotifier) NotifyRole(_ context.Context, role string, _, _, _ string, _ map[string]any) {
	r.calls = append(r.calls, "role:"+role)
}

func (r *recordingNotifier) NotifyClassroomGuardians(_ context.Context, classroomID uint64, _, _, _ string, _ map[string]any) {
	r.calls = append(r.calls, "classroom")
	if classroomID != 7 {
		panic("wrong classroom")
	}
}

func TestEventForOneClassroomOnlyNotifiesThatClassroom(t *testing.T) {
	rec := &recordingNotifier{}
	s := &EngagementService{notifier: rec}

	s.notifyEventAudience(context.Background(), &model.Event{Audience: "classroom:7"}, "events", "t", "b", nil)
	s.notifyEventAudience(context.Background(), &model.Event{Audience: "all"}, "events", "t", "b", nil)
	s.notifyEventAudience(context.Background(), &model.Event{Audience: "classroom:oops"}, "events", "t", "b", nil)

	want := []string{"classroom", "role:parent", "role:parent"}
	if len(rec.calls) != len(want) {
		t.Fatalf("calls = %v, want %v", rec.calls, want)
	}
	for i := range want {
		if rec.calls[i] != want[i] {
			t.Fatalf("calls = %v, want %v", rec.calls, want)
		}
	}
}
