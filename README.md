
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
