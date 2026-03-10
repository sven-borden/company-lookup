import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

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

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ canton: string }> }
) {
  const { canton } = await params;
  const cantonUpper = canton.toUpperCase();
  const startTime = new Date();

  const logRef = adminDb.collection("cron_logs").doc();
  await logRef.set({
    functionName: `manualSync:${cantonUpper}`,
    startTime,
    status: "running",
    cantons: [cantonUpper],
  });

  try {
    const seen = new Set<number>();
    const companies: Array<{ ehraid: number }> = [];
    for (const letter of "abcdefghijklmnopqrstuvwxyz") {
      const batch = await fetchCompaniesForPrefix(letter, cantonUpper);
      for (const c of batch) {
        if (!seen.has(c.ehraid)) {
          seen.add(c.ehraid);
          companies.push(c);
        }
      }
    }

    let synced = 0;
    let batch = adminDb.batch();
    let batchCount = 0;

    for (const company of companies) {
      let full: any;
      try {
        full = await zefixGet(`/api/v1/company/ehraid/${company.ehraid}`);
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

      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = adminDb.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    // Update canton stats in metadata collection
    const countSnapshot = await adminDb
      .collection("companies")
      .where("canton", "==", cantonUpper)
      .count()
      .get();
    const totalCount = countSnapshot.data().count;

    await adminDb.collection("canton_stats").doc(cantonUpper).set({
      totalCompanies: totalCount,
      lastSyncedAt: new Date(),
    }, { merge: true });

    await logRef.update({
      endTime: new Date(),
      status: "success",
      totalSynced: synced,
    });

    return NextResponse.json({ canton: cantonUpper, synced, totalInDb: totalCount });
  } catch (error) {
    console.error(`Manual sync failed for canton ${cantonUpper}:`, error);
    await logRef.update({
      endTime: new Date(),
      status: "failed",
      error: String(error),
    });
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
