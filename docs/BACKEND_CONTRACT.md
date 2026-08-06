# Backend Contract

All backend access is either a **server-side data layer function** (called directly by Next.js server components) or an **HTTP API route** (called by the admin UI or the nightly cron). There is no public REST API.

Storage is PostgreSQL, accessed through Drizzle ORM. The platform covers **Canton Vaud only** — `CANTON` in `@swiss-biz-hunter/types` is the single source of truth, and no query takes a canton parameter.

---

## Data Layer — `lib/data/companies.ts`

### `browseCompanies(filters?)`

```ts
browseCompanies(filters?: BrowseFilters): Promise<BrowseResult>
```

Paginates companies for the Browse page.

**`BrowseFilters`**

| Field       | Type                              | Default  | Description                       |
|-------------|-----------------------------------|----------|-----------------------------------|
| `page`      | `number`                          | `1`      | 1-based page number (clamped to ≥1) |
| `pageSize`  | `number`                          | `20`     | Items per page (clamped to 1–100) |
| `sortBy`    | `"name" \| "uid" \| "status"`     | `"name"` | Field to sort by                  |
| `sortOrder` | `"asc" \| "desc"`                 | `"asc"`  | Sort direction                    |

**`BrowseResult`**

```ts
{
  companies: CompanyShort[];
  total: number;       // total rows in the table
  page: number;
  pageSize: number;
  totalPages: number;
}
```

**Query strategy**

- No `WHERE` clause — every row is Vaud.
- `ORDER BY <sortBy> <sortOrder> LIMIT pageSize OFFSET (page-1)*pageSize`, served by `idx_companies_name` for the default sort.
- Total via `COUNT(*)`, run in parallel with the page fetch.

---

### `searchCompanies(name)`

```ts
searchCompanies(name: string): Promise<CompanyShort[]>
```

Searches companies by name. Returns up to 20 results. Returns `[]` if `name` is empty or whitespace-only.

**Query strategy**

- Matches on `name ILIKE '<escaped>%'` **OR** `similarity(name, q) > 0.15` (pg_trgm), so both prefix and fuzzy hits are returned. `%` and `_` in the input are escaped for the ILIKE arm.
- Ordered by `similarity(name, q) DESC, name`.
- Backed by `idx_companies_name_trgm`, a GIN trigram index.

---

### `getCompanyByUid(uid)`

```ts
getCompanyByUid(uid: string): Promise<CompanyFull | null>
```

Fetches a single company plus its address, officers and shareholders. Returns `null` if not found or `uid` is empty.

A bare 9-digit input (`CHE123456789`) is normalised to canonical form (`CHE-123.456.789`) before lookup.

---

## Admin API Routes — `/api/admin/`

Server-side, no authentication middleware — these routes should only be exposed to admin users via network or UI-level access control.

---

### `POST /api/admin/sync`

Triggers a full Vaud sync. No request body. This is the nightly cron target (Coolify scheduled task `zefix-daily-sync`, `15 2 * * *`).

**Sync logic** — `syncVaud()` in `lib/sync/sync-vaud.ts`

- Fires all 26 single-letter name prefixes at the Zefix search endpoint in parallel. A prefix that returns `RESULTLIST_TO_LARGE` recurses with an additional letter.
- Deduplicates by `ehraid`, then fetches full details with a concurrency cap of 25. Individual detail failures are skipped.
- Upserts in batches of 100 via `INSERT ... ON CONFLICT (uid) DO UPDATE`; addresses are upserted per row.
- Refreshes `canton_stats` with `totalCompanies` and `lastSyncedAt`.
- Creates a `sync_logs` row with `functionName: "sync-vaud"`, updated on completion.

**Response** `202 Accepted` — the sync runs detached, so the cron's `curl` returns immediately rather than being killed by Coolify's SSH command timeout.

```ts
{ status: "started"; logId: number }
```

**Conflict** `409` `{ "status": "already-running" }` — a sync is in flight on this server process.

Progress and the final result live in `sync_logs`; poll `GET /api/admin/cron-logs`.

---

### `GET /api/admin/stats`

Returns the Vaud company count and last sync time from `canton_stats`.

**Response** `200 OK`

```ts
{
  totalCompanies: number;
  lastSyncedAt: string | null;  // ISO date
}
```

**Error** `500` `{ "error": "Failed to fetch stats" }`

---

### `GET /api/admin/cron-logs`

Returns the last 20 sync log entries, ordered by `startTime` descending.

**Response** `200 OK`

```ts
Array<{
  id: number;
  functionName: string;  // "sync-vaud"
  startTime: string;     // ISO date
  endTime?: string;      // ISO date
  status: "running" | "success" | "failed";
  cantons: string[];     // always ["VD"]
  totalSynced?: number;
  error?: string;
}>
```

**Error** `500` `{ "error": "Failed to fetch logs" }`

Note: a process restart mid-sync leaves its row stuck at `status: "running"` — nothing reconciles orphaned runs on boot.
