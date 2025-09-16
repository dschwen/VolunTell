# AGENTS.md — Volunteer Scheduling App (Habitat-Style)

This file briefs an AI coding agent on the current state of the volunteer scheduling project and the expectations for future work. The app coordinates volunteers, shifts, attendance, and coordinator follow-up tasks. Everything runs locally via Docker Compose.

---

## 1) Mission & Outcomes

**Mission:** Provide a self-hosted coordinator tool to:
- Maintain a volunteer roster with contact info, skills, availability, family group, and contact history.
- Plan events and shifts on a calendar with skill-based quotas.
- Assign volunteers (drag-and-drop or drawer actions), confirm attendance, and record hours.
- Track follow-up tasks and contact attempts.
- Export CSV summaries (attendance hours, contact logs) and ingest roster/contact CSVs.

**Success Criteria (MVP):**
- CRUD for Volunteers, Events, Shifts, Requirements, Signups, Attendance, Tasks, Projects, Settings, Skills.
- Calendar UI with quota meters, roster drawer, optional drag-and-drop assignment.
- REST API backed by PostgreSQL (Prisma ORM) with JSON responses.
- Local deployment via `docker compose up -d` with persistent DB volume and seed data.
- Coordinator-only access today (authentication still pending).

---

## 2) Current Implementation Snapshot (2025-09)

Core scheduling flows are in place; auth, richer reporting, and some automation remain TODO.

- **Frontend:** Next.js (pages router) + Tailwind-lite inline styles. Key pages live under `pages/` (`/calendar`, `/events`, `/volunteers`, `/projects`, `/tasks`, `/reports/hours`, `/settings`).
- **Calendar:** `components/CalendarBoard.tsx` renders FullCalendar with optional drag/drop, roster drawer, requirement editing, attendance actions, and shift cloning.
- **Volunteers:** Table with filtering/sorting, availability + blackout management, contact history modal, follow-up task helpers, CSV import (volunteers), and contact logging modal.
- **Tasks:** Lists open follow-up tasks and highlights under-filled shifts (informational only—no auto task creation yet).
- **Settings:** Manages skills, default shift hours, availability skill trimming, UTC fallback, and calendar DnD toggle via `AppSetting` rows.
- **Projects:** CRUD for project metadata (used for calendar filtering and color accents).
- **API:** REST endpoints implemented under `pages/api/**`; most write paths assume coordinator role and lack auth middleware today.
- **Not yet implemented:** NextAuth credentials flow, family CRUD UI, rich CSV import wizard, automated task generation, and `/api/calendar` aggregation (frontend calls `/api/events`).

---

## 3) Tech Stack & Layout

- **Runtime:** Next.js 14.2 (pages directory) with React 18.
- **Database:** PostgreSQL 16 accessed through Prisma Client (`@prisma/client`).
- **Source layout:**
  - `components/` — shared React components (CalendarBoard, Portal, TagMultiSelect, etc.).
  - `lib/` — Prisma client helper and availability utilities.
  - `pages/` — Next.js pages and API routes.
  - `prisma/` — schema and seed script.
  - `styles/` — global styles (minimal).
- **Tooling:** TypeScript strict mode, ESLint + Prettier configs (no automated CI yet).

---

## 4) Data Model (Prisma Schema)

`prisma/schema.prisma` defines the authoritative schema (excerpt below mirrors the file). Note: Volunteer addresses are not implemented yet; CSV import/export currently handle name/email/phone/skills only.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum EventCategory {
  RESTORE
  BUILD
  RENOVATION
}

model Project {
  id        String   @id @default(cuid())
  name      String
  colorTag  String?
  notes     String?
  events    Event[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Family {
  id        String      @id @default(cuid())
  name      String
  colorTag  String?
  notes     String?
  volunteers Volunteer[]
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
}

model Volunteer {
  id           String        @id @default(cuid())
  family       Family?       @relation(fields: [familyId], references: [id])
  familyId     String?
  name         String
  email        String?       @unique
  phone        String?
  skills       String[]
  notes        String?
  isActive     Boolean       @default(true)
  availability Availability[]
  blackouts    Blackout[]
  signups      Signup[]
  attendance   Attendance[]
  tasks        Task[]
  contactLogs  ContactLog[]
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
}

model Availability {
  id           String     @id @default(cuid())
  volunteer    Volunteer  @relation(fields: [volunteerId], references: [id])
  volunteerId  String
  weekday      Int        // 0=Sun … 6=Sat
  startTime    String     // '08:00'
  endTime      String     // '15:30'
}

model Event {
  id        String   @id @default(cuid())
  title     String
  location  String?
  start     DateTime
  end       DateTime
  notes     String?
  category  EventCategory @default(BUILD)
  project   Project?   @relation(fields: [projectId], references: [id])
  projectId String?
  shifts    Shift[]
  tasks     Task[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Shift {
  id          String        @id @default(cuid())
  event       Event         @relation(fields: [eventId], references: [id])
  eventId     String
  start       DateTime
  end         DateTime
  description String?
  requirements Requirement[]
  signups     Signup[]
  attendance  Attendance[]
}

model Requirement {
  id       String  @id @default(cuid())
  shift    Shift   @relation(fields: [shiftId], references: [id])
  shiftId  String
  skill    String
  minCount Int
}

model Signup {
  id          String     @id @default(cuid())
  shift       Shift      @relation(fields: [shiftId], references: [id])
  shiftId     String
  volunteer   Volunteer  @relation(fields: [volunteerId], references: [id])
  volunteerId String
  role        String?
  status      String     // invited|interested|confirmed|declined|waitlist
  comment     String?
  createdAt   DateTime   @default(now())

  @@unique([volunteerId, shiftId])
}

model Attendance {
  id          String     @id @default(cuid())
  shift       Shift      @relation(fields: [shiftId], references: [id])
  shiftId     String
  volunteer   Volunteer  @relation(fields: [volunteerId], references: [id])
  volunteerId String
  status      String     // present|no_show|partial|cancelled
  hours       Decimal?   @db.Decimal(5, 2)
  checkinTs   DateTime?
  checkoutTs  DateTime?
  createdAt   DateTime   @default(now())
}

model Task {
  id          String    @id @default(cuid())
  volunteer   Volunteer? @relation(fields: [volunteerId], references: [id])
  volunteerId String?
  event       Event?    @relation(fields: [eventId], references: [id])
  eventId     String?
  dueDate     DateTime?
  type        String    // call|remind|ask|followup
  notes       String?
  status      String    // open|done
  createdAt   DateTime  @default(now())
}

model User {
  id       String   @id @default(cuid())
  email    String   @unique
  password String
  role     String   // 'coordinator'|'volunteer'
  createdAt DateTime @default(now())
}

model Blackout {
  id           String     @id @default(cuid())
  volunteer    Volunteer  @relation(fields: [volunteerId], references: [id])
  volunteerId  String
  date         DateTime?
  weekday      Int?
  startTime    String
  endTime      String
  notes        String?
  createdAt    DateTime   @default(now())
}

model Skill {
  id    String @id @default(cuid())
  name  String @unique
}

model AppSetting {
  key   String  @id
  value String
  updatedAt DateTime @updatedAt
}

model ContactLog {
  id           String     @id @default(cuid())
  volunteer    Volunteer  @relation(fields: [volunteerId], references: [id])
  volunteerId  String
  method       String
  at           DateTime
  comments     String?
  createdAt    DateTime   @default(now())
}
```

---

## 5) API Overview (pages/api)

All routes return JSON. Mutations currently lack auth and should be considered coordinator-only in trusted environments.

- **Volunteers**
  - `GET /api/volunteers?skill=&active=&availableAt=&availableForShift=&requireSkills=&debug=` — filters volunteers, availability logic via `lib/availability.ts`, and optional debug payload.
  - `POST /api/volunteers` — create volunteer.
  - `PATCH /api/volunteers/:id` / `DELETE /api/volunteers/:id` (soft delete unless `?hard=true`).
  - Nested routes: `/api/volunteers/:id/availability`, `/blackouts`, `/contacts` for CRUD on related data.

- **Availability / Blackouts**
  - `POST /api/volunteers/:id/availability` & `DELETE /api/availability/:id`.
  - `POST /api/volunteers/:id/blackouts`, `PATCH /api/blackouts/:id`, `DELETE /api/blackouts/:id`.

- **Events & Shifts**
  - `GET /api/events?projectId=&category=&from=&to=` — events with shifts, requirements, signups.
  - `POST /api/events`, `PATCH /api/events/:id`, `DELETE /api/events/:id`.
  - `/api/events/:id/shifts` (POST create shift within event).
  - `/api/shifts/:id` (PATCH delete/update), `/requirements` (CRUD), `/assign` (confirm signup), `/clone` (create copy with new times).

- **Assignments / Signups**
  - `POST /api/shifts/:id/assign` — enforces availability and double-book checks (optional skill requirement depending on settings).
  - `PATCH /api/signups/:id/status`, `DELETE /api/signups/:id`.

- **Attendance**
  - `POST /api/attendance` — log attendance/hours.
  - `GET /api/reports/hours?from=&to=` — CSV download of attendance entries.

- **Projects**
  - `GET/POST /api/projects`, `PATCH/DELETE /api/projects/:id`.

- **Skills & Settings**
  - `GET/POST /api/skills`, `PATCH/DELETE /api/skills/:id`.
  - `GET /api/settings?keys=...`, `POST /api/settings` — stores key/value strings.

- **Tasks**
  - `GET /api/tasks?status=&type=&volunteerId=&dueBefore=`
  - `POST /api/tasks`, `PATCH /api/tasks/:id`, `DELETE /api/tasks/:id`.

- **Imports**
  - `POST /api/import/volunteers` — JSON body `{ csv }`; parses simple roster CSV (First/Last/Email/Phone), upserts volunteers by email/phone.
  - `POST /api/import/contacts?dryRun=` — JSON body `{ csv, mapping?, defaults?, options?, dedupe? }`; supports preview (dryRun) and commit flows for contact logs. See §10.

- **Misc**
  - `GET /api/health` — basic liveness (returns `{ ok: true }`).
  - `GET /api/calendar` — placeholder returning `{ events: [] }` (not used by UI yet).

---

## 6) Frontend UX Summary

- **/calendar** — CalendarBoard with filters (project, category, availability window). Allows creating events/shifts from grid selection, opening roster drawer, assigning volunteers (drawer or drag/drop when enabled), editing requirements inline, and recording attendance.
- **/events** — List of events with shift cards, requirement editor, assignment form, attendance quick actions, and shift cloning/deletion.
- **/volunteers** — Search/filter by name/skill/contact recency, manage availability/blackouts, view history, log contacts, manage follow-up tasks, import volunteers CSV, export contact logs CSV.
- **/tasks** — Shows open follow-up tasks, quick complete buttons, "Log + Done" flow (opens contact modal), and a read-only under-filled shifts table.
- **/projects** — CRUD for project metadata.
- **/settings** — Manage skills and toggles stored in `AppSetting`.
- **/reports/hours** — Pick date range and download CSV via `/api/reports/hours`.
- **/`(root)`** — Redirects/links into main pages (simple landing).
- **Auth UI** — Not present yet; `/login` is TODO.

---

## 7) Calendar Board Component

> File: `components/CalendarBoard.tsx`

- Uses `@fullcalendar/react` with `timeGridWeek` default.
- Optional drag source: volunteer list in sidebar (enabled when `enableDnD` setting true). Chips expose primary skill for quick-role assignment.
- Roster drawer fetches shift details plus available volunteers (`requireSkills` toggle respected). Offers requirement management, assignment, attendance save actions, and contact shortcuts.
- New event/shift creation modal triggered by selecting a range on the calendar. Defaults use `defaultShiftHours` setting.
- Clone modal duplicates shifts with adjusted start/end.
- Toast notifications handle assignment errors (double-booked, unavailable, missing skills).

---

## 8) Time & Availability Rules

Availability logic is implemented in `lib/availability.ts` and reused across API endpoints.

- Local wall-time comparisons using `Date.getDay()` + `HH:mm` strings.
- Volunteers without availability windows are considered available unless blocked by blackouts.
- Specific-date blackouts compare local Y-M-D.
- Cross-midnight shifts split into [start..23:59] and [00:00..end]; availability satisfied if either segment overlaps a window and neither segment is blocked.
- Optional legacy fallback: when `AppSetting.allowUtcLegacyAvailability === 'true'`, shift checks retry with UTC weekday/time (used in `/api/volunteers?availableForShift` and roster drawer).
- `/api/volunteers?availableForShift=ID&debug=true` returns exclusion reasons: `outside_availability`, `blackout_weekday`, `blackout_date`, `double_booked`, `missing_required_skill` plus context payload.

---

## 9) Contact Logs & Tasks

- Contact logs stored in `ContactLog` (volunteer relation). CRUD via `/api/volunteers/:id/contacts`, `/api/contacts/:id`.
- Tasks: manual CRUD through `/api/tasks`. Types include `followup`; UI surfaces follow-up tasks and lets coordinators resolve them.
- Under-filled shift detection (tasks page) is UI-only; auto task creation for deficits or no-shows not yet implemented.
- Follow-up workflow: contact modal posts to `/api/volunteers/:id/contacts` and optionally auto-closes a task.

---

## 10) CSV Imports & Exports

### Volunteers CSV Import
- Endpoint: `POST /api/import/volunteers`.
- Body: JSON `{ csv: string }` (UTF-8). Simple heuristic parser expects headers like `First Name`, `Last Name`, `Email`, `Phone Number` (case-insensitive).
- Behavior: upsert by email, else by phone, else create name-only volunteer. Skills list starts empty; no address fields handled yet.
- UI: `/volunteers` “Import CSV” button reads file text and calls endpoint directly.

### Contact Logs CSV Import
- Endpoint: `POST /api/import/contacts?dryRun=true|false`.
- Body (JSON):
  ```json
  {
    "csv": "...",
    "mapping": { "email": "Email", "phone": "Phone" },
    "defaults": { "method": "phone" },
    "options": { "timezone": "America/New_York", "delimiter": "," },
    "dedupe": { "strategy": "exact", "windowMinutes": 10 }
  }
  ```
- Features: auto header detection, timezone-aware date parsing, method normalization, duplicate suppression (existing logs and in-batch window), dry-run preview with issues per row, commit with `createMany`.
- UI: not wired yet. Volunteers page still links to contacts export and manual logging only.

### Exports
- Contact logs CSV: `/api/reports/contacts?from=&to=&volunteerId=`.
- Hours CSV: `/api/reports/hours?from=&to=`.

---

## 11) Docker & Local Development

Files at repo root:

`docker-compose.yml`
```yaml
version: "3.9"

services:
  db:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_DB: app
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
    volumes:
      - ./db:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  adminer:
    image: adminer
    restart: unless-stopped
    ports:
      - "8081:8080"

  app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      - db
    environment:
      DATABASE_URL: "postgresql://app:app@db:5432/app?schema=public"
      NEXTAUTH_SECRET: "replace-me"
      NEXTAUTH_URL: "http://localhost:3000"
      NODE_ENV: "development"
    ports:
      - "3000:3000"
    volumes:
      - .:/usr/src/app
      - /usr/src/app/node_modules
```

`Dockerfile`
```Dockerfile
FROM node:20-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY --from=builder /usr/src/app .
EXPOSE 3000
CMD ["npm", "run", "start"]
```

`.env`
```
DATABASE_URL=postgresql://app:app@db:5432/app?schema=public
NEXTAUTH_SECRET=dev-secret-change
NEXTAUTH_URL=http://localhost:3000
```

Commands:
```bash
docker compose up -d --build
docker compose exec app npx prisma migrate dev --name init
docker compose exec app npx prisma db seed
```

---

## 12) Seed Data

`prisma/seed.ts` provisions:
- Coordinator user `coordinator@example.com / Passw0rd!` (bcrypt-hashed) — login UI still TODO.
- One project (`Anderson Home`).
- Two volunteers with sample skills and availability (`Alex Carpenter`, `Pat Painter`).
- Basic availability + blackout entries.
- One event with a single shift, requirements (carpentry 2, paint 1), and one confirmed signup.

Future seed enhancements (families, more volunteers/events) are open tasks.

---

## 13) Testing Status

- Automated tests (unit/integration/E2E) are not set up yet.
- Manual verification covers calendar interactions, volunteer CRUD, CSV exports.
- When adding features, prefer Vitest for logic and Playwright for smoke when time permits.

---

## 14) Outstanding Work / Suggestions

Short-term priorities:
1. Implement authentication (NextAuth credentials) and gate coordinator routes.
2. Build UI for contact CSV import preview + commit flow; optionally extend volunteer import to handle mapping + addresses.
3. Flesh out `/api/calendar` or remove in favor of `/api/events` to avoid confusion.
4. Add Families management UI + API if required by coordinators.
5. Expand seed data for demo realism and to satisfy acceptance list expectations.
6. Add automated tests for availability edge cases and assignment API.

Polish ideas (unchanged from earlier roadmap): unified toast system, live calendar quota refresh on requirement updates, restricted role dropdowns, etc.

---

## 15) Acceptance Checklist (Updated)

Use this list to validate milestone completion:
- [ ] Containers (`db`, `adminer`, `app`) start via `docker compose up -d`.
- [ ] `npx prisma migrate dev` + `prisma db seed` succeed inside the app container.
- [ ] Calendar page loads seeded event; quota meters render; drag/drop works when `enableCalendarDnD=true`.
- [ ] Roster drawer supports assignment, requirement edits, and attendance logging.
- [ ] Volunteers page handles CRUD, availability/blackouts, contact history, volunteer CSV import, and contact export.
- [ ] Tasks page shows follow-up tasks and under-filled shifts; "Log + Done" closes tasks.
- [ ] Reports > Hours exports CSV with expected rows for recorded attendance.
- [ ] Authentication flow protects coordinator routes (TODO — currently unchecked).

---

## 16) Nice-to-Have Ideas

- Public shift self-signup with coordinator approval.
- Email/SMS reminders (MailHog/Twilio) and scheduled tasks (Redis + BullMQ).
- ICS feeds per volunteer.
- Mobile-friendly kiosk / QR check-in for attendance.
- Bulk assignment helpers (fill by skill/min count), conflict badges, richer reporting.
- Volunteer address fields + CSV import/export once product needs them.

---

## 17) Quickstart for Coordinators (manual)

```bash
# Start stack
docker compose up -d --build

# Apply schema + seed
docker compose exec app npx prisma migrate dev --name init
docker compose exec app npx prisma db seed

# Open UI
xdg-open http://localhost:3000/calendar || open http://localhost:3000/calendar
# DB admin
xdg-open http://localhost:8081 || open http://localhost:8081
```

---

**End of AGENTS.md**
