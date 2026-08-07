package middleware

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/sunnystars/backend/internal/pkg/apperr"
	"github.com/sunnystars/backend/internal/pkg/response"
)

const (
	// maxFailures before an identifier is locked out.
	maxFailures = 8
	// lockout is how long the block lasts once tripped.
	lockout = 15 * time.Minute
	// failureWindow ages out old failures so an occasional typo never
	// accumulates into a block.
	failureWindow = 15 * time.Minute
)

type attemptRecord struct {
	failures  int
	firstSeen time.Time
	blockedAt time.Time
}

// LoginLimiter throttles credential-stuffing per identifier, not just per IP.
//
// The existing IP limiter does not cover this case: login ids are short and
// sequential ("<slug>-1000", "<slug>-1001", …), so a distributed sweep of the
// id space would slip under a per-IP budget while still hammering one account.
type LoginLimiter struct {
	mu       sync.Mutex
	attempts map[string]*attemptRecord
}

func NewLoginLimiter() *LoginLimiter {
	l := &LoginLimiter{attempts: make(map[string]*attemptRecord)}
	go l.reap()
	return l
}

// Middleware blocks a locked-out identifier before the handler runs, and
// records the outcome afterwards.
func (l *LoginLimiter) Middleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			id := l.identifierFrom(c)
			if id == "" {
				return next(c)
			}
			if l.blocked(id) {
				return response.Err(c, http.StatusTooManyRequests, "rate_limited",
					"too many sign-in attempts; try again later", nil)
			}

			err := next(c)

			// The outcome must come from the returned error, not from
			// c.Response().Status. Handlers here return their error for Echo's
			// central handler to render, so at this point the response is still
			// an uncommitted 200 and every failure would look like a success.
			switch status := outcomeStatus(c, err); {
			// 401 covers both a wrong password and an unknown identifier — the
			// handler deliberately does not distinguish them.
			case status == http.StatusUnauthorized:
				l.recordFailure(id)
			case status < 400:
				l.reset(id)
			}
			return err
		}
	}
}

// outcomeStatus resolves the status this request will actually return,
// whether the handler wrote it directly or returned an error to be rendered.
func outcomeStatus(c echo.Context, err error) int {
	if err == nil {
		return c.Response().Status
	}
	var ae *apperr.Error
	if errors.As(err, &ae) {
		return ae.HTTPStatus()
	}
	var he *echo.HTTPError
	if errors.As(err, &he) {
		return he.Code
	}
	return http.StatusInternalServerError
}

// identifierFrom reads the credential from the body without consuming it, so
// the handler can still bind the request.
func (l *LoginLimiter) identifierFrom(c echo.Context) string {
	if c.Request().Body == nil {
		return ""
	}
	raw, err := io.ReadAll(io.LimitReader(c.Request().Body, 4096))
	if err != nil {
		return ""
	}
	c.Request().Body = io.NopCloser(bytes.NewReader(raw))

	var body struct {
		Email   string `json:"email"`
		LoginID string `json:"login_id"`
	}
	if err := json.Unmarshal(raw, &body); err != nil {
		return ""
	}
	if body.LoginID != "" {
		return "lid:" + strings.ToLower(strings.TrimSpace(body.LoginID))
	}
	if body.Email != "" {
		return "email:" + strings.ToLower(strings.TrimSpace(body.Email))
	}
	return ""
}

func (l *LoginLimiter) blocked(id string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	rec, ok := l.attempts[id]
	if !ok {
		return false
	}
	if !rec.blockedAt.IsZero() {
		if time.Since(rec.blockedAt) < lockout {
			return true
		}
		delete(l.attempts, id) // lockout served
	}
	return false
}

func (l *LoginLimiter) recordFailure(id string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	rec, ok := l.attempts[id]
	if !ok || time.Since(rec.firstSeen) > failureWindow {
		l.attempts[id] = &attemptRecord{failures: 1, firstSeen: time.Now()}
		return
	}
	rec.failures++
	if rec.failures >= maxFailures {
		rec.blockedAt = time.Now()
	}
}

func (l *LoginLimiter) reset(id string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.attempts, id)
}

// reap discards records that are past both their window and their lockout, so
// the map does not grow without bound.
func (l *LoginLimiter) reap() {
	for range time.Tick(failureWindow) {
		l.mu.Lock()
		for id, rec := range l.attempts {
			expired := time.Since(rec.firstSeen) > failureWindow
			unlocked := rec.blockedAt.IsZero() || time.Since(rec.blockedAt) > lockout
			if expired && unlocked {
				delete(l.attempts, id)
			}
		}
		l.mu.Unlock()
	}
}
