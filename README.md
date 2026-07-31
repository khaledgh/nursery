# Little Talent Childcare — Nursery / Childcare Management Platform

A multilingual childcare platform connecting **parents**, **teachers**, and
**administrators** around each child's daily life. Built from
[nursery-app-build-plan.md](nursery-app-build-plan.md).

| App | Stack | Status |
|---|---|---|
| [backend/](backend/) | Go · Echo v4 · GORM · MySQL 8 | All phases (0–6) implemented: auth, RBAC + ownership, children/classrooms/attendance, daily care, health & development, engagement, OneSignal push, Swish payments, cron jobs, dynamic i18n, audit logs |
| [admin/](admin/) | React 19 · TypeScript · Vite · Tailwind · TanStack Query · Zustand · RHF + Zod · i18next | Staff panel: dashboard, users, children + guardians, classrooms + teachers + translations, care logging, announcements, events, reminders, invoices, languages/live UI strings, settings, audit logs. RTL-ready (en/sv/ar) |
| [mobile/](mobile/) | Expo SDK 56 · expo-router · React Query · Zustand · SecureStore · i18next | Parent app: login, child switcher, home dashboard, diary timeline, messages with "Got it", health profile, sleep/feed/diaper logs, milestones & achievements, events RSVP, invoices + pay. RTL-ready (en/sv/ar) |

## Quick start (development)

```sh
# 1. API — see backend/README.md for full steps
cd backend
cp .env.example .env       # set DB creds + two JWT secrets (openssl rand -base64 48)
make migrate-up && make seed && make run        # :8080

# 2. Admin panel
cd admin
cp .env.example .env       # VITE_API_URL=http://localhost:8080/api/v1
npm install && npm run dev                       # :5173

# 3. Mobile app (Expo Go)
cd mobile
npm install --legacy-peer-deps
# point extra.apiUrl in app.json at your machine's LAN IP, then:
npm start
```

Sign in to the admin panel with the seeded admin account, create a teacher, a
parent, a classroom, and a child with the parent as guardian — then log in as
that parent in the mobile app.

## Security highlights

- bcrypt(12) passwords; 15-min HS256 access JWTs (algorithm pinned) + rotating
  opaque refresh tokens stored hashed, with replay → revoke-all-sessions.
- Role middleware + per-row ownership scoping; unauthorized child access
  returns 404. Health (PII) reads are audit-logged.
- Payment webhooks never trust the payload — status is re-fetched from the
  gateway (mTLS) before settling, idempotently. Money in minor units.
- Uploads: content sniffed, random keys, traversal-safe local driver or S3,
  auth-checked streaming. Tokens on mobile live in SecureStore (keychain).
- Rate limiting on auth, security headers, CORS allowlist, secrets only in
  `.env`, audit logs on every mutation, soft deletes.

## Remaining roadmap

- OneSignal device wiring in the mobile app (`onesignal-expo-plugin`) once an
  app id exists; backend + `/devices` registration endpoint are ready.
- Swagger docs (`swaggo/swag`), Docker + CI, Sentry, store submission (EAS).
