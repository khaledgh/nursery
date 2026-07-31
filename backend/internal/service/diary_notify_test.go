package service

import (
	"testing"

	"github.com/sunnystars/backend/internal/dto"
)

// Teachers logging a burst of photos from the phone must be able to post them
// silently, while any client that omits the field keeps the old behaviour of
// always notifying guardians.
func TestDiaryNotifyDefaultsToOn(t *testing.T) {
	yes, no := true, false

	cases := []struct {
		name string
		req  dto.CreateDiaryEntryRequest
		want bool
	}{
		{"omitted field still notifies", dto.CreateDiaryEntryRequest{Title: "Painting"}, true},
		{"explicit true notifies", dto.CreateDiaryEntryRequest{Title: "Painting", Notify: &yes}, true},
		{"explicit false stays silent", dto.CreateDiaryEntryRequest{Title: "Painting", Notify: &no}, false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := shouldNotifyDiary(&tc.req); got != tc.want {
				t.Fatalf("notify = %v, want %v", got, tc.want)
			}
		})
	}
}
