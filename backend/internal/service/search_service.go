package service

import (
	"context"
	"strings"

	"gorm.io/gorm"

	"github.com/sunnystars/backend/internal/dto"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/apperr"
)

// perGroup caps each result group so the palette stays readable and one
// popular term cannot pull thousands of rows.
const perGroup = 5

type SearchService struct {
	db   *gorm.DB
	subs *SubscriptionService
}

func NewSearchService(db *gorm.DB, subs *SubscriptionService) *SearchService {
	return &SearchService{db: db, subs: subs}
}

// Search backs the admin ⌘K palette.
//
// One round trip instead of the four the client used to fan out, and the
// results respect the caller's plan: a nursery without the payments module
// never sees invoices in the palette.
//
// Every query runs on the request context, so the tenancy callbacks scope it
// automatically — there is no nursery predicate to forget here.
func (s *SearchService) Search(ctx context.Context, nurseryID uint64, term string) (*dto.SearchResults, error) {
	term = strings.TrimSpace(term)
	if len(term) < 2 {
		return &dto.SearchResults{}, nil
	}
	like := "%" + term + "%"
	out := &dto.SearchResults{}

	var children []model.Child
	if err := s.db.WithContext(ctx).
		Preload("Classroom").
		Where("first_name LIKE ? OR last_name LIKE ? OR CONCAT(first_name, ' ', last_name) LIKE ?", like, like, like).
		Limit(perGroup).Find(&children).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	for i := range children {
		room := ""
		if children[i].Classroom != nil {
			room = children[i].Classroom.Name
		}
		out.Children = append(out.Children, dto.SearchHit{
			ID:    children[i].ID,
			Label: children[i].FirstName + " " + children[i].LastName,
			Sub:   room,
		})
	}

	var users []model.User
	if err := s.db.WithContext(ctx).
		Where("(name LIKE ? OR email LIKE ? OR login_id LIKE ?) AND role <> ?", like, like, like, model.RoleSuperAdmin).
		Limit(perGroup * 2).Find(&users).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	for i := range users {
		hit := dto.SearchHit{ID: users[i].ID, Label: users[i].Name, Sub: users[i].Email}
		if users[i].Role == model.RoleParent {
			out.Parents = append(out.Parents, hit)
		} else {
			out.Staff = append(out.Staff, hit)
		}
	}

	var rooms []model.Classroom
	if err := s.db.WithContext(ctx).
		Where("name LIKE ? OR room_location LIKE ?", like, like).
		Limit(perGroup).Find(&rooms).Error; err != nil {
		return nil, apperr.Internal(err)
	}
	for i := range rooms {
		out.Classrooms = append(out.Classrooms, dto.SearchHit{
			ID: rooms[i].ID, Label: rooms[i].Name, Sub: rooms[i].AgeGroup,
		})
	}

	// Invoices only when the plan includes billing, so the palette never
	// surfaces a module the API would refuse to open.
	if ok, err := s.subs.HasCapability(ctx, nurseryID, model.CapPayments); err == nil && ok {
		var invoices []model.Invoice
		if err := s.db.WithContext(ctx).
			Where("invoice_no LIKE ?", like).
			Limit(perGroup).Find(&invoices).Error; err != nil {
			return nil, apperr.Internal(err)
		}
		for i := range invoices {
			out.Invoices = append(out.Invoices, dto.SearchHit{
				ID: invoices[i].ID, Label: invoices[i].InvoiceNo, Sub: string(invoices[i].Status),
			})
		}
	}

	return out, nil
}
