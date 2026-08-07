package ws

import (
	"crypto/rand"
	"encoding/base64"
	"sync"
	"time"
)

// ticketTTL is deliberately tiny: a ticket only has to survive the round trip
// from the fetch that minted it to the WebSocket upgrade.
const ticketTTL = 60 * time.Second

type ticket struct {
	nurseryID uint64
	userID    uint64
	expiresAt time.Time
}

// TicketStore issues single-use tickets for WebSocket upgrades.
//
// A browser cannot set an Authorization header on a WebSocket handshake, and
// putting the real access token in the query string would write it into server
// logs, proxy history, and Referer headers. A ticket is short-lived, one-shot,
// and useless anywhere else.
type TicketStore struct {
	mu      sync.Mutex
	tickets map[string]ticket
}

func NewTicketStore() *TicketStore {
	s := &TicketStore{tickets: make(map[string]ticket)}
	go s.reap()
	return s
}

// Issue mints a ticket for an already-authenticated caller.
func (s *TicketStore) Issue(nurseryID, userID uint64) (string, time.Time, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", time.Time{}, err
	}
	key := base64.RawURLEncoding.EncodeToString(raw)
	exp := time.Now().Add(ticketTTL)

	s.mu.Lock()
	s.tickets[key] = ticket{nurseryID: nurseryID, userID: userID, expiresAt: exp}
	s.mu.Unlock()

	return key, exp, nil
}

// Redeem consumes a ticket, returning the nursery and user it was minted for.
// A ticket is valid exactly once.
func (s *TicketStore) Redeem(key string) (nurseryID, userID uint64, ok bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	t, found := s.tickets[key]
	if !found {
		return 0, 0, false
	}
	delete(s.tickets, key)
	if time.Now().After(t.expiresAt) {
		return 0, 0, false
	}
	return t.nurseryID, t.userID, true
}

// reap clears expired tickets that were never redeemed.
func (s *TicketStore) reap() {
	for range time.Tick(ticketTTL) {
		now := time.Now()
		s.mu.Lock()
		for k, t := range s.tickets {
			if now.After(t.expiresAt) {
				delete(s.tickets, k)
			}
		}
		s.mu.Unlock()
	}
}
