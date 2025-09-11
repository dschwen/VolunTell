
# Volunteer Scheduler — Starter

A minimal starter for a self-hosted volunteer scheduling app (Next.js + Postgres).

## Quickstart

```bash
docker compose up -d --build
docker compose exec app npx prisma migrate dev --name init
docker compose exec app npx prisma db seed
```

Open http://localhost:3000/calendar

DB console: http://localhost:8081

Login (seeded): `coordinator@example.com / Passw0rd!` (auth not fully wired in MVP UI yet).

## Development

- API routes under `pages/api/...`.
- Calendar page at `pages/calendar.tsx` uses mock server-side data; wire to DB next.
- Prisma schema in `prisma/schema.prisma`; seed in `prisma/seed.ts`.
- Edit `docker-compose.yml` to tweak ports/volumes.

## Database Migration (Recommended)

Use a logical dump/restore with `pg_dump` and `pg_restore`. This is safe across Postgres versions and preserves schema and data.

Prereqs
- Source and destination both use the provided `docker-compose.yml` (Postgres user/db/password are `app`).
- On Linux/macOS shells, the `-T` flag avoids TTY issues when piping.

1) Create a dump on the source server

Option A — run inside the DB container (recommended):

```bash
docker compose exec -T db pg_dump -U app -d app -Fc > backup.dump
```

Option B — from host using the exposed port (compose maps `55432:5432`):

```bash
PGPASSWORD=app pg_dump -h localhost -p 55432 -U app -d app -Fc -f backup.dump
```

2) Move the dump to the destination server

Copy `backup.dump` to the new machine (e.g., `scp backup.dump <dest>:/path/`).

3) Bring up Postgres on the destination

```bash
docker compose up -d db
```

4) Restore the dump

```bash
docker compose exec -T db pg_restore -U app -d app --clean --if-exists < backup.dump
```

5) Start the app and apply migrations (schema drift safeguard)

```bash
docker compose up -d --build
docker compose exec app npx prisma migrate deploy
```

Notes
- Do not run the seed script when restoring a real backup. Only use `prisma db seed` for empty databases.
- Data is persisted in a Docker named volume (`pgdata`) mounted at `/var/lib/postgresql/data`. You can inspect it with:

```bash
docker volume ls | grep pgdata
docker volume inspect <project>_pgdata
```

Advanced (not recommended unless versions match)
- You can copy the raw volume data directory instead of a dump, but only when both sides run the same major Postgres version (16). The dump/restore flow above is the portable, safer option.

## CSV Import (Volunteers)

You can import volunteers from a CSV on the Volunteers page via the “Import CSV” button. The CSV must include these column headers (case-insensitive):

- `First Name`
- `Last Name`
- `Email`
- `Phone Number`

Behavior
- Name is built as `First Name + Last Name`.
- Upserts by `Email` when present (unique). If email is empty, matches by `Phone Number` if possible; otherwise creates a new volunteer.
- Shows a summary of created/updated/skipped and any row errors after import.
