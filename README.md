# CivicReport

CivicReport is an open, independently branded civic issue-reporting platform. Citizens report problems on a map (potholes, broken street lights, illegal dumping and so on) and follow them to resolution. City staff handle reports in a back-office with a configurable workflow.

It reproduces the functionality and UX of a municipal reporting platform. The reference analysis is in [`docs/REFERENCE_ANALYSIS.md`](docs/REFERENCE_ANALYSIS.md). It uses a fictional brand ("Demo City"), and all of its identity comes from **one configuration file**.

---

**Repository:** <https://github.com/stroiladrian/Report>

**Contents:** [Demo accounts](#demo-accounts) · [How to install](#how-to-install) · [Features](#features) · [Tech stack](#tech-stack) · [Scripts](#useful-scripts) · [Environment variables](#environment-variables) · [Re-branding](#re-branding) · [Architecture](#architecture) · [REST API](#rest-api) · [Testing](#testing) · [Production deployment](#production-deployment)

---

## Demo accounts

After installing (below), the demo data creates these accounts. **All of them use the password `CivicDemo2026!`** (you can change it with `SEED_PASSWORD` in `.env` before seeding).

| Role | E-mail | Password | What you can do |
|---|---|---|---|
| Super admin | `superadmin@civicreport.test` | `CivicDemo2026!` | everything, including the workflow editor, roles and admin accounts |
| Admin | `admin@civicreport.test` | `CivicDemo2026!` | back-office: all reports, users, categories, departments, audit log |
| Operator – roads | `operator.drumuri@civicreport.test` | `CivicDemo2026!` | processes reports of the Roads department |
| Operator – street lighting | `operator.iluminat@civicreport.test` | `CivicDemo2026!` | Street-lighting department |
| Operator – sanitation | `operator.salubrizare@civicreport.test` | `CivicDemo2026!` | Sanitation department |
| Operator – green spaces | `operator.verde@civicreport.test` | `CivicDemo2026!` | Green-spaces department |
| Operator – traffic | `operator.trafic@civicreport.test` | `CivicDemo2026!` | Traffic department |
| Operator – utilities | `operator.utilitati@civicreport.test` | `CivicDemo2026!` | Utilities department |
| Operator – buildings/heritage | `operator.patrimoniu@civicreport.test` | `CivicDemo2026!` | Buildings department |
| Operator – local police | `operator.politie@civicreport.test` | `CivicDemo2026!` | Local-police department |
| Citizen | `citizen@civicreport.test` | `CivicDemo2026!` | reports problems, follows "My reports"; phone `+40700000001` for SMS-code login |

- **Log in** at `/login`. Staff accounts get a **Back-office** link in the header (or go to `/admin`).
- **SMS codes, verification and reset e-mails** are not really sent in development. They appear in the **dev mailbox** at <http://localhost:3000/dev/mailbox>.
- These accounts are for local testing and demos only. For a real launch, seed with `SEED_PRODUCTION=1` (see [Useful scripts](#useful-scripts)), which creates no demo accounts.

---

## How to install

You need about 15 minutes the first time. A more detailed, beginner-friendly guide is in [docs/INSTALL-LOCAL.md](docs/INSTALL-LOCAL.md); putting it online with HTTPS is covered in [docs/DEPLOY-ONLINE.md](docs/DEPLOY-ONLINE.md).

### 1. Install the tools (once)

- **Node.js 22** (20.9+ works) – <https://nodejs.org> (LTS)
- **Docker Desktop** – <https://www.docker.com/products/docker-desktop/> (runs the PostgreSQL database for you). *Or* install PostgreSQL 14+ yourself (Mac: `brew install postgresql@16 && brew services start postgresql@16`, or <https://postgresapp.com>).
- **Git** – <https://git-scm.com> (already on most Macs)

### 2. Download the code

```bash
git clone https://github.com/stroiladrian/Report.git
cd Report
npm install
```

(Or use GitHub's green **Code → Download ZIP** button, unzip, open a Terminal in the folder and run `npm install`.)

### 3. Start the database

With Docker Desktop running:

```bash
docker compose up -d db
```

(If you installed PostgreSQL yourself, create the user and database once: `createuser -s civic && psql -c "ALTER USER civic PASSWORD 'civic';" postgres && createdb -O civic civicreport`.)

### 4. Configure

```bash
cp .env.example .env
```

The defaults work with the Docker database. Open `.env` only if your database address is different (`DATABASE_URL`) or you want Google login (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`).

### 5. Create the tables and the demo data

```bash
npx prisma migrate deploy
npm run db:seed
```

This creates the demo accounts above and about 90 fictional reports with photos around Deta (Timiș).

### 6. Run

```bash
npm run dev
```

Open <http://localhost:3000> and log in with one of the [demo accounts](#demo-accounts). Next time, you only need step 3 (if Docker isn't already running the database) and step 6.

**Troubleshooting**

| Problem | Fix |
|---|---|
| `Can't reach database server` | the database isn't running: start Docker Desktop and run `docker compose up -d db` |
| `port 3000 is already in use` | another app uses it: `npm run dev -- -p 3001` and open <http://localhost:3001> |
| Login says the account doesn't exist | you skipped `npm run db:seed` |
| Want to start over with fresh demo data | `npm run db:reset` (⚠️ deletes everything in the local database) |

---

## Features

**Public site (RO / EN)**
- Full-screen interactive map (MapLibre GL, OpenStreetMap vector tiles, no API key). Points are coloured by status and cluster at low zoom. There's a heat-map toggle, a "locate me" button, and hover preview cards with photos.
- Floating filter panel: **status** (with counts), **category** (with counts, select/deselect all), **period** (presets or a custom date range), **search**, and "all my reports".
- Filter state lives in the URL (`/?status=in_progress&category=roads&period=30d`). The map and the list update without reloading the page.
- A list view with sorting, pagination and "only reports in the visible map area" (side panel on desktop, full screen on mobile).
- Report detail opens as a **dialog over the map** (intercepted route) and also works as a full page on direct load. It shows the status timeline, photo lightbox, public updates, official response, resolution or redirect info, and a mini-map.
- A **5-step report wizard**: location (pin fixed at the map centre, address search, GPS, reverse geocoding, or "no location") → category and subcategory (with notices) → title and description (with counters and limits) → photos (drag & drop, previews, delete confirmation) → review → confirmation screen with the registration number.
- Accounts: registration with numbered sections and consents, e-mail + password login, **SMS one-time-code login**, e-mail verification, password reset, profile, "My reports", in-app notifications, notification preferences (e-mail / SMS / in-app), language, change password, and log out everywhere.

**Back-office**
- Dashboard: totals, new, assigned, in progress, planned, resolved, redirected, overdue, a 30-day chart, open reports by category and by department, average resolution time, and "my queue".
- Report list: search (number, text, street, reporter), filters (status, category, department, assignee, overdue), sorting, pagination and **CSV export**.
- Report processing: workflow transitions (with note, public/internal flag, redirect target and resolution), department/operator/due-date assignment, category and title edits, public visibility, location change on a map, public updates, official responses, internal notes, admin attachments, photo moderation (public/hidden), reporter contact details, history, and a full **audit trail**.
- Users (create staff accounts, roles, activate/deactivate, department membership), categories (a two-level tree with department routing, SLA, notices and a "sensitive" flag), departments, **workflow editor** (statuses and a transition matrix), and the audit log viewer.

**Platform**
- PostgreSQL + Prisma migrations, and a seed with ~90 fictional reports, generated placeholder photos, histories and comments.
- RBAC (`CITIZEN`, `OPERATOR`, `ADMIN`, `SUPER_ADMIN`) with permissions **enforced server-side**.
- A configurable workflow engine. Every transition is validated, recorded in the history and written to the audit log.
- Notification abstraction (e-mail, SMS, in-app) with mock providers and a development mailbox. Nothing is ever sent in development.
- Secure uploads: magic-byte type detection, extension matching, size and count limits, random storage keys, and access-checked downloads. **EXIF/GPS metadata is stripped** from JPEGs, while the photo orientation is kept.
- Security: scrypt password hashing, hashed DB sessions in HttpOnly/SameSite cookies, CSRF origin checks, rate limiting, Zod validation, CSP and security headers, and no user enumeration.
- Tests: 59 unit/integration tests (Vitest) and 14 end-to-end tests (Playwright, desktop and mobile).

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, React 19, TypeScript) – REST API in route handlers |
| Styling | Tailwind CSS 3, own design-system components (`src/components/ui`) |
| Database | PostgreSQL 14+ with Prisma 6 ORM and migrations |
| Maps | MapLibre GL JS + OpenFreeMap tiles (any MapLibre style URL) |
| Geocoding | OpenStreetMap Nominatim (pluggable, cached) or offline mock |
| Validation | Zod (shared client/server schemas) |
| Auth | Custom session auth (DB sessions, scrypt) – see [why](#authentication) |
| Tests | Vitest, Playwright |

Runtime dependencies are kept to a minimum: `next`, `react`, `@prisma/client`, `maplibre-gl`, `zod` and `server-only`.

---

## Quick start (for developers)

> **Step-by-step guides:** [docs/INSTALL-LOCAL.md](docs/INSTALL-LOCAL.md) (your own computer, localhost) · [docs/DEPLOY-ONLINE.md](docs/DEPLOY-ONLINE.md) (GitHub + a real server with HTTPS)

Requirements: **Node.js 20.9+** (22 recommended), **PostgreSQL 14+** (or Docker).

```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL (skip if you already have one)
docker compose up -d db

# 3. Configure environment
cp .env.example .env            # adjust DATABASE_URL if needed

# 4. Create the schema and demo data
npx prisma migrate deploy       # or: npm run db:migrate (dev, creates new migrations when you edit the schema)
npm run db:seed

# 5. Run
npm run dev                     # http://localhost:3000
```

Log in with the [demo accounts](#demo-accounts). **Development mailbox:** every e-mail and SMS "sent" by the mock providers appears at **<http://localhost:3000/dev/mailbox>** (verification links, reset links, SMS codes). It is disabled in production unless `DEV_MAILBOX=1`.

### Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | development server |
| `npm run build` / `npm start` | production build / server |
| `npm run typecheck` | TypeScript check |
| `npm run db:migrate` | create/apply migrations in development (`prisma migrate dev`) |
| `npm run db:deploy` | apply migrations (production) |
| `npm run db:seed` | seed roles, permissions, workflow, departments, categories, demo users and reports (idempotent for configuration; demo reports only if none exist) |
| `SEED_PRODUCTION=1 SEED_ADMIN_EMAIL=… SEED_PASSWORD=… npm run db:seed` | real launch: configuration plus one super admin, no demo accounts or reports |
| `npm run db:relocate-demo` | after changing the city in `config/branding.ts`: moves reports located outside the new service area around the new centre |
| `npm run db:reset` | ⚠️ **drops all data** in `DATABASE_URL`, re-applies migrations and seeds – development only |
| `npm test` | unit + integration tests (uses `TEST_DATABASE_URL`) |
| `npm run test:e2e` | Playwright end-to-end tests (starts `npm run dev` if nothing is running on :3000) |

---

## Environment variables

See [`.env.example`](.env.example). The most important ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `APP_URL` | public base URL (links in e-mails, CSRF origin check) |
| `UPLOAD_DIR` | where files are stored (default `./storage/uploads`) |
| `EMAIL_PROVIDER`, `SMS_PROVIDER` | `mock` (default) or `webhook` |
| `GEOCODER` | `nominatim` (default) or `mock` |
| `GEOCODER_CONTACT` | contact address sent to Nominatim (required by its usage policy) |
| `DEV_MAILBOX` | force the dev mailbox on (`1`) or off (`0`) |
| `TEST_DATABASE_URL` | database used by `npm test` – **never** point it at production |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | optional “Sign in with Google” (see Authentication) |

No secrets are committed. `.env` is git-ignored.

---

## Re-branding

Everything that identifies the organisation lives in **[`config/branding.ts`](config/branding.ts)**:

| Key | Used for |
|---|---|
| `brandName` | browser titles, e-mails/SMS, footer, admin header |
| `organizationName` `{ ro, en }` | header (split over two lines), footer, e-mail footer, public updates author |
| `tagline` | meta description, login page |
| `logo`, `favicon`, `ogImage` | header logo (light version on the primary colour), browser icon, social preview |
| `colors.*` | exposed as CSS variables → Tailwind colours `primary`, `accent`, … (header, buttons, dialogs, CTA, focus rings, map clusters) |
| `font.family`, `font.fontStylesheet` | font stack; optionally a web-font stylesheet URL |
| `contact.*` | footer, privacy page, geocoder user agent |
| `headerLinks` | header navigation / mobile "Menu" (links to your main website) |
| `map.*` | default centre/zoom, bounds of the service area (also limits where reports can be placed), style URL, label font |
| `reportNumberPrefix` | registration numbers (`CR2026-000123`) |
| `legal.*` | privacy / terms links |

Steps:

1. Put your logo and favicon in `public/brand/` and update the paths.
2. Change the colours, names, contact details and map centre in `config/branding.ts`.
3. Replace the demo text in `src/app/(public)/privacy/page.tsx` with your legal notice.
4. Adjust the categories and departments in `prisma/demo-data.ts` before seeding, or manage them later in **Back-office → Categories / Departments**.
5. Optionally edit the UI copy in `src/lib/i18n/dictionaries/{ro,en}.ts`.

Nothing else in the code refers to a specific organisation.

Behaviour settings (limits, default period, SLA, whether a verified contact is required to report, and so on) live in [`config/app.ts`](config/app.ts).

### Languages

Romanian is the default, with English as an alternative. Users switch language in the header menu, and the choice is stored in a cookie and on their profile. To add a language, add it to `appConfig.locales`, create `src/lib/i18n/dictionaries/<code>.ts` (it's type-checked against the English file), and add the new key to the `{ ro, en }` objects in the branding config and the seed.

---

## Architecture

```
config/                 branding.ts (identity) · app.ts (behaviour)
prisma/                 schema.prisma · migrations/ · seed.ts · demo-data.ts
src/
  app/
    (public)/           map, report pages, wizard (/submit), auth pages, account, privacy, dev mailbox
    (public)/@modal/    intercepted report dialog over the map
    admin/              back-office pages
    api/                REST endpoints (route handlers)
  components/
    ui/                 design system: Button, Field/Input/Textarea/Select/Checkbox, Modal, Drawer,
                        ConfirmDialog, Toast, Badge/StatusBadge, Pagination, Stepper, FileUploader,
                        LoadingState/EmptyState/ErrorState, Icon
    map/                MapView, FilterPanel, ReportExplorer, LocationPicker, MiniMap
    reports/            ReportCard, ReportDetailView, Timeline, PhotoGallery, ReportWizard, …
    admin/  account/  auth/  layout/
  lib/
    auth/               password hashing, sessions, guards
    rbac/               permission catalogue + pure policies
    validation/         Zod schemas (shared)
    i18n/               dictionaries, server/client helpers
    http.ts             route wrapper + consistent error envelope
    rate-limit.ts  multipart.ts  filters.ts  api-client.ts
  server/
    domain/             pure logic: workflow engine, upload validation / EXIF stripping
    services/           use-cases: reports, auth, admin, categories, notifications, audit, workflow
    providers/          email / sms / storage / geocoding interfaces + implementations
  types/                DTOs shared by API and UI
tests/unit  tests/integration  e2e/
```

The rules are:

- **UI** components never touch the database.
- **Route handlers** only parse input, resolve the current user and call a **service**.
- **Services** hold the business rules and run every authorization check through `lib/rbac/policy.ts`.
- **Domain** modules are pure and unit-tested.
- **Providers** isolate external systems.

### Data model

`users`, `roles`, `permissions`, `role_permissions`, `sessions`, `verification_tokens`, `departments`, `employees`, `report_categories` (tree), `report_statuses`, `status_transitions`, `reports`, `report_locations`, `report_status_history`, `report_comments` (public update / official response / internal note / citizen message), `report_attachments`, `notifications`, `notification_deliveries` (e-mail/SMS log), `audit_logs`, `counters` (registration numbers). See `prisma/schema.prisma`.

### Workflow

Statuses and allowed transitions are **data**, editable in **Back-office → Workflow** (super admin only).

Each status has:

- a key
- localized labels
- a colour
- a *public group*: the public filter shows groups, like the reference (Submitted, In progress, Planned, Resolved, Redirected, Closed)
- flags: `initial`, `terminal`, `counts as resolved`

A transition can require a note, and can also require a specific permission (column `permission`).

Default flow:

```
submitted → accepted → assigned → planned ⇄ in_progress → resolved → closed
submitted/accepted/assigned → redirected (note + target institution) → closed
submitted/accepted/assigned/in_progress → needs_info (note) → accepted | closed
resolved → in_progress (reopen, note)
```

`src/server/domain/workflow.ts` validates every change, and `changeStatus()` in `src/server/services/reports.ts` applies it. That happens inside a transaction with an optimistic-concurrency check, and the change writes a history row and an audit entry, then notifies the reporter.

### RBAC

| Role | Can |
|---|---|
| CITIZEN | create reports, view own reports (incl. private details), add information to own reports |
| OPERATOR | + view all reports, process reports **assigned to them or their department**, public updates, internal notes, admin attachments, dashboard |
| ADMIN | + process any report, assign, edit category/location/visibility, manage users (not admins), categories, departments, audit log |
| SUPER_ADMIN | everything, incl. workflow, roles and admin accounts |

Permissions live in the database (`roles` ↔ `permissions`). The default matrix is in `src/lib/rbac/permissions.ts`. The UI hides controls a user can't use, but the server always re-checks.

### Authentication

This is a custom session implementation, not Auth.js. The reference uses phone + one-time code, and Auth.js's credentials flow doesn't support database sessions. The implementation:

- stores sessions as a SHA-256 hash in the DB; the raw token lives only in an HttpOnly, SameSite=Lax cookie (`__Host-` prefixed and Secure in production), with a sliding 30-day expiry
- hashes passwords with **scrypt** (N=16384) and uses constant-time comparison, plus a dummy hash for unknown users
- uses single-use, hashed, expiring tokens for e-mail verification, password reset (which also revokes all sessions) and SMS codes (6 digits, 10 min, max 5 attempts)
- never reveals whether an e-mail or phone number is registered
- offers optional **Sign in with Google** (OpenID Connect, authorization code + PKCE, state and nonce checks), see below
- leaves other identity providers (national eID/OIDC, passkeys) as an extension point: add a route that verifies the provider response and calls `createSession(userId)`. `src/server/services/google.ts` is a working example.

#### Sign in with Google

The "Continuă cu Google" button appears on the login and register pages once both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.

1. In [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials), configure the **OAuth consent screen**. Choose type *External* and add the app name, a support e-mail and the logo.
2. Choose **Create credentials → OAuth client ID → Web application**.
3. Under **Authorized redirect URIs**, add one entry for every address the site is opened from:
   - `http://localhost:3000/api/auth/google/callback`
   - `https://your-domain.ro/api/auth/google/callback`

   Google does not accept LAN IPs like `192.168.x.x`. To test on a phone, use an https tunnel address and add it here too.
4. Copy the client ID and secret into `.env`, then restart `npm run dev`.

Accounts are matched in this order:

- by Google account id
- by the same **verified** e-mail address, in which case the existing account gets linked
- otherwise a new CITIZEN account is created with the e-mail already verified

Users who signed up with Google can later set a password under *Contul meu → Setări*.

### Notifications

`notifyUser(userId, event, vars)` sends to each channel the user enabled: an in-app notification, an e-mail (if the address is verified) and an SMS (if the phone is verified). Every delivery is logged in `notification_deliveries`.

The events are:

- `report_submitted`
- `status_changed`
- `report_redirected`
- `report_resolved`
- `admin_response`
- `report_assigned` (to the operator)
- `new_report_staff` (to the department, in-app only)

To add a real provider, implement `EmailProvider` / `SmsProvider` in `src/server/providers/{email,sms}` (SMTP, SES, Twilio, …) and select it in `getEmailProvider()` / `getSmsProvider()`. The included `webhook` providers POST JSON to your own relay.

### File storage

`LocalDiskStorage` writes files to `UPLOAD_DIR` under random keys (`yyyy/mm/<uuid>.<ext>`). Files are **never** served from `/public`. They go through `GET /api/files/:attachmentId`, which checks access:

- public citizen photos are visible to everyone
- admin attachments and hidden photos are staff-only
- sensitive categories are never public

For S3/MinIO, implement `StorageProvider` in `src/server/providers/storage`.

---

## REST API

Every error uses the same shape: `{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": { "fieldErrors": {…} } } }`. The status codes are 400, 401, 403, 404, 409, 422, 429 and 500.

State-changing requests must come from the same origin (CSRF protection).

| Method & path | Auth | Description |
|---|---|---|
| `GET /api/reports?status=&category=&period=&from=&to=&q=&bbox=&mine=&sort=&page=&pageSize=` | public | paginated list (`format=map` → lightweight map points) |
| `GET /api/reports/facets?…` | public | status/category counts for the filter panel |
| `POST /api/reports` | citizen | create (multipart: `data` JSON + `files[]`, or JSON) |
| `GET /api/reports/:idOrNumber` | public/owner/staff | detail (`?view=admin` for staff view) |
| `PATCH /api/reports/:id` | staff | assignment, due date, category, title, visibility, location |
| `POST /api/reports/:id/status` | staff | `{ status, note?, isPublic?, redirectedTo?, resolution? }` |
| `POST /api/reports/:id/comments` | owner/staff | `{ body, kind: UPDATE\|RESPONSE\|NOTE\|CITIZEN }` |
| `POST /api/reports/:id/attachments` | owner/staff | multipart `files[]`, `isPublic` |
| `PATCH /api/attachments/:id` | staff | `{ isPublic }` |
| `GET /api/files/:id` | per file | download/stream |
| `GET /api/categories` · `/api/statuses` · `/api/departments` | public | reference data |
| `GET /api/geocode/reverse?lat=&lng=` · `/api/geocode/search?q=` | public (rate-limited) | geocoding proxy |
| `POST /api/auth/register` · `login` · `logout` · `otp/request` · `otp/verify` · `password/forgot` · `password/reset` · `verify-email/resend` | – | authentication |
| `GET/PATCH /api/me` · `POST /api/me/password` · `GET /api/me/reports` · `GET /api/me/notifications` · `POST /api/me/notifications/read` · `POST /api/me/locale` · `DELETE /api/me/sessions` | user | account |
| `GET /api/admin/stats` · `/api/admin/reports` · `/api/admin/reports/export` · `/api/admin/audit` | staff | back-office |
| `GET/POST /api/admin/users`, `PATCH /api/admin/users/:id` | admin | users |
| `GET/POST /api/admin/categories`, `PATCH …/:id` · same for `departments` | admin | configuration |
| `GET /api/admin/workflow`, `POST/PATCH …/statuses`, `PUT …/transitions` | super admin | workflow |

---

## Testing

```bash
# Unit + integration (needs PostgreSQL; creates nothing destructive – it applies migrations and the config seed to TEST_DATABASE_URL)
createdb civicreport_test            # once
npm test

# End-to-end (starts the dev server automatically if :3000 is free; uses the dev database + demo data)
npx playwright install chromium      # once
npm run test:e2e
# against another deployment:
E2E_BASE_URL=https://staging.example npm run test:e2e
```

- **Unit:** validation schemas, permission policies and role matrix, workflow transitions, upload type sniffing, EXIF stripping, URL filter state.
- **Integration:** registration, e-mail verification, login, password reset, SMS login; report creation with attachment, notifications and audit; visibility rules (sensitive categories, reporter privacy); assignment permissions; the full status workflow with history, audit and notifications; comment permissions; attachment access control.
- **E2E:** an anonymous visitor browsing the map, filters, list and report dialog (desktop and mobile); a citizen who registers, verifies, creates a report with a photo, and sees it in "My reports"; an admin who accepts, assigns, updates and resolves it; the citizen then sees the resolution and the notification. It also checks server-side enforcement: 401/403, CSRF, and spoofed uploads.

---

## Production deployment

### Docker

For a real server with HTTPS (Caddy) use `docker-compose.prod.yml`. See [docs/DEPLOY-ONLINE.md](docs/DEPLOY-ONLINE.md). The plain `docker-compose.yml` below is for trying the production build locally.

```bash
docker compose up --build -d          # PostgreSQL + app on :3000; migrations run on start
DATABASE_URL=postgresql://civic:civic@localhost:5432/civicreport npm run db:seed   # once, from your machine
```

### Plain Node.js

```bash
npm ci
npm run build
npm run db:deploy
NODE_ENV=production npm start         # or run .next/standalone/server.js (output: "standalone")
```

**Production checklist**

- Run behind HTTPS (a reverse proxy such as nginx, Caddy or a cloud load balancer) and set `APP_URL` to the public HTTPS URL. The proxy must forward `Host` and `X-Forwarded-Proto`.
- Keep `UPLOAD_DIR` on persistent storage and back it up together with the database.
- Configure real e-mail and SMS providers, and leave `DEV_MAILBOX` unset.
- The rate limiter is in-memory, which is fine for one instance. For several instances, implement `RateLimitStore` on Redis. Nominatim's public service allows one request per second, so for heavy use run your own Nominatim or plug in another geocoder.
- Map tiles: OpenFreeMap is free. You can also self-host tiles and point `branding.map.styleUrl` at them; the CSP updates automatically.
- Security hardening: the CSP allows `'unsafe-inline'` scripts because of Next.js's inline bootstrap. Add nonce-based CSP middleware for a stricter policy.

---

## Accessibility

- Semantic landmarks, headings and a skip link.
- Every form control has a label, and errors are announced through `aria-describedby` / `aria-invalid`.
- Dialogs use the native `<dialog>` element (focus trap, Escape to close, focus restored afterwards).
- Visible focus rings and minimum 44px touch targets.
- `prefers-reduced-motion` is respected.
- The status filter uses checkbox semantics, and step progress is announced.
- The map canvas isn't keyboard-navigable. The **list view** is the accessible equivalent: same filters, same data, and a link to each report.

## Known limitations and assumptions

These are documented in more detail in `docs/REFERENCE_ANALYSIS.md`.

- The reference's report form and back-office sit behind a login. Their behaviour was reconstructed from public client-side code, validation messages and the brief.
- National ID fields from the reference registration form are deliberately not collected.
- Address search uses the geocoder instead of a municipal street registry.
- The map is centred on Deta (Timiș county). Change `map.defaultLocation`, `map.maxBounds` and `map.demoRadiusKm` in `config/branding.ts` for another city, then run `npm run db:relocate-demo`.
