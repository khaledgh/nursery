package ws

import (
	"testing"
	"time"
)

func TestTicketRoundTrip(t *testing.T) {
	s := NewTicketStore()
	key, exp, err := s.Issue(7, 42)
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	if time.Until(exp) > ticketTTL+time.Second {
		t.Fatalf("expiry too far out: %v", exp)
	}

	nurseryID, userID, ok := s.Redeem(key)
	if !ok {
		t.Fatal("a freshly issued ticket must redeem")
	}
	if nurseryID != 7 || userID != 42 {
		t.Fatalf("redeemed (%d, %d), want (7, 42)", nurseryID, userID)
	}
}

// Single-use is the point: a ticket travels in a URL, so it may end up in
// server logs or proxy history. Replaying one must not open a second socket.
func TestTicketIsSingleUse(t *testing.T) {
	s := NewTicketStore()
	key, _, _ := s.Issue(1, 1)

	if _, _, ok := s.Redeem(key); !ok {
		t.Fatal("first redeem should succeed")
	}
	if _, _, ok := s.Redeem(key); ok {
		t.Fatal("a ticket must not be redeemable twice")
	}
}

func TestTicketRejectsUnknownKey(t *testing.T) {
	s := NewTicketStore()
	if _, _, ok := s.Redeem("not-a-real-ticket"); ok {
		t.Fatal("an unknown ticket must not redeem")
	}
	if _, _, ok := s.Redeem(""); ok {
		t.Fatal("an empty ticket must not redeem")
	}
}

func TestExpiredTicketIsRejected(t *testing.T) {
	s := NewTicketStore()
	key, _, _ := s.Issue(1, 1)

	// Backdate the entry rather than sleeping out the real TTL.
	s.mu.Lock()
	tk := s.tickets[key]
	tk.expiresAt = time.Now().Add(-time.Second)
	s.tickets[key] = tk
	s.mu.Unlock()

	if _, _, ok := s.Redeem(key); ok {
		t.Fatal("an expired ticket must not redeem")
	}
}

func TestTicketsAreUnique(t *testing.T) {
	s := NewTicketStore()
	seen := make(map[string]bool, 200)
	for i := 0; i < 200; i++ {
		key, _, err := s.Issue(1, uint64(i))
		if err != nil {
			t.Fatalf("issue: %v", err)
		}
		if seen[key] {
			t.Fatal("ticket keys must not collide")
		}
		seen[key] = true
	}
}

// A ticket carries its own nursery, so a socket cannot be opened against a
// tenant the requester does not belong to.
func TestTicketCarriesItsOwnTenant(t *testing.T) {
	s := NewTicketStore()
	a, _, _ := s.Issue(1, 100)
	b, _, _ := s.Issue(2, 200)

	if n, u, _ := s.Redeem(a); n != 1 || u != 100 {
		t.Fatalf("ticket A redeemed as (%d, %d), want (1, 100)", n, u)
	}
	if n, u, _ := s.Redeem(b); n != 2 || u != 200 {
		t.Fatalf("ticket B redeemed as (%d, %d), want (2, 200)", n, u)
	}
}
