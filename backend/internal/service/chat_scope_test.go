package service

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/rs/zerolog"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
)

// chatTestDB returns a ChatService wired to a mocked database, plus the mock so
// each test can stage the conversation row the authorize check will load.
func chatTestDB(t *testing.T) (*ChatService, sqlmock.Sqlmock) {
	t.Helper()
	conn, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { conn.Close() })
	mock.MatchExpectationsInOrder(false)

	db, err := gorm.Open(mysql.New(mysql.Config{
		Conn:                      conn,
		SkipInitializeWithVersion: true,
	}), &gorm.Config{Logger: logger.Discard})
	if err != nil {
		t.Fatalf("gorm open: %v", err)
	}
	return NewChatService(db, NoopNotifier{}, nil, zerolog.Nop()), mock
}

// expectConversation stages the SELECT that authorize issues, returning a
// conversation between parent 10 and recipient 20.
func expectConversation(mock sqlmock.Sqlmock, convType model.ConversationType) {
	mock.ExpectQuery("SELECT \\* FROM `conversations`").
		WillReturnRows(sqlmock.NewRows([]string{"id", "type", "parent_user_id", "recipient_user_id"}).
			AddRow(1, string(convType), 10, 20))
}

func assertNotFound(t *testing.T, err error) {
	t.Helper()
	if err == nil {
		t.Fatal("expected an error, got nil — an outsider was allowed into the conversation")
	}
	ae := apperr.From(err)
	if ae.Code != apperr.CodeNotFound {
		t.Fatalf("code = %q, want %q (must not confirm the conversation exists)", ae.Code, apperr.CodeNotFound)
	}
}

// The vulnerability this fixes: conversation ids are sequential integers taken
// straight from the URL, so before the participant check any authenticated
// parent could read any other family's thread by guessing.
func TestGetMessagesRejectsNonParticipant(t *testing.T) {
	svc, mock := chatTestDB(t)
	expectConversation(mock, model.ConversationParentTeacher)

	// User 99 is a parent in neither slot of this conversation.
	_, err := svc.GetMessages(context.Background(), 1, 99, model.RoleParent, 1, 50)
	assertNotFound(t, err)
}

func TestSendMessageRejectsNonParticipant(t *testing.T) {
	svc, mock := chatTestDB(t)
	expectConversation(mock, model.ConversationParentTeacher)

	_, err := svc.SendMessage(context.Background(), 1, 99, model.RoleParent, "hello", nil)
	assertNotFound(t, err)

	// The message must never have been written.
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected writes on the rejected path: %v", err)
	}
}

func TestMarkAsReadRejectsNonParticipant(t *testing.T) {
	svc, mock := chatTestDB(t)
	expectConversation(mock, model.ConversationParentTeacher)

	assertNotFound(t, svc.MarkAsRead(context.Background(), 1, 99, model.RoleParent))
}

// A teacher who is not the recipient is just as much an outsider as a parent —
// the check is participation, not seniority.
func TestGetMessagesRejectsUnrelatedTeacher(t *testing.T) {
	svc, mock := chatTestDB(t)
	expectConversation(mock, model.ConversationParentTeacher)

	_, err := svc.GetMessages(context.Background(), 1, 77, model.RoleTeacher, 1, 50)
	assertNotFound(t, err)
}

// An admin must not reach a parent_teacher thread they are not part of; the
// collective-inbox exemption is limited to parent_admin conversations.
func TestGetMessagesRejectsAdminOnParentTeacherThread(t *testing.T) {
	svc, mock := chatTestDB(t)
	expectConversation(mock, model.ConversationParentTeacher)

	_, err := svc.GetMessages(context.Background(), 1, 55, model.RoleAdmin, 1, 50)
	assertNotFound(t, err)
}

// Admins staff the parent_admin queue collectively, so any admin may pick one
// up even though they are not the named recipient.
func TestAuthorizeAllowsAdminOnParentAdminThread(t *testing.T) {
	svc, mock := chatTestDB(t)
	expectConversation(mock, model.ConversationParentAdmin)

	conv, err := svc.authorize(context.Background(), 1, 55, model.RoleAdmin)
	if err != nil {
		t.Fatalf("admin denied their own parent_admin queue: %v", err)
	}
	if conv == nil || conv.ID != 1 {
		t.Fatalf("conv = %+v, want the loaded conversation", conv)
	}
}

// Both real participants must still get through.
func TestAuthorizeAllowsParticipants(t *testing.T) {
	for _, tc := range []struct {
		name   string
		userID uint64
		role   model.Role
	}{
		{"parent side", 10, model.RoleParent},
		{"recipient side", 20, model.RoleTeacher},
	} {
		t.Run(tc.name, func(t *testing.T) {
			svc, mock := chatTestDB(t)
			expectConversation(mock, model.ConversationParentTeacher)

			if _, err := svc.authorize(context.Background(), 1, tc.userID, tc.role); err != nil {
				t.Fatalf("participant denied: %v", err)
			}
		})
	}
}

// A missing conversation and an unauthorized one must be indistinguishable.
func TestAuthorizeMissingConversationIsNotFound(t *testing.T) {
	svc, mock := chatTestDB(t)
	mock.ExpectQuery("SELECT \\* FROM `conversations`").
		WillReturnRows(sqlmock.NewRows([]string{"id"}))

	_, err := svc.authorize(context.Background(), 404, 10, model.RoleParent)
	assertNotFound(t, err)
}
