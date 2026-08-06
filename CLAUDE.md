# SwissBizHunter — Claude Code Instructions

Business acquisition intelligence platform for **Canton Vaud**. Monorepo powered by Zefix PublicREST API, scraping, and AI.

## Scope

Vaud only. `CANTON` in `packages/types/src/zefix.ts` is the single source of truth — do not reintroduce a canton list, a canton filter, or per-canton routing. Companies outside VD are purged in the background on boot by `purgeOtherCantons()` in `apps/web/src/lib/db/init.ts`.

## Architecture

- **Frontend**: `apps/web/` — Next.js 16 (App Router), Tailwind CSS 4
- **Database**: PostgreSQL + Drizzle ORM. The sync engine and admin API live inside the Next.js app; there is no separate backend service.
- **Shared types**: `packages/types/` — `@swiss-biz-hunter/types`
- **Hosting**: Docker image (`Dockerfile`) on Coolify

**Data flow**: `Zefix API → POST /api/admin/sync (nightly cron) → PostgreSQL → Next.js frontend`

## Dev Commands (run from monorepo root)

```bash
npm install          # install all workspaces
docker compose up -d # local PostgreSQL 17 (compose.yml) — dev only
npm run dev          # Next.js on port 3001
npm run build        # build web app
npm run lint         # lint
npm test             # vitest
```

## Environment Setup

Next.js only loads `.env.local` from its own app directory.

- **Required file**: `apps/web/.env.local` (not `/.env.local`)
- Copy from `.env.example` and fill in values

### Required vars

```
DATABASE_URL                 # PostgreSQL connection string — app cannot boot without it
ZEFIX_USERNAME / ZEFIX_PASSWORD / ZEFIX_API_BASE_URL
```

The `DATABASE_URL` in `.env.example` points at the local `compose.yml` database. Production uses the Coolify-managed `company-lookup-db` service.

## Database

Schema is created on boot by `initializeDatabase()` (`apps/web/src/lib/db/init.ts`), invoked from `instrumentation.ts`. It is raw `CREATE TABLE IF NOT EXISTS` DDL, **not** Drizzle migrations.

The schema is declared twice — `db/schema.ts` (Drizzle DSL, drives queries) and `db/init.ts` (raw SQL, what actually executes). Any column or index change must be made in **both**.

`DELETE` does not return disk to the OS. After a large purge, run once manually during a quiet window (it takes an `ACCESS EXCLUSIVE` lock):

```sql
VACUUM (FULL, ANALYZE) companies;
```

## Sync

`syncVaud()` in `apps/web/src/lib/sync/sync-vaud.ts`. Zefix has no "list all" endpoint, so discovery brute-forces name prefixes `a`–`z` in parallel; an oversized result set throws `RESULTLIST_TO_LARGE` and recurses into sub-prefixes. **That recursion depends on `zefixPost` embedding the response body in the thrown error** — don't strip it.

`POST /api/admin/sync` returns `202` and runs the sync detached so the Coolify cron's `curl` can't be killed by the SSH command timeout. A `globalThis` flag rejects overlapping runs with `409`. Results land in `sync_logs`, shown at `/admin/dashboard`.

Cron: Coolify scheduled task `zefix-daily-sync`, `15 2 * * *`.

## Key Files

| File | Purpose |
|------|---------|
| `apps/web/src/lib/db/init.ts` | Boot-time DDL, indexes, non-VD purge |
| `apps/web/src/lib/db/schema.ts` | Drizzle schema + relations |
| `apps/web/src/lib/data/companies.ts` | Query layer (browse, search, detail) |
| `apps/web/src/lib/sync/sync-vaud.ts` | Zefix sync engine |
| `apps/web/src/app/api/admin/sync/route.ts` | Sync trigger (cron target) |
| `apps/web/src/app/company/[uid]/page.tsx` | Company detail page |

## Known Gaps

- Admin routes have **no authentication**. `POST /api/admin/sync` is anonymously reachable and starts an hours-long crawl.
- `officers` / `shareholders` tables have a read path but no writer — the Vaud cantonal-register scraper that populated them was removed.

## Styling

"Swiss Modern" aesthetic — see `docs/Branding.md` for full guide. Key points:
- Geist Sans/Mono typefaces, no rounded corners (max 4–8px radius)
- Monochromatic palette + single accent: `red-600` (light) / `red-500` (dark)
- No shadows, no gradients; borders via `zinc-200`/`zinc-800`
