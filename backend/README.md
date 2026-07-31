# Little Talent Childcare API (Go)

Backend for the nursery/childcare platform — Echo v4 + GORM + MySQL 8.
Layering rule: `handler → service → repository → model`. Handlers never touch
the DB; services own business rules, authorization, and transactions.

## Implemented (all backend phases 0–6)

**Phase 0/1 — Foundation & core data**
- JWT auth (15-min HS256 access tokens, algorithm pinned) + opaque rotating
  refresh tokens stored as SHA-256 hashes with **reuse detection** (a replayed
  rotated token revokes every session for that user).
- Forgot/reset password with no user enumeration; resets revoke all sessions.
- RBAC (`RequireRole`) + per-row ownership: parents only reach children they
  are guardians of, teachers only their classrooms' children. Unauthorized
  child access returns 404, never 403.
- Users (admin CRUD), children + guardians (M:N), classrooms (+ translations,
  teacher assignment), attendance (parent requests, teacher confirm/check-in).
- Media: pluggable `local`/`s3` storage, content-type sniffing, random keys,
  traversal-safe local driver, auth-checked streaming.

**Phase 2 — Daily care**
- Diary/timeline with photos, meal logs, sleep logs (duration validated),
  diaper logs, hydration upserts, weekly classroom menus + parent ratings,
  and the `GET /children/:id/dashboard` home aggregate.

**Phase 3 — Health & development**
- Full health module (allergies, illnesses, medications, immunizations,
  checkups, growth, vitals, emergency contacts, insurance, documents, notes)
  via a generic, mass-assignment-guarded CRUD path; `GET /children/:id/health`
  aggregate. Health profile reads are themselves audit-logged (PII).
- Milestone categories + per-child assessments, achievement templates +
  awards, daily reports with development ratings and home tips.

**Phase 4 — Engagement**
- Events (tabs, RSVP, feedback, photo album), announcements (read receipts +
  "Got it" acknowledgements, unread tab), community (posts, comments, likes,
  meetups + RSVP, author-or-staff moderation), scoped reminders
  (global/classroom/child), in-app notification center + unread count.

**Phase 5 — Push & payments**
- OneSignal client (batched player-id sends); every notification also lands
  in the in-app center. Device registration (`POST /devices`).
- Invoices in **minor units** (no float money), line items, payer defaulting
  to the primary guardian. Provider-agnostic gateway interface with Swish
  (mTLS) + mock (dev) + disabled (prod fallback) implementations.
- **Webhook hardening:** callback bodies are untrusted — only the reference
  is read, then the authoritative status is fetched from the gateway before
  any state change. Settlements are idempotent.
- Cron jobs: overdue invoice marking, expired token cleanup, event reminders,
  daily "what to bring" pushes.

**Phase 6 — Multilingual & platform**
- Locale management (admin add/edit/delete, single default enforced, RTL flag,
  cache invalidation).
- Layer A: live UI string bundles — `GET /i18n/:locale`.
- Layer B: generic `content_translations` for whitelisted entities/fields;
  events, announcements, and reminders are localized server-side from
  `Accept-Language`.
- Whitelisted settings store (never a secret store), audit log browser.

## Getting started

```sh
# 1. Configure
cp .env.example .env        # fill DB credentials + generate JWT secrets:
#    openssl rand -base64 48   (twice — access and refresh must differ)

# 2. Create the database
mysql -u root -p -e "CREATE DATABASE nursery CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 3. Migrate (install golang-migrate once)
go install -tags 'mysql' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
make migrate-up

# 4. Seed the first admin (set SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD in .env)
make seed

# 5. Run
make run                    # http://localhost:8080/healthz
```

On Windows without `make`, run the commands directly (`go run ./cmd/api`,
`go run ./cmd/seed`, `migrate -path migrations -database "mysql://user:pass@tcp(localhost:3306)/nursery" up`).

Without OneSignal/Swish keys the API still runs: push becomes in-app-only and
payments use the mock gateway (development) or are disabled (production).

## Tests

```sh
go test ./... -count=1
```

Covers JWT issue/verify (expiry, wrong secret/issuer, garbage), bcrypt
round-trip + 72-byte rejection, token hashing, locale negotiation, and the
local storage driver (path traversal, overwrite protection).

## API map

Base path `/api/v1`; all routes except auth, `/i18n/:locale`, `/locales`, and
the Swish webhook require `Authorization: Bearer <access>`. Lists accept
`?page=&per_page=&search=&sort=` and return `{ data, meta }`.

| Area | Routes |
|---|---|
| Auth | `POST /auth/login` `/refresh` `/logout` `/forgot-password` `/reset-password`, `GET /auth/me`, `PUT /auth/locale` |
| i18n | `GET /locales`, `GET /i18n/:locale` |
| Children | `GET /children`, `GET /children/:id`, `GET /children/:id/dashboard`, `/timeline` |
| Care | `GET|POST /children/:id/diary` `/meals` `/sleep` `/diaper`, `GET|PUT /children/:id/hydration`, `GET|PUT /classrooms/:id/menu`, `POST /menu/:id/ratings` |
| Health | `GET /children/:id/health` + CRUD on `/allergies` `/illnesses` `/medications` `/immunizations` `/checkups` `/growth` `/vitals` `/emergency-contacts` `/insurance` `/documents` `/notes` |
| Development | `GET|PUT /children/:id/milestones`, `GET|POST /children/:id/achievements`, `GET|PUT /children/:id/reports`, template/category endpoints |
| Attendance | `GET|POST /children/:id/attendance`, `POST /attendance/:id/confirm`, `POST /children/:id/check` |
| Events | `GET /events?tab=`, `GET /events/:id`, `POST /events/:id/rsvp` `/feedback`, `GET|POST /events/:id/media` |
| Messages | `GET /announcements?tab=`, `GET /announcements/:id`, `POST /announcements/:id/ack`, staff `POST /announcements` |
| Community | `GET|POST /community/posts`, comments, like toggle, `POST /meetups/:id/rsvp` |
| Reminders | `GET /reminders`, staff `POST|DELETE /reminders` |
| Payments | `GET /invoices`, `GET /invoices/:id`, `POST /invoices/:id/pay`, `POST /webhooks/swish`, admin `POST /admin/invoices`, `/cancel` |
| Notifications | `GET /notifications`, `/unread-count`, `POST /notifications/read-all`, `POST /devices` |
| Admin | `/admin/users`, `/admin/children`, `/admin/classrooms`, `/admin/locales`, `/admin/translations/ui`, `/admin/translations/content`, `/admin/settings`, `/admin/audit-logs`, milestone/achievement templates |

## Next steps

The backend is feature-complete per `../nursery-app-build-plan.md`. Remaining
from the plan: the React admin panel, the Expo mobile app, swagger docs, and
deployment (Docker + CI).
