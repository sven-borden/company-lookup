import { sql } from "drizzle-orm";
import { db } from "./index";

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

  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_companies_canton ON companies(canton)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_companies_name_trgm ON companies USING GIN (name gin_trgm_ops)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_officers_company_uid ON officers(company_uid)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_shareholders_company_uid ON shareholders(company_uid)`);
}
