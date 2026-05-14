import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, companyAddresses, officers, shareholders, cantonStats, syncLogs } from "@/lib/db/schema";
import type { CompanyFull, CantonalEnrichment } from "@swiss-biz-hunter/types";

const DETAIL_CONCURRENCY = 10;
const UPSERT_BATCH_SIZE = 100;
const MAX_SOGC_PUB = 100;

function createPool(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const run = () => {
        active++;
        fn().then(resolve, reject).finally(() => {
          active--;
          if (queue.length > 0) queue.shift()!();
        });
      };
      if (active < concurrency) run();
      else queue.push(run);
    });
  };
}

function makeAuthHeader(): string {
  const username = process.env.ZEFIX_USERNAME ?? "";
  const password = process.env.ZEFIX_PASSWORD ?? "";
  return "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
}

async function zefixPost<T>(path: string, body: unknown): Promise<T> {
  const baseUrl = (process.env.ZEFIX_API_BASE_URL ?? "https://www.zefix.admin.ch/ZefixPublicREST").replace(/\/$/, "");
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: makeAuthHeader() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = "";
    try { detail = ` — ${await res.text()}`; } catch { /* ignore */ }
    throw new Error(`Zefix POST ${path} failed: ${res.status}${detail}`);
  }
  return res.json();
}

async function zefixGet<T>(path: string): Promise<T> {
  const baseUrl = (process.env.ZEFIX_API_BASE_URL ?? "https://www.zefix.admin.ch/ZefixPublicREST").replace(/\/$/, "");
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: makeAuthHeader() },
  });
  if (!res.ok) {
    let detail = "";
    try { detail = ` — ${await res.text()}`; } catch { /* ignore */ }
    throw new Error(`Zefix GET ${path} failed: ${res.status}${detail}`);
  }
  return res.json();
}

async function fetchCompaniesForPrefix(
  prefix: string,
  canton: string
): Promise<Array<{ ehraid: number }>> {
  try {
    return await zefixPost<Array<{ ehraid: number }>>("/api/v1/company/search", {
      name: `${prefix}*`,
      canton,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("RESULTLIST_TO_LARGE")) {
      const results: Array<{ ehraid: number }> = [];
      for (const letter of "abcdefghijklmnopqrstuvwxyz") {
        const sub = await fetchCompaniesForPrefix(`${prefix}${letter}`, canton);
        results.push(...sub);
      }
      return results;
    }
    throw err;
  }
}

function companyToRow(full: CompanyFull, canton: string) {
  const sogcPub = full.sogcPub
    ? [...full.sogcPub].sort((a, b) => b.sogcDate.localeCompare(a.sogcDate)).slice(0, MAX_SOGC_PUB)
    : null;

  return {
    uid: full.uid,
    ehraid: full.ehraid ?? null,
    chid: full.chid ?? null,
    name: full.name,
    status: full.status,
    canton: full.canton ?? canton,
    legalSeat: full.legalSeat ?? null,
    legalSeatId: full.legalSeatId ?? null,
    legalFormId: full.legalForm?.id ?? null,
    legalFormUid: full.legalForm?.uid ?? null,
    legalFormNameDe: full.legalForm?.name?.de ?? null,
    legalFormNameFr: full.legalForm?.name?.fr ?? null,
    legalFormNameIt: full.legalForm?.name?.it ?? null,
    legalFormNameEn: full.legalForm?.name?.en ?? null,
    legalFormShortDe: full.legalForm?.shortName?.de ?? null,
    purpose: full.purpose ?? null,
    capitalNominal: full.capitalNominal ? String(full.capitalNominal) : null,
    capitalCurrency: full.capitalCurrency ?? null,
    sogcDate: full.sogcDate ?? null,
    deletionDate: full.deletionDate ?? null,
    registryOfCommerceId: full.registryOfCommerceId ?? null,
    cantonalExcerptWeb: full.cantonalExcerptWeb ?? null,
    zefixDetailWeb: full.zefixDetailWeb ?? null,
    sogcPub: sogcPub,
    oldNames: full.oldNames ?? null,
    translations: full.translation ?? null,
    headOffices: full.headOffices ?? null,
    furtherHeadOffices: full.furtherHeadOffices ?? null,
    branchOffices: full.branchOffices ?? null,
    hasTakenOver: full.hasTakenOver ?? null,
    wasTakenOverBy: full.wasTakenOverBy ?? null,
    auditCompanies: full.auditCompanies ?? null,
    syncedAt: new Date(),
  };
}

async function upsertBatch(
  batch: Array<{ full: CompanyFull; enrichment?: CantonalEnrichment }>,
  canton: string
) {
  const rows = batch.map(({ full }) => companyToRow(full, canton));

  await db.insert(companies).values(rows).onConflictDoUpdate({
    target: companies.uid,
    set: {
      ehraid: sql`excluded.ehraid`,
      chid: sql`excluded.chid`,
      name: sql`excluded.name`,
      status: sql`excluded.status`,
      canton: sql`excluded.canton`,
      legalSeat: sql`excluded.legal_seat`,
      legalSeatId: sql`excluded.legal_seat_id`,
      legalFormId: sql`excluded.legal_form_id`,
      legalFormUid: sql`excluded.legal_form_uid`,
      legalFormNameDe: sql`excluded.legal_form_name_de`,
      legalFormNameFr: sql`excluded.legal_form_name_fr`,
      legalFormNameIt: sql`excluded.legal_form_name_it`,
      legalFormNameEn: sql`excluded.legal_form_name_en`,
      legalFormShortDe: sql`excluded.legal_form_short_de`,
      purpose: sql`excluded.purpose`,
      capitalNominal: sql`excluded.capital_nominal`,
      capitalCurrency: sql`excluded.capital_currency`,
      sogcDate: sql`excluded.sogc_date`,
      deletionDate: sql`excluded.deletion_date`,
      registryOfCommerceId: sql`excluded.registry_of_commerce_id`,
      cantonalExcerptWeb: sql`excluded.cantonal_excerpt_web`,
      zefixDetailWeb: sql`excluded.zefix_detail_web`,
      sogcPub: sql`excluded.sogc_pub`,
      oldNames: sql`excluded.old_names`,
      translations: sql`excluded.translations`,
      headOffices: sql`excluded.head_offices`,
      furtherHeadOffices: sql`excluded.further_head_offices`,
      branchOffices: sql`excluded.branch_offices`,
      hasTakenOver: sql`excluded.has_taken_over`,
      wasTakenOverBy: sql`excluded.was_taken_over_by`,
      auditCompanies: sql`excluded.audit_companies`,
      syncedAt: sql`NOW()`,
    },
  });

  for (const { full: company, enrichment } of batch) {
    if (company.address) {
      await db.insert(companyAddresses).values({
        companyUid: company.uid,
        organisation: company.address.organisation ?? null,
        careOf: company.address.careOf ?? null,
        street: company.address.street ?? null,
        houseNumber: company.address.houseNumber ?? null,
        addon: company.address.addon ?? null,
        poBox: company.address.poBox ?? null,
        city: company.address.city ?? null,
        swissZipCode: company.address.swissZipCode ?? null,
      }).onConflictDoUpdate({
        target: companyAddresses.companyUid,
        set: {
          organisation: sql`excluded.organisation`,
          careOf: sql`excluded.care_of`,
          street: sql`excluded.street`,
          houseNumber: sql`excluded.house_number`,
          addon: sql`excluded.addon`,
          poBox: sql`excluded.po_box`,
          city: sql`excluded.city`,
          swissZipCode: sql`excluded.swiss_zip_code`,
        },
      });
    }

    if (enrichment) {
      await db.delete(officers).where(eq(officers.companyUid, company.uid));
      await db.delete(shareholders).where(eq(shareholders.companyUid, company.uid));

      if (enrichment.officers.length > 0) {
        await db.insert(officers).values(
          enrichment.officers.map((o) => ({
            companyUid: company.uid,
            name: o.name,
            role: o.role ?? null,
            signatureType: o.signatureType ?? null,
            source: enrichment.source,
            enrichedAt: new Date(enrichment.enrichedAt),
          }))
        );
      }

      if (enrichment.shareholders.length > 0) {
        await db.insert(shareholders).values(
          enrichment.shareholders.map((s) => ({
            companyUid: company.uid,
            name: s.name,
            shares: s.shares ?? null,
            source: enrichment.source,
            enrichedAt: new Date(enrichment.enrichedAt),
          }))
        );
      }
    }
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ canton: string }> }
) {
  const { canton } = await params;
  const cantonUpper = canton.toUpperCase();
  const startTime = new Date();

  const [logRow] = await db.insert(syncLogs).values({
    functionName: `sync:${cantonUpper}`,
    startTime,
    status: "running",
    cantons: [cantonUpper],
  }).returning({ id: syncLogs.id });

  try {
    console.log(`[sync] Canton ${cantonUpper}: starting parallel company discovery`);

    const prefixResults = await Promise.all(
      "abcdefghijklmnopqrstuvwxyz".split("").map((letter) =>
        fetchCompaniesForPrefix(letter, cantonUpper)
      )
    );

    const seen = new Set<number>();
    const discovered: Array<{ ehraid: number }> = [];
    for (const batch of prefixResults) {
      for (const c of batch) {
        if (!seen.has(c.ehraid)) { seen.add(c.ehraid); discovered.push(c); }
      }
    }
    console.log(`[sync] Canton ${cantonUpper}: discovery complete — ${discovered.length} companies`);

    const limit = createPool(DETAIL_CONCURRENCY);
    let fetched = 0;

    const fetchedCompanies = await Promise.all(
      discovered.map((company) =>
        limit(async () => {
          let full: CompanyFull;
          try {
            full = await zefixGet<CompanyFull>(`/api/v1/company/ehraid/${company.ehraid}`);
          } catch {
            return null;
          }
          const n = ++fetched;
          if (n % 100 === 0) console.log(`[sync] Canton ${cantonUpper}: fetched ${n}/${discovered.length}`);
          return { full };
        })
      )
    );

    const validCompanies = fetchedCompanies.filter(Boolean) as Array<{ full: CompanyFull }>;

    for (let i = 0; i < validCompanies.length; i += UPSERT_BATCH_SIZE) {
      const batch = validCompanies.slice(i, i + UPSERT_BATCH_SIZE);
      await upsertBatch(batch, cantonUpper);
      console.log(`[sync] Canton ${cantonUpper}: upserted ${Math.min(i + UPSERT_BATCH_SIZE, validCompanies.length)}/${validCompanies.length}`);
    }

    const [statsRow] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(companies)
      .where(eq(companies.canton, cantonUpper));

    const totalInDb = Number(statsRow.count);

    await db.insert(cantonStats).values({
      canton: cantonUpper,
      totalCompanies: totalInDb,
      lastSyncedAt: new Date(),
    }).onConflictDoUpdate({
      target: cantonStats.canton,
      set: { totalCompanies: totalInDb, lastSyncedAt: new Date() },
    });

    await db.update(syncLogs)
      .set({ endTime: new Date(), status: "success", totalSynced: validCompanies.length })
      .where(eq(syncLogs.id, logRow.id));

    return NextResponse.json({ canton: cantonUpper, synced: validCompanies.length, totalInDb });
  } catch (error) {
    console.error(`Sync failed for canton ${cantonUpper}:`, error);
    await db.update(syncLogs)
      .set({ endTime: new Date(), status: "failed", error: String(error) })
      .where(eq(syncLogs.id, logRow.id));
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sync failed" }, { status: 500 });
  }
}
