# SwissBizHunter

Business intelligence & acquisition platform for **Canton Vaud**. Powered by Zefix, augmented by scraping and AI.

## Architecture

- **Frontend**: Next.js 16 (App Router), Tailwind CSS 4
- **Database**: PostgreSQL via Drizzle ORM — the sync runs inside the Next.js app, there is no separate backend service
- **Shared types**: `@swiss-biz-hunter/types` package
- **Hosting**: Docker image (see `Dockerfile`), deployed on Coolify

**Data flow**: `Zefix API -> POST /api/admin/sync (nightly cron) -> PostgreSQL -> Next.js frontend`

## Scope

The platform covers **Vaud only**. `CANTON` in `packages/types/src/zefix.ts` is the single source of truth; companies from other cantons are purged on boot (see `apps/web/src/lib/db/init.ts`).

## Project Structure

```
company-lookup/
├── apps/web/          # Next.js 16 app — UI, data layer, sync engine, admin API
├── packages/types/    # Shared TypeScript types
├── compose.yml        # Local dev PostgreSQL 17
└── Dockerfile         # Multi-stage production image
```

## Setup

1. Clone the repo and install dependencies:

```bash
npm install
```

2. Start the local database (PostgreSQL 17 Alpine):

```bash
docker compose up -d
```

3. Copy `.env.example` to `apps/web/.env.local`. Next.js only loads `.env.local` from its own app directory, and the default `DATABASE_URL` already points at the compose database:

```bash
cp .env.example apps/web/.env.local
```

4. Start the dev server (port 3001):

```bash
npm run dev
```

The schema is created on first boot by `initializeDatabase()` (`apps/web/src/lib/db/init.ts`), invoked from `instrumentation.ts` — no migration step to run.

## Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Next.js dev server on port 3001 |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest |

## Environment Variables

See `.env.example`:

- `DATABASE_URL` — PostgreSQL connection string (required to boot)
- `ZEFIX_USERNAME` / `ZEFIX_PASSWORD` / `ZEFIX_API_BASE_URL` — Zefix PublicREST Basic Auth

## Sync

A nightly Coolify scheduled task (`zefix-daily-sync`, `15 2 * * *`) posts to `/api/admin/sync`. The route returns `202` immediately and runs the sync detached, so the cron's `curl` can't be killed by the SSH command timeout — progress and results land in the `sync_logs` table and are visible at `/admin/dashboard`.
