# SwissBizHunter Project Context

A professional business intelligence tool for identifying and evaluating acquisition targets in **Canton Vaud**. It leverages Zefix data as a foundation, augmented with scraping and AI-powered insights.

## Architecture & Tech Stack

- **Frontend**: Next.js 16 (App Router) with Tailwind CSS 4.
- **Database**: PostgreSQL accessed through Drizzle ORM. The sync engine and admin API run inside the Next.js app — there is no separate backend service.
- **Shared Package**: `@swiss-biz-hunter/types` for TypeScript definitions.
- **Data Source**: Swiss Federal Commercial Registry (Zefix) PublicREST API.
- **Hosting**: Docker image (`Dockerfile`) deployed on Coolify.

### Project Structure

- `apps/web/`: The Next.js 16 web application.
  - `src/lib/db/`: Drizzle schema, connection, and boot-time DDL (`init.ts`).
  - `src/lib/data/`: Query layer used by server components.
  - `src/lib/sync/sync-vaud.ts`: The Zefix sync engine.
  - `src/app/api/admin/`: Admin API routes (sync trigger, stats, cron logs).
- `packages/types/`: Shared TypeScript types and interfaces.

## Scope

The platform covers **Vaud only**. `CANTON` in `packages/types/src/zefix.ts` is the single source of truth. Companies from other cantons are purged in the background on boot by `purgeOtherCantons()` in `apps/web/src/lib/db/init.ts`.

## Key Data Flow

`Zefix API -> POST /api/admin/sync -> PostgreSQL -> Next.js frontend`

`syncVaud()` in `apps/web/src/lib/sync/sync-vaud.ts` runs nightly (Coolify scheduled task `zefix-daily-sync`, `15 2 * * *` Zurich):

1. Discovers companies by firing all 26 single-letter name prefixes at Zefix in parallel. Zefix has no "list all" endpoint; an oversized result set (`RESULTLIST_TO_LARGE`) recurses into sub-prefixes.
2. Deduplicates by `ehraid`, then fetches full details with a concurrency cap of 25.
3. Upserts in batches of 100 (`INSERT ... ON CONFLICT (uid) DO UPDATE`), then refreshes the `canton_stats` row.

The route returns `202` and runs the sync detached so Coolify's SSH command timeout can't kill it; results land in `sync_logs`.

## Development & Operations

### Building and Running

- **Install dependencies**: `npm install` (from the root).
- **Local database**: `docker compose up -d` (PostgreSQL 17 Alpine, `compose.yml`, dev only — production uses the Coolify-managed `company-lookup-db`).
- **Development**: `npm run dev` (starts Next.js on port 3001).
- **Build**: `npm run build`.
- **Linting**: `npm run lint`.
- **Tests**: `npm test` (Vitest).

The database schema is created on boot by `initializeDatabase()` via `instrumentation.ts` — raw `CREATE TABLE IF NOT EXISTS` DDL, not Drizzle migrations.

### Environment Variables

Required variables (see `.env.example`):
- `DATABASE_URL`: PostgreSQL connection string. The app cannot boot without it.
- `ZEFIX_USERNAME`: Basic auth username for Zefix API.
- `ZEFIX_PASSWORD`: Basic auth password for Zefix API.
- `ZEFIX_API_BASE_URL`: Defaults to `https://www.zefix.admin.ch/ZefixPublicREST`.

### Development Conventions

- **Monorepo**: Uses NPM workspaces. Add dependencies to specific workspaces using `-w apps/web`, etc.
- **TypeScript**: Strictly typed using the shared `@swiss-biz-hunter/types` package.
- **Schema is declared twice**: `src/lib/db/schema.ts` (Drizzle DSL, used for queries) and `src/lib/db/init.ts` (raw SQL, what actually runs). Changes must be made in both.
- **Styling**: Tailwind CSS 4 is used for the frontend.
