package handler

import (
	"net/http"
	"slices"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"

	mw "github.com/sunnystars/backend/internal/middleware"
	"github.com/sunnystars/backend/internal/pkg/response"
	"github.com/sunnystars/backend/internal/ws"
)

type WSHandler struct {
	hub      *ws.Hub
	tickets  *ws.TicketStore
	upgrader websocket.Upgrader
}

func NewWSHandler(hub *ws.Hub, tickets *ws.TicketStore, allowedOrigins []string) *WSHandler {
	return &WSHandler{
		hub:     hub,
		tickets: tickets,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			// The default CheckOrigin accepts every origin, which would let any
			// site open an authenticated socket on a user's behalf.
			CheckOrigin: func(r *http.Request) bool {
				origin := r.Header.Get("Origin")
				if origin == "" {
					return true // non-browser client (the mobile app)
				}
				return slices.Contains(allowedOrigins, origin) || slices.Contains(allowedOrigins, "*")
			},
		},
	}
}

// Register mounts the ticket endpoint on the authenticated group and the
// upgrade endpoint on the public one — the upgrade carries a ticket instead of
// a bearer token, since browsers cannot set headers on a handshake.
func (h *WSHandler) Register(protected, public *echo.Group) {
	protected.POST("/chat/ws-ticket", h.IssueTicket)
	public.GET("/ws/chat", h.Connect)
}

func (h *WSHandler) IssueTicket(c echo.Context) error {
	userID := mw.UserID(c)
	if userID == 0 {
		return response.Err(c, http.StatusUnauthorized, "unauthorized", "not signed in", nil)
	}
	key, exp, err := h.tickets.Issue(mw.NurseryID(c), userID)
	if err != nil {
		return response.Err(c, http.StatusInternalServerError, "internal_error", "could not issue ticket", nil)
	}
	return response.OK(c, map[string]any{"ticket": key, "expires_at": exp})
}

// Connect upgrades the request after redeeming a single-use ticket.
func (h *WSHandler) Connect(c echo.Context) error {
	nurseryID, userID, ok := h.tickets.Redeem(c.QueryParam("ticket"))
	if !ok {
		return response.Err(c, http.StatusUnauthorized, "unauthorized", "invalid or expired ticket", nil)
	}

	conn, err := h.upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		return nil // Upgrade already wrote its own error response
	}
	// Blocks until the socket closes.
	h.hub.Register(conn, nurseryID, userID)
	return nil
}
