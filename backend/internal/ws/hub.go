// Package ws delivers chat messages to connected clients in real time.
//
// Polling remains in place on both clients as a fallback: if a socket drops,
// the app degrades to its previous behaviour rather than going silently stale.
package ws

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 4096
	// sendBuffer bounds per-connection queueing; a client that cannot keep up
	// is dropped rather than growing memory without limit.
	sendBuffer = 32
)

// Event is the envelope every client receives.
type Event struct {
	Type string `json:"type"` // message.created | message.read | typing | conversation.updated
	Data any    `json:"data"`
}

type conn struct {
	ws     *websocket.Conn
	send   chan []byte
	userID uint64
}

// Hub fans events out to the right sockets.
//
// Connections are keyed by nursery first, so a broadcast physically cannot
// cross a tenant boundary — the map lookup would have to be wrong for that to
// happen, rather than a forgotten WHERE clause.
type Hub struct {
	mu    sync.RWMutex
	conns map[uint64]map[uint64]map[*conn]struct{} // nursery -> user -> conns
	log   zerolog.Logger
}

func NewHub(log zerolog.Logger) *Hub {
	return &Hub{
		conns: make(map[uint64]map[uint64]map[*conn]struct{}),
		log:   log,
	}
}

func (h *Hub) add(nurseryID, userID uint64, c *conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.conns[nurseryID] == nil {
		h.conns[nurseryID] = make(map[uint64]map[*conn]struct{})
	}
	if h.conns[nurseryID][userID] == nil {
		h.conns[nurseryID][userID] = make(map[*conn]struct{})
	}
	h.conns[nurseryID][userID][c] = struct{}{}
}

func (h *Hub) remove(nurseryID, userID uint64, c *conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if byUser, ok := h.conns[nurseryID]; ok {
		if set, ok := byUser[userID]; ok {
			delete(set, c)
			if len(set) == 0 {
				delete(byUser, userID)
			}
		}
		if len(byUser) == 0 {
			delete(h.conns, nurseryID)
		}
	}
	close(c.send)
}

// Publish delivers an event to one user's open sockets.
//
// Never blocks: a full buffer means the client is not keeping up, and the
// event is dropped for that connection. Chat state is re-fetched by the
// client's polling fallback, so a dropped frame is recoverable.
func (h *Hub) Publish(nurseryID, userID uint64, eventType string, data any) {
	payload, err := json.Marshal(Event{Type: eventType, Data: data})
	if err != nil {
		h.log.Error().Err(err).Msg("ws: failed to encode event")
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.conns[nurseryID][userID] {
		select {
		case c.send <- payload:
		default:
			h.log.Warn().Uint64("user_id", userID).Msg("ws: send buffer full, dropping event")
		}
	}
}

// PublishMany delivers the same event to several users in one nursery.
func (h *Hub) PublishMany(nurseryID uint64, userIDs []uint64, eventType string, data any) {
	for _, id := range userIDs {
		h.Publish(nurseryID, id, eventType, data)
	}
}

// Register takes over an upgraded connection and blocks until it closes.
func (h *Hub) Register(wsConn *websocket.Conn, nurseryID, userID uint64) {
	c := &conn{ws: wsConn, send: make(chan []byte, sendBuffer), userID: userID}
	h.add(nurseryID, userID, c)

	go c.writePump(h.log)
	c.readPump(h, nurseryID)
}

// readPump drains inbound frames. The protocol is server-push only, so client
// frames are discarded — reading is what keeps pong handling alive and detects
// a closed socket.
func (c *conn) readPump(h *Hub, nurseryID uint64) {
	defer func() {
		h.remove(nurseryID, c.userID, c)
		_ = c.ws.Close()
	}()

	c.ws.SetReadLimit(maxMessageSize)
	_ = c.ws.SetReadDeadline(time.Now().Add(pongWait))
	c.ws.SetPongHandler(func(string) error {
		return c.ws.SetReadDeadline(time.Now().Add(pongWait))
	})

	for {
		if _, _, err := c.ws.ReadMessage(); err != nil {
			return
		}
	}
}

func (c *conn) writePump(log zerolog.Logger) {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		_ = c.ws.Close()
	}()

	for {
		select {
		case payload, ok := <-c.send:
			_ = c.ws.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				_ = c.ws.WriteMessage(websocket.CloseMessage, nil)
				return
			}
			if err := c.ws.WriteMessage(websocket.TextMessage, payload); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.ws.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.ws.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
