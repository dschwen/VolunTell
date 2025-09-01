# AGENTS.md — Volunteer Scheduling App (Habitat-Style)

This document instructs an AI coding agent to implement a small, self‑hostable web application for managing volunteers, events/shifts, skill‑based slot requirements, attendance/hour tracking, and coordinator tasks. The app is deployed via Docker Compose.

---

## 0) Mission & Outcomes

**Mission:** Build a minimal, reliable tool for a volunteer coordinator to:
- Maintain a roster of volunteers: contact info, skills, availability, family grouping.
- Manage opportunities on a Google‑Calendar‑like UI, with **skill quotas per shift**.
- Drag volunteers onto shifts; confirm/decline; track attendance, no‑shows, partials, and hours.
- Keep a simple task list: “call”, “remind”, “ask”, “followup” linked to volunteers/events.
- Export CSV summaries (hours per volunteer, per time range).

**Success Criteria (MVP):**
- CRUD for Volunteers, Events, Shifts, Requirements, Signups, Attendance, Tasks.
- Interactive calendar board with drag‑and‑drop volunteer assignment and quota meters.
- Basic authentication (email/password) with role “coordinator” (admin) and “volunteer” (future).
- REST API returning JSON, backed by PostgreSQL via Prisma ORM.
- Deployed locally with `docker compose up -d`; persistent DB volume; seed data.
- No external SaaS required to operate (email/SMS optional).

---

## 1) Tech Stack

- **Frontend:** Next.js (React), FullCalendar (`@fullcalendar/react`, `daygrid`, `timegrid`, `interaction`).
- **Backend:** Next.js API routes (or Express inside Next.js) with TypeScript.
- **DB:** PostgreSQL 16 with Prisma ORM.
- **Cache/Jobs (optional for reminders):** Redis + BullMQ (later milestone).
- **Auth:** NextAuth (email/password credentials provider) with simple password hashing (bcrypt) and role claim.
- **UI:** TailwindCSS.
- **Containerization:** Docker Compose for app, db, and adminer; production build in multi‑stage Dockerfile.
- **Testing:** Vitest + Playwright smoke tests.
- **Formatting/CI:** ESLint, Prettier, simple GitHub Actions workflow (optional).

---

## 2) Domain Model (Prisma)

> File: `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
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
  signups      Signup[]
  attendance   Attendance[]
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
  shifts    Shift[]
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
}

model Attendance {
  id          String     @id @default(cuid())
  shift       Shift      @relation(fields: [shiftId], references: [id])
  shiftId     String
  volunteer   Volunteer  @relation(fields: [volunteerId], references: [id])
  volunteerId String
  status      String     // present|no_show|partial|cancelled
  hours       Decimal?   @db.Numeric(5, 2)
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
```

Seed minimal data in `prisma/seed.ts` (families, volunteers, events, a couple shifts and requirements).

---

## 3) API (REST, JSON)

All endpoints require coordinator auth for write operations. Pagination is optional for MVP.

- **Volunteers**
  - `GET /api/volunteers?skill=carpentry&active=true`
  - `POST /api/volunteers` (name, email, phone, skills[], familyId?, notes, isActive)
  - `PATCH /api/volunteers/:id`
  - `DELETE /api/volunteers/:id` (soft‑delete by `isActive=false` is OK)

- **Families**
  - `GET /api/families`
  - `POST /api/families`
  - `PATCH /api/families/:id`

- **Events & Shifts**
  - `GET /api/calendar?from=ISO&to=ISO` → events with embedded shifts, requirements, signup counts
  - `POST /api/events` (title, start, end, location, notes)
  - `POST /api/events/:id/shifts` (start, end, description)
  - `PATCH /api/shifts/:id`
  - `DELETE /api/shifts/:id`

- **Requirements**
  - `POST /api/shifts/:id/requirements` ({ skill, minCount })
  - `PATCH /api/requirements/:id`
  - `DELETE /api/requirements/:id`

- **Assignments / Signups**
  - `POST /api/shifts/:id/assign` ({ volunteerId, role }) → creates/updates Signup to `confirmed`
  - `PATCH /api/signups/:id/status` ({ status })
  - `DELETE /api/signups/:id`

- **Attendance & Hours**
  - `POST /api/attendance` ({ shiftId, volunteerId, status, hours, checkinTs?, checkoutTs? })
  - `GET /api/reports/hours?from=ISO&to=ISO` → per‑volunteer hours CSV

- **Tasks**
  - `GET /api/tasks?status=open&dueBefore=ISO`
  - `POST /api/tasks`
  - `PATCH /api/tasks/:id`

- **Auth**
  - `POST /api/auth/register` (coordinator only creates users)
  - `POST /api/auth/login`
  - `POST /api/auth/logout`

---

## 4) Interactive Calendar Widget (React)

> File: `apps/web/components/CalendarBoard.tsx`

Key behaviors:
- Weekly time grid view.
- Drag volunteers from a left pane onto shifts to assign.
- Each event tile shows **skill quotas** (filled/required) with red/green markers.
- Family highlighting via color strip.
- Context menu on event: mark attendance, quick confirm/decline, go to roster.

Skeleton:

```tsx
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin, { Draggable } from '@fullcalendar/interaction'
import { useEffect, useRef, useState } from 'react'

export default function CalendarBoard({ initial }) {
  const [events, setEvents] = useState(initial.events)
  const volunteerPaneRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!volunteerPaneRef.current) return
    new Draggable(volunteerPaneRef.current, {
      itemSelector: '.vol-chip',
      eventData: (el) => ({
        title: el.getAttribute('data-name') || 'Volunteer',
        extendedProps: {
          volunteerId: el.getAttribute('data-id'),
          role: el.getAttribute('data-role') || undefined,
        }
      })
    })
  }, [])

  const eventContent = (arg: any) => {
    const req = arg.event.extendedProps.requirements || []
    const signed = arg.event.extendedProps.signedups || []
    const bySkill = req.map((r: any) => {
      const filled = signed.filter((s: any) => s.role === r.skill).length
      const ok = filled >= r.minCount
      return `<div style="display:flex;gap:.25rem;align-items:center">
        <span>${r.skill}</span>
        <span>(${filled}/${r.minCount})</span>
        <span style="width:6px;height:6px;border-radius:50%;background:${ok?'#2ecc71':'#e74c3c'}"></span>
      </div>`
    }).join('')
    const fam = arg.event.extendedProps.familyColor ? `border-left:6px solid ${arg.event.extendedProps.familyColor};` : ''
    return { html: `<div style="padding:2px;${fam}"><strong>${arg.event.title}</strong><div style="font-size:12px">${bySkill}</div></div>` }
  }

  const handleReceive = async (info: any) => {
    const volunteerId = info.draggedEl.getAttribute('data-id')!
    const role = info.draggedEl.getAttribute('data-role') || undefined
    const shiftId = info.event.extendedProps.shiftId
    await fetch('/api/shifts/'+shiftId+'/assign', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ volunteerId, role })
    })
    info.event.setExtendedProp('signedups', [
      ...(info.event.extendedProps.signedups||[]),
      { volunteerId, role, status:'confirmed' }
    ])
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-3">
        <h3 className="mb-2">Volunteers</h3>
        <div ref={volunteerPaneRef} style={{maxHeight:'70vh',overflowY:'auto',border:'1px solid #ddd',padding:'8px'}}>
          {initial.volunteers.map((v:any) => (
            <div key={v.id} className="vol-chip" data-id={v.id} data-name={v.name} data-role={v.primarySkill||''}
              style={{padding:'6px 8px',marginBottom:'6px',borderRadius:'8px',border:'1px solid #ccc',cursor:'grab',background:v.familyColor||'#f7f7f7'}}>
              <div><strong>{v.name}</strong></div>
              <div style={{fontSize:'12px'}}>{(v.skills||[]).join(', ')}</div>
              <div style={{fontSize:'11px',opacity:.7}}>Avail: {v.availSummary}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="col-span-9">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          editable
          droppable
          eventReceive={handleReceive}
          eventContent={eventContent}
          events={events}
          height="80vh"
        />
      </div>
    </div>
  )
}
```

**Event JSON shape**

```ts
{
  id: 'shift_123',
  title: 'Build Day – Framing',
  start: '2025-09-12T08:00:00',
  end: '2025-09-12T15:00:00',
  extendedProps: {
    shiftId: 'shift_123',
    requirements: [{ skill:'carpentry', minCount:3 }, { skill:'paint', minCount:1 }],
    signedups: [{ volunteerId:'v1', role:'carpentry', status:'confirmed' }],
    familyColor: '#FFE9A8'
  }
}
```

---

## 5) Docker & Local Dev

**Files to create at repo root:** `docker-compose.yml`, `Dockerfile`, `.env`, `prisma/schema.prisma`, `prisma/seed.ts`.

### `docker-compose.yml`
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

### `Dockerfile`
```Dockerfile
# 1) Build
FROM node:20-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2) Runtime
FROM node:20-alpine
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY --from=builder /usr/src/app .
EXPOSE 3000
CMD ["npm", "run", "start"]
```

### `.env` (dev)
```
DATABASE_URL=postgresql://app:app@db:5432/app?schema=public
NEXTAUTH_SECRET=dev-secret-change
NEXTAUTH_URL=http://localhost:3000
```

### Commands
```bash
# First run
docker compose up -d --build
docker compose exec app npx prisma migrate dev --name init
docker compose exec app npx prisma db seed
```

---

## 6) Frontend Pages (MVP)

- `/login` — email/password.
- `/calendar` — CalendarBoard + side pane of volunteers (filters: skill, availability, family, active).
- `/volunteers` — table + CRUD modal (bulk import CSV, export CSV).
- `/tasks` — simple list with due date and quick actions.
- `/reports/hours` — date range picker → CSV download.

**Calendar interactions:**
- Drag volunteer chip to shift → `POST /api/shifts/:id/assign` (status=confirmed).
- Event click → open roster drawer: see assigned, capacity bar per skill, mark no‑show/present/partial, set hours defaulting to shift length.

---

## 7) Availability & Matching

- Availability stored as day-of-week windows.
- API endpoint `GET /api/volunteers?availableAt=ISO` returns volunteers whose availability covers the instant or overlaps the shift window.
- Optional: block double‑booking by checking existing confirmed signups for the time range.

---

## 8) Tasks Engine (coordinator to‑dos)

- Create tasks manually or auto‑generate when:
  - a shift is under‑filled `< 24–48h` before start → generate “call carpenters” tasks (top N by recency).
  - a no‑show recorded → generate “followup” task.
- Task fields: `type`, `volunteerId?`, `eventId?`, `dueDate`, `notes`, `status`.
- Minimal Kanban: list + checkbox to close.

---

## 9) Security & Roles

- Users: `coordinator` can do everything; `volunteer` (future) can view own schedule and confirm/decline invites.
- Auth with NextAuth Credentials provider:
  - Password hashed with `bcrypt`.
  - Session cookie; CSRF on mutations.
- Rate limit POST endpoints (basic middleware, in‑memory for dev).
- CORS disabled for production since same‑origin.

---

## 10) Exports & Reporting

- CSV export of hours: columns `[Volunteer, Email, Skill(s), Date, Shift Start, Shift End, Status, Hours]`.
- Optional aggregated CSV per volunteer and per month.

---

## 11) Tests (smoke)

- Unit: services for availability matching and capacity fill calculations (Vitest).
- E2E: Playwright click‑through: login → create event → add shift → set requirement → drag volunteer → see counters update → mark attendance → export CSV.

---

## 12) Milestones

1. **Core DB & API** — Prisma models, REST endpoints, seed.
2. **Calendar UI** — FullCalendar wired to `/api/calendar`, drag‑drop assignment.
3. **Roster & Filters** — volunteer table, search by skill/family/active.
4. **Attendance/Hours** — roster drawer operations + CSV export.
5. **Tasks** — minimal list with due dates and link to volunteer/event.
6. **Polish** — auth, basic styling, seed improvements, tests.

---

## 13) Seed Data

Create 3 families (color tagged), ~12 volunteers with mixed skills & availability, 2 events with 3 shifts each, requirements (e.g., carpentry 3, paint 1), a few assignments, and open tasks (call/remind).

---

## 14) Acceptance Checklist

- [ ] `docker compose up -d` brings up **db**, **adminer**, **app** on ports 5432, 8081, 3000.
- [ ] `npx prisma migrate dev` and `db seed` run successfully in container.
- [ ] Login works with `coordinator@example.com / Passw0rd!` (from seed).
- [ ] `/calendar` shows seeded events; requirement meters render; dragging a volunteer updates counts.
- [ ] Roster drawer allows marking **present / no_show / partial** and setting **hours**.
- [ ] `/volunteers` CRUD and CSV import/export.
- [ ] `/tasks` list with open/done.
- [ ] `/reports/hours` exports CSV with correct totals.

---

## 15) Nice‑to‑Have (Post‑MVP)

- Public self‑signup link per shift with manager approval.
- Email/SMS reminders (MailHog container for dev; Twilio for prod).
- Redis + BullMQ for scheduled reminders and auto‑task creation.
- ICS feed per volunteer.
- Mobile “kiosk” check‑in (QR) to stamp attendance.

---

## 16) Notes for the Agent

- Prefer simplicity over frameworks sprawl; keep deps minimal.
- Handle time zones explicitly; store UTC in DB; display in local TZ.
- Prevent double‑booking by unique constraint `(volunteerId, shiftId)` and by overlapping ranges check during assign.
- When computing default **hours**, use `(shift.end - shift.start) - breaks` (breaks optional). Allow manual override.
- All code should be TypeScript with strict mode.
- Keep secrets in `.env`, not committed.
- 200‑line maximum per file guideline where feasible; extract services/helpers.
- Add `Makefile` targets for common tasks (optional).

---

## 17) Quickstart for Humans

```bash
# Start containers
docker compose up -d --build

# Migrate & seed
docker compose exec app npx prisma migrate dev --name init
docker compose exec app npx prisma db seed

# Open UI
xdg-open http://localhost:3000/calendar || open http://localhost:3000/calendar

# DB console
xdg-open http://localhost:8081 || open http://localhost:8081
```

---

**End of AGENTS.md**
