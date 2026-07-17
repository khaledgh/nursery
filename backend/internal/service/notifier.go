package service

import "context"

// Notifier decouples domain services from the push/notification machinery.
// Implementations must be non-blocking (fire-and-forget) and never fail the
// calling request.
type Notifier interface {
	// NotifyGuardians pushes to every guardian of the child.
	NotifyGuardians(ctx context.Context, childID uint64, category, title, body string, data map[string]any)
	// NotifyUser pushes to one user.
	NotifyUser(ctx context.Context, userID uint64, category, title, body string, data map[string]any)
	// NotifyRole pushes to every active user with the role ("" = everyone).
	NotifyRole(ctx context.Context, role string, category, title, body string, data map[string]any)
}

// NoopNotifier is used until the OneSignal integration is configured.
type NoopNotifier struct{}

func (NoopNotifier) NotifyGuardians(context.Context, uint64, string, string, string, map[string]any) {
}
func (NoopNotifier) NotifyUser(context.Context, uint64, string, string, string, map[string]any) {}
func (NoopNotifier) NotifyRole(context.Context, string, string, string, string, map[string]any) {}
