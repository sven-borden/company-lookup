# Backend Contract

All backend access is either a **server-side data layer function** (called directly by Next.js server components) or an **HTTP API route** (called by the admin UI). There is no public REST API.

---

## Data Layer — `lib/data/companies.ts`

### `browseCompanies(filters?)`

```ts
browseCompanies(filters?: BrowseFilters): Promise<BrowseResult>
```

Paginates and filters companies for the Browse page.

**`BrowseFilters`**

| Field       | Type                                          | Default  | Description                          |
|-------------|-----------------------------------------------|----------|--------------------------------------|
| `page`      | `number`                                      | `1`      | 1-based page number                  |
| `pageSize`  | `number`                                      | `20`     | Items per page (clamped to 1–100)    |
| `canton`    | `string`                                      | —        | Filter by canton code (e.g. `"ZH"`) |
| `sortBy`    | `"name" \| "uid" \| "canton" \| "status"`    | `"name"` | Field to sort by                     |
| `sortOrder` | `"asc" \| "desc"`                            | `"asc"`  | Sort direction                       |

**`BrowseResult`**

```ts
{
  companies: CompanyShort[];
  total: number;       // total matching companies
  page: number;
  pageSize: number;
  totalPages: number;
}
```

**Firestore strategy**

- `sortBy = "name"` maps to the stored `nameLower` field for case-insensitive sorting.
- Canton filter uses `.where("canton", "==", canton)`.
- Pagination via `.offset((page-1) * pageSize).limit(pageSize)`.
- Total count via Firestore `.count()` aggregation (same filters, no sort/limit), run in parallel with the data fetch.
- Composite indexes in `firestore.indexes.json` cover all `canton + sortField` combinations.

---

### `searchCompanies(name, filters?)`

```ts
searchCompanies(name: string, filters?: SearchFilters): Promise<CompanyShort[]>
```

Prefix-searches companies by name. Returns up to 20 results. Returns `[]` if `name` is empty.

**`SearchFilters`**

| Field         | Type      | Description                        |
|---------------|-----------|------------------------------------|
| `canton`      | `string`  | Filter by canton code              |
| `legalFormId` | `number`  | Filter by legal form ID            |
| `activeOnly`  | `boolean` | Filter to `status === "ACTIVE"` only |

**Firestore strategy**

- Normalises `name` to lowercase, then queries `nameLower >= name` and `nameLower <= name + "\uf8ff"` (standard Firestore prefix pattern).
- `canton` and `activeOnly` filters applied as additional `.where()` clauses.
- Note: `legalFormId` is defined on `SearchFilters` but not yet applied in the query — reserved for future use.

---

### `getCompanyByUid(uid)`

```ts
getCompanyByUid(uid: string): Promise<CompanyFull | null>
```

Fetches a single company document by its UID (Firestore document ID). Returns `null` if not found or `uid` is empty.

---

## Data Layer — `lib/data/reference.ts`

Simple `getAll` helpers that fetch entire reference collections. No filters, no pagination.

| Function           | Collection    | Return type              |
|--------------------|---------------|--------------------------|
| `getLegalForms()`  | `legalForms`  | `Promise<LegalForm[]>`   |
| `getCommunities()` | `communities` | `Promise<BfsCommunity[]>` |
| `getRegistries()`  | `registries`  | `Promise<RegistryOfCommerce[]>` |

Types are defined in `@company-lookup/types`.

---

## Admin API Routes — `/api/admin/`

All routes use Firebase Admin SDK and run server-side. There is no authentication middleware — these routes should only be exposed to admin users via UI-level access control.

---

### `GET /api/admin/cron-logs`

Returns the last 20 cron execution log entries, ordered by `startTime` descending.

**Response** `200 OK`

```ts
Array<{
  id: string;           // Firestore document ID
  functionName: string; // e.g. "manualSync" or "manualSync:ZH"
  startTime: string;    // ISO date (converted from Firestore Timestamp)
  endTime: string;      // ISO date
  status: "running" | "success" | "failed";
  cantons: string[];
  totalSynced?: number;
  results?: Record<string, number>; // canton → count synced (-1 on error)
  error?: string;
}>
```

**Error** `500` `{ "error": "Failed to fetch logs" }`

---

### `GET /api/admin/stats/cantons`

Returns per-canton company counts and last sync timestamps from the `canton_stats` collection.

**Response** `200 OK`

```ts
Record<string, {        // keyed by canton code, e.g. "ZH"
  totalCompanies: number;
  lastSyncedAt: string; // ISO date (converted from Firestore Timestamp)
}>
```

**Error** `500` `{ "error": "Failed to fetch stats" }`

---

### `POST /api/admin/sync/trigger`

Triggers a sync for the cantons scheduled for today's day of the week (based on `CANTON_SCHEDULE` from `@company-lookup/types`). No request body required.

**Sync logic**

- Determines today's cantons via `CANTON_SCHEDULE[dayOfWeek]`.
- For each canton: searches Zefix with `name: "*"`, fetches full company details, batch-writes to Firestore in batches of 500.
- Creates a `cron_logs` entry with `functionName: "manualSync"`, updated on completion.

**Response** `200 OK`

```ts
{
  status: "success";
  totalSynced: number;
  results: Record<string, number>; // canton → count synced (-1 on error)
}
```

**Error** `500` `{ "error": "Sync failed" }`

---

### `POST /api/admin/sync/[canton]`

Triggers a full sync for a specific canton. No request body required.

**Sync logic**

- Iterates over alphabet prefixes (`a`–`z`), calling Zefix search for each. If a prefix returns a `RESULTLIST_TO_LARGE` error, it recurses with an additional letter prefix.
- Deduplicates results by `ehraid` before fetching full company details.
- Batch-writes to Firestore in batches of 500.
- Updates `canton_stats/{canton}` with `totalCompanies` and `lastSyncedAt`.
- Creates a `cron_logs` entry with `functionName: "manualSync:{CANTON}"`.

**Response** `200 OK`

```ts
{
  canton: string;      // uppercased canton code
  synced: number;      // companies written in this run
  totalInDb: number;   // total for this canton after sync
}
```

**Error** `500` `{ "error": "<message>" }`
