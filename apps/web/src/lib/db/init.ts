import { sql } from "drizzle-orm";
import { db } from "./index";
import { CANTON } from "@swiss-biz-hunter/types";

const PURGE_BATCH_SIZE = 20000;

// Inlined as a SQL literal rather than a bind parameter. PostgreSQL rejects
// parameters in DDL — a partial index predicate carrying $1 fails with
// "42P18: could not determine data type of parameter $1" — and the purge
// statements below use the same form for consistency. CANTON is a compile-time
// constant, never user input, so there is nothing to inject.
const CANTON_SQL = sql.raw(`'${CANTON}'`);

/**
 * Drop every company outside the target canton. The platform used to sync all
 * 26 cantons; those rows are now dead weight.
 *
 * Runs in batches so no single statement holds a huge transaction, and is
 * fire-and-forget so a first boot against a full multi-canton database serves
 * traffic immediately instead of failing its health check while ~700k rows
 * drain. `idx_companies_non_target_canton` is a partial index over exactly the
 * rows this deletes, so once the drain is done every later boot resolves this
 * against an empty index instead of scanning the table.
 *
 * Note: DELETE does not return disk to the OS — run `VACUUM (FULL, ANALYZE)
 * companies` manually once the drain completes.
 */
export async function purgeOtherCantons() {
  let removed = 0;

  for (;;) {
    const result = await db.execute(sql`
      DELETE FROM companies WHERE ctid IN (
        SELECT ctid FROM companies WHERE canton <> ${CANTON_SQL} LIMIT ${sql.raw(String(PURGE_BATCH_SIZE))}
      )
    `);

    const deleted = result.count ?? 0;
    if (deleted === 0) break;

    removed += deleted;
    console.log(`[purge] removed ${removed} non-${CANTON} companies so far`);
  }

  await db.execute(sql`DELETE FROM canton_stats WHERE canton <> ${CANTON_SQL}`);

  if (removed > 0) {
    console.log(`[purge] done — ${removed} non-${CANTON} companies removed. Run VACUUM (FULL, ANALYZE) companies to reclaim disk.`);
  }
}

export async function initializeDatabase() {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS companies (
      uid TEXT PRIMARY KEY,
      ehraid INTEGER UNIQUE,
      chid TEXT,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      canton TEXT NOT NULL,
      legal_seat TEXT,
      legal_seat_id INTEGER,
      legal_form_id INTEGER,
      legal_form_uid TEXT,
      legal_form_name_de TEXT,
      legal_form_name_fr TEXT,
      legal_form_name_it TEXT,
      legal_form_name_en TEXT,
      legal_form_short_de TEXT,
      purpose TEXT,
      capital_nominal NUMERIC,
      capital_currency TEXT,
      sogc_date TEXT,
      deletion_date TEXT,
      registry_of_commerce_id INTEGER,
      cantonal_excerpt_web TEXT,
      zefix_detail_web JSONB,
      sogc_pub JSONB,
      old_names JSONB,
      translations JSONB,
      head_offices JSONB,
      further_head_offices JSONB,
      branch_offices JSONB,
      has_taken_over JSONB,
      was_taken_over_by JSONB,
      audit_companies JSONB,
      synced_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS company_addresses (
      company_uid TEXT PRIMARY KEY REFERENCES companies(uid) ON DELETE CASCADE,
      organisation TEXT,
      care_of TEXT,
      street TEXT,
      house_number TEXT,
      addon TEXT,
      po_box TEXT,
      city TEXT,
      swiss_zip_code TEXT
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS officers (
      id SERIAL PRIMARY KEY,
      company_uid TEXT NOT NULL REFERENCES companies(uid) ON DELETE CASCADE,
      name TEXT NOT NULL,
      role TEXT,
      signature_type TEXT,
      source TEXT,
      enriched_at TIMESTAMPTZ
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS shareholders (
      id SERIAL PRIMARY KEY,
      company_uid TEXT NOT NULL REFERENCES companies(uid) ON DELETE CASCADE,
      name TEXT NOT NULL,
      shares TEXT,
      source TEXT,
      enriched_at TIMESTAMPTZ
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS canton_stats (
      canton TEXT PRIMARY KEY,
      total_companies INTEGER,
      last_synced_at TIMESTAMPTZ
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sync_logs (
      id SERIAL PRIMARY KEY,
      function_name TEXT,
      start_time TIMESTAMPTZ,
      end_time TIMESTAMPTZ,
      status TEXT,
      cantons JSONB,
      total_synced INTEGER,
      results JSONB,
      error TEXT
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS recent_searches (
      term TEXT PRIMARY KEY,
      searched_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Partial index over the rows purgeOtherCantons() deletes. Empty (and so
  // ~free) once the drain finishes, unlike the full canton index it replaces —
  // which indexed a column that is now the same value on every row.
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_companies_non_target_canton
    ON companies(canton) WHERE canton <> ${CANTON_SQL}
  `);
  await db.execute(sql`DROP INDEX IF EXISTS idx_companies_canton`);
  // Serves /browse, which is ORDER BY name with LIMIT/OFFSET. The GIN trigram
  // index below powers similarity search but cannot drive an ordered scan.
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_companies_name_trgm ON companies USING GIN (name gin_trgm_ops)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_officers_company_uid ON officers(company_uid)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_shareholders_company_uid ON shareholders(company_uid)`);

  // Detached on purpose — see purgeOtherCantons().
  void purgeOtherCantons().catch((err) => console.error("[purge] failed:", err));
}
