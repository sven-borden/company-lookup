import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { CANTON_SCHEDULE, type CompanyFull } from "@company-lookup/types";

const BATCH_SIZE = 500;

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

async function syncCompaniesForCanton(canton: string): Promise<number> {
  console.log(`[sync] Canton ${canton}: starting company discovery`);
  const seen = new Set<number>();
  const companies: Array<{ ehraid: number }> = [];
  for (const letter of "abcdefghijklmnopqrstuvwxyz") {
    const before = companies.length;
    const batch = await fetchCompaniesForPrefix(letter, canton.toUpperCase());
    for (const c of batch) {
      if (!seen.has(c.ehraid)) { seen.add(c.ehraid); companies.push(c); }
    }
    console.log(`[sync] Canton ${canton}: letter "${letter}" done — +${companies.length - before} new (${companies.length} total)`);
  }
  console.log(`[sync] Canton ${canton}: discovery complete — ${companies.length} unique companies`);

  let synced = 0;
  let batch = adminDb.batch();
  let batchCount = 0;

  for (const company of companies) {
    let full: CompanyFull;
    try {
      full = await zefixGet<CompanyFull>(`/api/v1/company/ehraid/${company.ehraid}`);
    } catch {
      continue;
    }

    const docRef = adminDb.collection("companies").doc(full.uid);
    batch.set(docRef, {
      ...full,
      nameLower: (full.name as string).toLowerCase(),
      syncedAt: new Date(),
    });

    batchCount++;
    synced++;

    if (synced % 100 === 0) {
      console.log(`[sync] Canton ${canton}: fetched details for ${synced}/${companies.length} companies`);
    }

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      batch = adminDb.batch();
      batchCount = 0;
      console.log(`[sync] Canton ${canton}: committed batch — ${synced}/${companies.length} written`);
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  return synced;
}

export async function POST(_req: NextRequest) {
  const startTime = new Date();
  const dayOfWeek = startTime.getDay();
  const cantonsToSync = CANTON_SCHEDULE[dayOfWeek] || [];

  const logRef = adminDb.collection("cron_logs").doc();
  await logRef.set({
    functionName: "manualSync",
    startTime,
    status: "running",
    cantons: cantonsToSync,
  });

  try {
    let totalSynced = 0;
    const results: Record<string, number> = {};

    for (const canton of cantonsToSync) {
      try {
        const count = await syncCompaniesForCanton(canton);
        totalSynced += count;
        results[canton] = count;
      } catch (err) {
        console.error(`Failed to sync canton ${canton}:`, err);
        results[canton] = -1;
      }
    }

    await logRef.update({
      endTime: new Date(),
      status: "success",
      totalSynced,
      results,
    });

    return NextResponse.json({ status: "success", totalSynced, results });
  } catch (error) {
    console.error("Manual sync failed:", error);
    await logRef.update({
      endTime: new Date(),
      status: "failed",
      error: String(error),
    });
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
