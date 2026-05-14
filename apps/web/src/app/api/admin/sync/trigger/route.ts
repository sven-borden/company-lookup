import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, companyAddresses, cantonStats, syncLogs } from "@/lib/db/schema";
import { CANTON_SCHEDULE, type CompanyFull } from "@swiss-biz-hunter/types";

const UPSERT_BATCH_SIZE = 100;
const MAX_SOGC_PUB = 100;

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
  if (!res.ok) throw new Error(`Zefix POST ${path} failed: ${res.status}`);
  return res.json();
}

async function zefixGet<T>(path: string): Promise<T> {
  const baseUrl = (process.env.ZEFIX_API_BASE_URL ?? "https://www.zefix.admin.ch/ZefixPublicREST").replace(/\/$/, "");
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: makeAuthHeader() },
  });
  if (!res.ok) throw new Error(`Zefix GET ${path} failed: ${res.status}`);
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

async function syncCanton(canton: string): Promise<number> {
  console.log(`[sync] Canton ${canton}: starting discovery`);
  const seen = new Set<number>();
  const discovered: Array<{ ehraid: number }> = [];

  for (const letter of "abcdefghijklmnopqrstuvwxyz") {
    const batch = await fetchCompaniesForPrefix(letter, canton.toUpperCase());
    for (const c of batch) {
      if (!seen.has(c.ehraid)) { seen.add(c.ehraid); discovered.push(c); }
    }
  }
  console.log(`[sync] Canton ${canton}: ${discovered.length} companies`);

  const rows: ReturnType<typeof companyToRow>[] = [];
  const addressRows: Array<typeof companyAddresses.$inferInsert> = [];
  let synced = 0;

  for (const company of discovered) {
    let full: CompanyFull;
    try {
      full = await zefixGet<CompanyFull>(`/api/v1/company/ehraid/${company.ehraid}`);
    } catch {
      continue;
    }

    rows.push(companyToRow(full, canton));

    if (full.address) {
      addressRows.push({
        companyUid: full.uid,
        organisation: full.address.organisation ?? null,
        careOf: full.address.careOf ?? null,
        street: full.address.street ?? null,
        houseNumber: full.address.houseNumber ?? null,
        addon: full.address.addon ?? null,
        poBox: full.address.poBox ?? null,
        city: full.address.city ?? null,
        swissZipCode: full.address.swissZipCode ?? null,
      });
    }

    synced++;

    if (rows.length >= UPSERT_BATCH_SIZE) {
      await db.insert(companies).values(rows).onConflictDoUpdate({
        target: companies.uid,
        set: { name: sql`excluded.name`, status: sql`excluded.status`, syncedAt: sql`NOW()` },
      });
      if (addressRows.length > 0) {
        await db.insert(companyAddresses).values(addressRows).onConflictDoUpdate({
          target: companyAddresses.companyUid,
          set: { city: sql`excluded.city`, street: sql`excluded.street` },
        });
      }
      rows.length = 0;
      addressRows.length = 0;
      console.log(`[sync] Canton ${canton}: committed ${synced}/${discovered.length}`);
    }
  }

  if (rows.length > 0) {
    await db.insert(companies).values(rows).onConflictDoUpdate({
      target: companies.uid,
      set: { name: sql`excluded.name`, status: sql`excluded.status`, syncedAt: sql`NOW()` },
    });
    if (addressRows.length > 0) {
      await db.insert(companyAddresses).values(addressRows).onConflictDoUpdate({
        target: companyAddresses.companyUid,
        set: { city: sql`excluded.city`, street: sql`excluded.street` },
      });
    }
  }

  const [statsRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(companies)
    .where(eq(companies.canton, canton.toUpperCase()));

  await db.insert(cantonStats).values({
    canton: canton.toUpperCase(),
    totalCompanies: Number(statsRow.count),
    lastSyncedAt: new Date(),
  }).onConflictDoUpdate({
    target: cantonStats.canton,
    set: { totalCompanies: Number(statsRow.count), lastSyncedAt: new Date() },
  });

  return synced;
}

export async function POST() {
  const startTime = new Date();
  const dayOfWeek = startTime.getDay();
  const cantonsToSync = CANTON_SCHEDULE[dayOfWeek] || [];

  const [logRow] = await db.insert(syncLogs).values({
    functionName: "trigger-sync",
    startTime,
    status: "running",
    cantons: cantonsToSync,
  }).returning({ id: syncLogs.id });

  try {
    let totalSynced = 0;
    const results: Record<string, number> = {};

    for (const canton of cantonsToSync) {
      try {
        const count = await syncCanton(canton);
        totalSynced += count;
        results[canton] = count;
      } catch (err) {
        console.error(`Failed to sync canton ${canton}:`, err);
        results[canton] = -1;
      }
    }

    await db.update(syncLogs)
      .set({ endTime: new Date(), status: "success", totalSynced, results })
      .where(eq(syncLogs.id, logRow.id));

    return NextResponse.json({ status: "success", totalSynced, results });
  } catch (error) {
    console.error("Trigger sync failed:", error);
    await db.update(syncLogs)
      .set({ endTime: new Date(), status: "failed", error: String(error) })
      .where(eq(syncLogs.id, logRow.id));
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
