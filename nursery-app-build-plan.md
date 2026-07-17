# Sunny Stars — Nursery / Childcare Management Platform
## Complete Build Plan (Backend · Admin · Mobile)

---

## 1. Product Overview

A multilingual childcare platform that connects **parents**, **teachers**, and **administrators** around each child's daily life. Parents see real-time updates (diary, meals, sleep, diaper, health, milestones), receive announcements and reminders, RSVP to events, pay invoices, and interact in a parent community. Teachers log daily activities and reports. Admins manage everything: users, children, classrooms, content, translations, payments, and notifications.

### Core principles
- **Dynamic multilingual** — UI strings *and* database content are translatable; admins add languages/translations without a redeploy. Full RTL support (Arabic/Hebrew).
- **Role-based** — admin, teacher, parent, each with a tailored experience.
- **One parent → many children**, and one child → many guardians.
- **Pluggable file storage** — switch between local disk and S3 from the admin panel.
- **Push-first** — OneSignal across mobile and web.
- **Config in `.env`** — no secrets in code.

---

## 2. Feature Map (derived from the 20 screens)

| # | Module | Parent | Teacher | Admin |
|---|--------|:--:|:--:|:--:|
| 1 | **Home / Dashboard** (status, today-at-a-glance, quick access, attendance actions) | ✓ | ✓ | ✓ |
| 2 | **Daily Diary / Timeline** (chronological events + photos + teacher note) | view | create | manage |
| 3 | **Feed** (meals, appetite %, hydration, weekly overview) | view | log | manage |
| 4 | **Weekly Meals** (menu per day, "Eats it / Sometimes / Doesn't eat") | rate | plan | plan |
| 5 | **Sleep / Nap** (duration, stages, quality %, history) | view | log | manage |
| 6 | **Diaper** (wet/dry/stool type, comfort, daily summary, stool guide) | view | log | manage |
| 7 | **Health** (allergies, blood type, temp, illness log, meds, immunizations, checkups, growth, emergency contacts, insurance, documents) | view | log | manage |
| 8 | **Milestones & Achievements** (skill progress %, achievement badges) | view | assess | manage |
| 9 | **Daily Report** (care summary + development ratings + highlight + home tips) | view | create | manage |
| 10 | **Classroom** (room info, schedule, teachers, friends, classroom updates) | view | post | manage |
| 11 | **Weekly Overview** (learning focus, weekly activities, values) | view | plan | plan |
| 12 | **Events** (upcoming/previous, RSVP yes/maybe/no, photos, feedback) | RSVP | create | manage |
| 13 | **Messages / Announcements** (admin broadcasts, read receipts, attachments) | read | send | send |
| 14 | **Community** (parent posts, photos, comments, likes, meetups/RSVP) | post | moderate | moderate |
| 15 | **What to Bring / Reminders** (weather-aware + general reminders) | view | create | manage |
| 16 | **Payments** (invoices, line items, history, Swish gateway) | pay | — | manage |
| 17 | **Notifications** (push + in-app center, categorized) | ✓ | ✓ | ✓ |
| 18 | **Attendance** (check-in/out, absent / late / early pickup) | request | confirm | manage |

---

## 3. High-Level Architecture

```
                         ┌─────────────────────────┐
                         │   OneSignal (push)       │
                         │   Swish (payments)       │
                         │   S3 / Local (media)     │
                         │   Weather API (reminders)│
                         └────────────▲────────────┘
                                      │
┌──────────────┐   REST/JSON   ┌──────┴───────────────┐   ┌──────────────┐
│ Mobile (Expo)│◀────────────▶│  Go API (Echo + GORM) │◀─▶│   MySQL 8    │
│ React Native │   JWT auth    │  handler/service/model│   └──────────────┘
└──────────────┘               └──────▲────────────────┘
                                      │
┌──────────────┐   REST/JSON          │
│ Admin (React)│◀─────────────────────┘
│ Vite + TS    │
└──────────────┘
```

- **Single Go API** serves both the admin panel and the mobile app. Role and permission checks happen in middleware.
- **Stateless auth** via JWT (access + refresh). Refresh tokens stored hashed in DB for revocation.
- **Media** served behind a storage abstraction (local or S3) selectable at runtime.

---

## 4. Tech Stack

### 4.1 Backend — Go
| Concern | Choice |
|---|---|
| HTTP framework | **Echo v4** |
| ORM | **GORM** (MySQL driver) |
| DB | **MySQL 8** |
| Auth | JWT (`golang-jwt/jwt`), bcrypt password hashing |
| Validation | `go-playground/validator` |
| Config | `.env` via `joho/godotenv` + `caarlos0/env` |
| Migrations | `golang-migrate` (versioned SQL) — **don't rely on GORM AutoMigrate in prod** |
| Storage | Interface with `local` + `s3` (`aws-sdk-go-v2`) implementations |
| Push | OneSignal REST API client |
| Logging | `zerolog` (structured) |
| Background jobs | `robfig/cron` for scheduled reminders/invoices/digests |
| Docs | `swaggo/swag` (OpenAPI) |
| Testing | stdlib `testing` + `testify` |

### 4.2 Admin — React
React 18 · TypeScript · **Vite** · **TailwindCSS 3** · **Zustand** (client state) · **React Query / TanStack Query** (server state) · **React Hook Form + Zod** (validation everywhere) · **react-i18next** (UI i18n) · React Router · Axios · Recharts (dashboards) · `react-dropzone` (uploads).

### 4.3 Mobile — React Native
**Expo (SDK, managed workflow)** · TypeScript · Expo Router · React Query · Zustand · **i18next + expo-localization** · `onesignal-expo-plugin` · `expo-image-picker` · `expo-secure-store` (tokens) · React Native Paper or NativeWind for styling · `react-native-reanimated` for the rich animated cards in the designs.

---

## 5. Multilingual / Dynamic Language Strategy

This is treated as a first-class feature, in two layers.

### Layer A — Static UI strings (labels, buttons)
- `i18next` on both admin and mobile.
- JSON namespaces per language (`en.json`, `ar.json`, `sv.json`, …).
- Optionally fetch bundles from the API (`GET /i18n/{locale}`) so admins can edit UI strings live without an app release.

### Layer B — Dynamic content (DB-stored, admin-editable)
Any user-facing content that admins/teachers author (meal names, event titles, message bodies, milestone descriptions, reminder text, classroom names, achievement titles) is translatable.

**Recommended pattern — translation table per translatable entity** (clean and queryable):

```
meals(id, calories, image_id, created_at, ...)            -- non-translatable columns
meal_translations(id, meal_id, locale, name, description) -- one row per language
UNIQUE(meal_id, locale)
```

A generic helper resolves the requested locale with fallback:
`requested locale → default locale → first available`.

**Locale management table** lets admins add languages dynamically:
```
locales(code, name, native_name, direction['ltr'|'rtl'], is_active, is_default, sort_order)
```

### Request flow
- Client sends `Accept-Language` header (or `?locale=`).
- Middleware resolves an active locale (falls back to default).
- Repositories preload the matching `*_translations` rows.
- Responses return content already localized; a `direction` flag drives RTL in the UI.

### RTL
- Admin: Tailwind `dir` attribute on `<html>`, logical properties / `rtl:` variants.
- Mobile: `I18nManager.forceRTL()` on locale change, restart prompt when toggling LTR↔RTL.

---

## 6. Database Schema (MySQL)

> Conventions: `id` BIGINT PK, `created_at`/`updated_at`/`deleted_at` (soft delete) on most tables, FK indexes everywhere. `*_translations` tables omitted from the list below for brevity but exist for every translatable entity (marked 🌐).

### Identity & roles
- **users** — id, name, email (unique), phone, password_hash, role `enum('admin','teacher','parent')`, locale, avatar_id, status, last_login_at.
- **refresh_tokens** — id, user_id, token_hash, expires_at, revoked_at, device_info.
- **device_tokens** — id, user_id, onesignal_player_id, platform, locale, last_seen_at. *(for push targeting)*
- **permissions / role_permissions** *(optional fine-grained layer over the 3 base roles)*.

### Children & relationships
- **children** — id, first_name, last_name, dob, gender, blood_type, avatar_id, classroom_id, status, checked_in_at, present_status.
- **guardians** (parent↔child M:N) — id, parent_user_id, child_id, relationship `enum('mother','father','guardian',...)`, is_primary, can_pickup.
- **classrooms** 🌐 — id, name, room_location, age_group, capacity, opens_at, closes_at, image_id.
- **classroom_teachers** — id, classroom_id, teacher_user_id, role `enum('lead','assistant')`.
- **child_friends** — id, child_id, friend_child_id. *(the "Friends" section)*

### Daily care logs
- **diary_entries** — id, child_id, type `enum('meal','sleep','activity','diaper','note','photo')`, title, body, occurred_at, logged_by_user_id, is_live. 🌐(title/body)
- **diary_media** — id, diary_entry_id, media_id, sort.
- **meal_logs** — id, child_id, meal_type `enum('breakfast','lunch','snack','dinner')`, status `enum('ate_well','ate_half','ate_little','didnt_eat')`, served_at, note, image_id.
- **hydration_logs** — id, child_id, date, cups, rating.
- **weekly_menus** 🌐 — id, classroom_id, date, meal_type, dish_name, items_json, is_balanced, image_id.
- **menu_ratings** — id, weekly_menu_id, child_id, rating `enum('eats','sometimes','doesnt_eat')`.
- **sleep_logs** — id, child_id, start_at, end_at, total_minutes, quality_pct, mood_after, deep_min, light_min, awake_min, took_to_sleep_min.
- **diaper_logs** — id, child_id, time, wetness `enum('dry','wet','heavy')`, stool `enum('none','hard','normal','soft','loose','diarrhea')`, comfort `enum('happy','fussy')`, note.

### Health
- **health_profiles** — id, child_id, blood_type, last_updated_at.
- **allergies** 🌐 — id, child_id, name, severity `enum('mild','moderate','severe')`.
- **illness_logs** 🌐 — id, child_id, title, status `enum('active','recovered','resolved')`, temperature, date, note.
- **medications** 🌐 — id, child_id, name, dosage, schedule, start_date, end_date, active.
- **immunizations** 🌐 — id, child_id, vaccine, given_date, next_due_date, status.
- **checkups** 🌐 — id, child_id, type, date, outcome, doctor.
- **growth_records** — id, child_id, date, height_cm, weight_kg, head_circ_cm.
- **vital_logs** — id, child_id, date, temperature, mood, energy, appetite, sleep_summary.
- **emergency_contacts** — id, child_id, name, relation, phone, priority.
- **insurance_info** — id, child_id, provider, policy_no, status, valid_until.
- **medical_documents** — id, child_id, media_id, title, kind.
- **health_notes** 🌐 — id, child_id, title, body, authored_by.

### Development
- **milestone_categories** 🌐 — id, name, description, color, icon. *(Communication, Problem Solving, …)*
- **child_milestones** — id, child_id, category_id, progress_pct, description, status, assessed_by, assessed_at. 🌐(description)
- **achievement_templates** 🌐 — id, title, description, icon, color. *(Kind Helper, Super Listener, …)*
- **child_achievements** — id, child_id, achievement_template_id, awarded_date, note.

### Reports
- **daily_reports** — id, child_id, date, summary, highlight_text, highlight_media_id, home_tips_json, created_by. 🌐(summary/highlight/tips)
- **report_ratings** — id, daily_report_id, dimension `enum('social','participation','listening','focus','hygiene','eating',...)`, rating `enum('thriving','doing_well','improving','needs_support')`, note.

### Engagement
- **events** 🌐 — id, title, description, location, lat, lng, audience, starts_at, ends_at, cover_media_id, status `enum('upcoming','completed','cancelled')`.
- **event_rsvps** — id, event_id, user_id, child_id, response `enum('yes','maybe','no')`.
- **event_media** — id, event_id, media_id, caption, child_id (optional tag).
- **event_feedback** — id, event_id, user_id, loved bool, comment.
- **announcements** 🌐 — id, title, body, category `enum('updates','reminders','events','health','general')`, badge, published_at, created_by.
- **announcement_media / announcement_attachments** — id, announcement_id, media_id.
- **announcement_reads** — id, announcement_id, user_id, read_at, acknowledged_at. *("Got it")*
- **community_posts** — id, author_user_id, type `enum('moment','activity')`, body, child_id, created_at. 🌐(body for activities)
- **community_post_media** — id, post_id, media_id, sort.
- **community_comments** — id, post_id, author_user_id, body, created_at.
- **community_likes** — id, post_id, user_id.
- **meetups** — id, post_id, title, location, lat, lng, starts_at.
- **meetup_rsvps** — id, meetup_id, user_id, response `enum('going','interested')`.
- **reminders** 🌐 — id, scope `enum('global','classroom','child')`, scope_id, title, description, date, items_json, kind `enum('upcoming','general')`, weather_alert bool, icon.

### Attendance & ops
- **attendance** — id, child_id, date, status `enum('present','absent','late','early_pickup')`, checked_in_at, checked_out_at, note, requested_by.
- **classroom_schedule** 🌐 — id, classroom_id, date(or weekday), time, title, description, icon, color. *(Circle Time, Art Activity, …)*
- **weekly_overview** 🌐 — id, classroom_id, week_start, focus_json, activities_json, values_json, teacher_note.

### Payments
- **invoices** — id, child_id, payer_user_id, invoice_no (unique), currency, total, due_date, status `enum('paid','due','overdue','cancelled')`, period.
- **invoice_items** 🌐 — id, invoice_id, label, amount. *(Tuition, Meal Plan, Transportation)*
- **payments** — id, invoice_id, provider `enum('swish',...)`, provider_ref, amount, status, paid_at, raw_payload_json.

### Platform
- **media** — id, disk `enum('local','s3')`, path, url, mime, size, width, height, uploaded_by.
- **locales** — code, name, native_name, direction, is_active, is_default, sort_order.
- **ui_translations** — id, locale, namespace, key, value. *(Layer A, optional live UI strings)*
- **settings** — key (unique), value_json. *(storage driver, default locale, feature flags, OneSignal app id, etc.)*
- **notifications** — id, user_id, category, title, body, data_json, read_at, sent_at. *(in-app center)*
- **audit_logs** — id, actor_user_id, action, entity, entity_id, diff_json, ip, created_at.

---

## 7. Backend Project Structure (Go)

Your requested `handler / service / model` layout, extended with the supporting packages a production API needs.

```
backend/
├── cmd/
│   └── api/main.go                 # entrypoint: load env, wire deps, start Echo
├── internal/
│   ├── config/                     # .env loading + typed Config struct
│   ├── model/                      # GORM models (one file per domain group)
│   │   ├── user.go
│   │   ├── child.go
│   │   ├── health.go
│   │   ├── payment.go
│   │   └── ...
│   ├── handler/                    # Echo handlers — HTTP only, no business logic
│   │   ├── auth_handler.go
│   │   ├── child_handler.go
│   │   ├── diary_handler.go
│   │   ├── payment_handler.go
│   │   └── ...
│   ├── service/                    # business logic, transactions, orchestration
│   │   ├── auth_service.go
│   │   ├── diary_service.go
│   │   ├── notification_service.go
│   │   ├── payment_service.go
│   │   └── ...
│   ├── repository/                 # GORM queries (keeps services DB-agnostic)
│   ├── middleware/                 # JWT, role guard, locale resolver, request-id, recover, CORS
│   ├── dto/                        # request/response structs + validation tags
│   ├── storage/                    # Storage interface + local + s3 impls
│   │   ├── storage.go              # interface: Put, Get, Delete, URL
│   │   ├── local.go
│   │   └── s3.go
│   ├── notification/               # OneSignal client
│   ├── payment/                    # Swish client + webhook handling
│   ├── i18n/                       # locale resolver + translation helpers
│   ├── job/                        # cron jobs (reminders, invoice generation, digests)
│   └── pkg/                        # shared helpers (jwt, hash, response, errors, pagination)
├── migrations/                     # golang-migrate .up.sql / .down.sql
├── docs/                           # swagger
├── .env.example
├── go.mod
└── Makefile                        # run, migrate, seed, test, lint
```

**Layering rule:** `handler → service → repository → model`. Handlers never touch the DB directly; services own transactions.

### Storage abstraction (the local/S3 toggle)
```go
type Storage interface {
    Put(ctx, key string, r io.Reader, mime string) (Media, error)
    Delete(ctx, key string) error
    URL(key string) string
}
```
At startup the app reads `STORAGE_DRIVER` (or the `settings` row, which the admin can change live) and returns either `LocalStorage` or `S3Storage`. Handlers always call the interface, so switching providers requires zero handler changes. Each uploaded file records its `disk` so old local files keep resolving after a switch.

---

## 8. API Surface (representative)

Base path `/api/v1`. All non-auth routes require `Authorization: Bearer <token>`; locale via `Accept-Language`.

**Auth** — `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `PUT /auth/locale`.

**Children** — `GET /children` (scoped to caller's role), `GET /children/:id`, `GET /children/:id/dashboard` (home aggregate), `GET /children/:id/timeline`.

**Care logs** — `GET|POST /children/:id/meals`, `/sleep`, `/diaper`, `/hydration`; `GET /children/:id/feed/weekly`, `/sleep/history`, `/diaper/history`.

**Health** — `GET /children/:id/health` (full profile), plus sub-resources `/allergies`, `/illnesses`, `/medications`, `/immunizations`, `/checkups`, `/growth`, `/emergency-contacts`, `/documents`.

**Development** — `GET /children/:id/milestones`, `GET /children/:id/achievements`, `GET|POST /children/:id/reports`.

**Classroom** — `GET /classrooms/:id`, `/:id/schedule`, `/:id/teachers`, `/:id/updates`, `GET /children/:id/friends`.

**Meals planning** — `GET /classrooms/:id/menu?week=`, `POST /menu/:id/ratings`.

**Events** — `GET /events`, `GET /events/:id`, `POST /events/:id/rsvp`, `GET /events/:id/media`, `POST /events/:id/feedback`.

**Messages** — `GET /announcements?tab=all|unread|archived`, `GET /announcements/:id`, `POST /announcements/:id/ack`, (admin) `POST /announcements`.

**Community** — `GET|POST /community/posts`, `POST /posts/:id/comments`, `POST /posts/:id/like`, `POST /meetups/:id/rsvp`.

**Reminders** — `GET /reminders?scope=`, (teacher/admin) `POST /reminders`.

**Attendance** — `POST /children/:id/attendance` (parent: absent/late/early-pickup request), (teacher) `POST /attendance/:id/confirm`.

**Payments** — `GET /invoices`, `GET /invoices/:id`, `POST /invoices/:id/pay` (returns Swish redirect/token), `POST /webhooks/swish` (no auth, signature-verified).

**Notifications** — `GET /notifications`, `POST /notifications/read-all`, `POST /devices` (register OneSignal player id).

**Media** — `POST /media` (multipart upload → storage driver), `DELETE /media/:id`.

**Admin/platform** — `GET|POST|PUT|DELETE /admin/users`, `/admin/children`, `/admin/classrooms`, `/admin/locales`, `/admin/translations`, `/admin/settings`, `GET /admin/audit-logs`.

> Every list endpoint supports `?page=&per_page=&search=&sort=` and returns a consistent `{ data, meta }` envelope.

---

## 9. Admin Panel Structure (React + Vite + TS)

```
admin/
├── src/
│   ├── main.tsx
│   ├── App.tsx                  # router + providers (QueryClient, i18n)
│   ├── lib/
│   │   ├── api.ts               # axios instance + interceptors (token refresh)
│   │   └── queryClient.ts
│   ├── store/                   # Zustand: authStore, uiStore (theme, sidebar, locale)
│   ├── hooks/                   # useChildren, useInvoices, useAuth (React Query wrappers)
│   ├── components/              # Table, Modal, FormField, FileUpload, StatCard, ...
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── children/
│   │   ├── users/               # teachers, parents, admins
│   │   ├── classrooms/
│   │   ├── care/                # meals, sleep, diaper, health
│   │   ├── reports/
│   │   ├── milestones/
│   │   ├── events/
│   │   ├── announcements/
│   │   ├── community/           # moderation
│   │   ├── reminders/
│   │   ├── payments/
│   │   ├── notifications/       # compose + send via OneSignal
│   │   ├── locales/             # add languages, edit translations (Layer A & B)
│   │   └── settings/            # storage driver toggle, OneSignal keys, defaults
│   ├── schemas/                 # Zod schemas (shared with forms)
│   └── i18n/                    # react-i18next setup + json bundles
├── .env.example                 # VITE_API_URL, VITE_ONESIGNAL_APP_ID, ...
├── tailwind.config.ts
└── vite.config.ts
```

### Conventions
- **Forms:** every form uses `react-hook-form` + `zodResolver`. Define each schema once in `schemas/` and reuse it for typing the request payload — no duplicated validation.
- **Server state:** all reads/writes go through React Query hooks; mutations invalidate the relevant query keys. No data fetching inside components directly.
- **Client state:** Zustand only for auth/session, UI prefs, and locale/direction.
- **Translations UI:** a dedicated screen lists translatable entities; for each row, tabs per active locale let admins fill `name`/`description`. New languages added in `locales` immediately appear as tabs.
- **Storage toggle:** Settings → Media → choose `Local` or `S3`, with S3 fields (bucket, region, keys) revealed only when S3 is selected. Saving writes to `settings` and the backend picks it up.

---

## 10. Mobile App Structure (React Native + Expo)

```
mobile/
├── app/                         # Expo Router (file-based)
│   ├── (auth)/login.tsx
│   ├── (tabs)/
│   │   ├── home.tsx
│   │   ├── diary.tsx
│   │   ├── overview.tsx
│   │   ├── messages.tsx
│   │   └── more.tsx
│   ├── child/[id]/health.tsx
│   ├── child/[id]/feed.tsx
│   ├── child/[id]/sleep.tsx
│   ├── child/[id]/diaper.tsx
│   ├── child/[id]/milestones.tsx
│   ├── events/[id].tsx
│   ├── payments/index.tsx
│   └── ...
├── src/
│   ├── api/                     # axios + React Query hooks (shared shape with admin)
│   ├── store/                   # Zustand: auth, activeChild, locale
│   ├── components/              # cards matching the designs (StatusBanner, TimelineItem, ProgressCard, BadgeCard)
│   ├── i18n/                    # i18next + expo-localization, RTL handling
│   ├── theme/                   # colors/typography from the purple design system
│   └── lib/secureStore.ts       # tokens in expo-secure-store
├── app.config.ts                # OneSignal plugin, env via expo-constants
└── .env (via app.config extra)
```

### Key behaviours
- **Child switcher** in the header (a parent with multiple children picks the active one; `activeChild` in Zustand scopes all queries).
- **OneSignal**: register the player id after login (`POST /devices`); tags include `user_id`, `role`, `locale` for targeted sends. Deep links route notification taps to the right screen.
- **Offline-friendly reads** via React Query cache + `persistQueryClient`.
- **Design fidelity**: the screens are animation-rich (progress rings, timelines, banners) — use `reanimated` and `svg` for the rings/charts seen in Sleep, Feed, and Milestones.

---

## 11. Roles & Permissions

| Capability | Parent | Teacher | Admin |
|---|:--:|:--:|:--:|
| View own/assigned children | own | classroom | all |
| Log care (meals/sleep/diaper/health) | — | ✓ | ✓ |
| Create diary entries & reports | — | ✓ | ✓ |
| Assess milestones / award achievements | — | ✓ | ✓ |
| RSVP events, rate meals, pay invoices | ✓ | — | — |
| Post in community | ✓ | ✓ (moderate) | ✓ (moderate) |
| Send announcements / push | — | classroom | all |
| Manage users / classrooms / locales / settings | — | — | ✓ |
| View payments & generate invoices | own | — | ✓ |

Enforced by two middlewares: **`RequireRole(...)`** for coarse gating and **resource-ownership checks** in services (e.g. a parent can only read children they're a guardian of; a teacher only children in their classrooms).

---

## 12. Notifications (OneSignal)

- **Device registration:** mobile registers OneSignal player id post-login → `device_tokens`.
- **Sending:** `notification_service` calls the OneSignal REST API with localized title/body (resolved from the recipient's `locale`) and a `data` payload for deep-linking. Every send is also written to `notifications` for the in-app center (the categorized list: Updates / Reminders / Events / Messages).
- **Triggers:** new diary update, daily report ready, new announcement, event reminder, "what to bring tomorrow", invoice due / overdue, community reply.
- **Categories & preferences:** users can mute categories; respected before send.
- **Keys** (`ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY`) live in `.env` / `settings`.

---

## 13. Payments (Swish)

- Admin generates monthly **invoices** with line items (Tuition, Meal Plan, Transportation) → status `due`.
- Parent taps **Pay Now** → backend creates a Swish payment request, returns the token/redirect.
- **Webhook** (`POST /webhooks/swish`) verifies signature, updates `payments` + flips invoice to `paid`, fires a confirmation push.
- Cron job marks overdue invoices and sends reminders.
- Architecture keeps `payment/` provider-agnostic so a second gateway (card/local Lebanese provider) can be added later without touching handlers.

> Note: the mockups show SEK + Swish (a Swedish setup). Keep `currency` on invoices configurable so the same code serves other regions.

---

## 14. Security

- bcrypt password hashing; JWT access (~15 min) + rotating refresh tokens (revocable via `refresh_tokens`).
- Role + ownership checks on every resource.
- Input validation on all DTOs; parameterized queries via GORM (no raw concatenation).
- Rate limiting on auth + public webhook endpoints.
- Signed/expiring URLs for private media on S3; access-checked streaming for local.
- CORS locked to known origins; security headers; HTTPS only.
- Webhook signature verification; secrets only in `.env`.
- `audit_logs` for all admin mutations; soft deletes for recoverability.
- PII (health data) access logged and restricted to authorized guardians/teachers.

---

## 15. Environment Variables (`.env.example`)

```env
# App
APP_ENV=production
APP_PORT=8080
APP_URL=https://api.sunnystars.app
DEFAULT_LOCALE=en

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=nursery
DB_USER=nursery
DB_PASSWORD=change-me

# Auth
JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=720h

# Storage  (local | s3)  — also overridable from admin settings
STORAGE_DRIVER=local
LOCAL_UPLOAD_DIR=./uploads
S3_BUCKET=
S3_REGION=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_ENDPOINT=          # optional (for S3-compatible providers)

# OneSignal
ONESIGNAL_APP_ID=
ONESIGNAL_API_KEY=

# Swish
SWISH_MERCHANT_ID=
SWISH_CERT_PATH=
SWISH_CALLBACK_URL=https://api.sunnystars.app/api/v1/webhooks/swish

# Integrations
WEATHER_API_KEY=      # weather-aware "What to Bring" reminders
```

Admin (`VITE_API_URL`, `VITE_ONESIGNAL_APP_ID`) and mobile (`app.config.ts` extra) keep their own public-only env entries.

---

## 16. Delivery Roadmap

**Phase 0 — Foundations (week 1–2)**
Repos, CI, `.env`, Echo skeleton, GORM + migrations, JWT auth, role middleware, storage abstraction (local first), locale/i18n plumbing, base admin + Expo shells with auth flow.

**Phase 1 — Core child data (week 3–4)**
Users, children, guardians (parent↔many children), classrooms, attendance. Admin CRUD + mobile home/dashboard + child switcher.

**Phase 2 — Daily care (week 5–6)**
Diary timeline, meals/feed, sleep, diaper, weekly menus + ratings. Teacher logging in admin; parent views on mobile.

**Phase 3 — Health & development (week 7–8)**
Full health module, milestones, achievements, daily reports.

**Phase 4 — Engagement (week 9–10)**
Events + RSVP + albums, announcements/messages + read receipts, community feed, reminders (incl. weather), notification center.

**Phase 5 — Notifications & payments (week 11–12)**
OneSignal end-to-end, Swish invoices + webhook, scheduled jobs (reminders, invoice generation, digests).

**Phase 6 — Multilingual hardening + S3 + polish (week 13–14)**
Dynamic translations UI, add Arabic + RTL, S3 driver + admin toggle, audit logs, performance, security pass, store submission.

---

## 17. Deployment

- **Backend:** Dockerized Go binary behind Nginx/Traefik; MySQL managed instance; migrations run on deploy via `golang-migrate`. Local uploads on a persistent volume, or S3 for scale.
- **Admin:** static Vite build to a CDN / Nginx.
- **Mobile:** EAS Build → App Store / Play Store; OTA updates via Expo for non-native changes.
- **Observability:** structured logs, health endpoint, error tracking (e.g. Sentry on all three apps).

---

### Suggested next step
Pick the phase you want to start with and I can scaffold it — e.g. generate the Go module layout with the storage interface and JWT auth wired up, the GORM models + first migration, or the admin/Expo project skeletons.
