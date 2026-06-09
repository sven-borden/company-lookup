import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { syncLogs } from "@/lib/db/schema";
import { CANTON_SCHEDULE } from "@swiss-biz-hunter/types";
import { syncCanton } from "@/lib/sync/sync-canton";

// Survives across requests on a persistent (`next start`) Node server so a
// second trigger can't kick off an overlapping run.
const globalForSync = globalThis as unknown as { _syncRunning?: boolean };

async function runScheduledSync(cantonsToSync: string[], logId: number) {
  try {
    let totalSynced = 0;
    const results: Record<string, number> = {};

    for (const canton of cantonsToSync) {
      try {
        const { synced } = await syncCanton(canton);
        totalSynced += synced;
        results[canton] = synced;
      } catch (err) {
        console.error(`Failed to sync canton ${canton}:`, err);
        results[canton] = -1;
      }
    }

    await db.update(syncLogs)
      .set({ endTime: new Date(), status: "success", totalSynced, results })
      .where(eq(syncLogs.id, logId));
    console.log(`[sync] Scheduled run complete — ${totalSynced} synced`, results);
  } catch (error) {
    console.error("Scheduled sync run failed:", error);
    await db.update(syncLogs)
      .set({ endTime: new Date(), status: "failed", error: String(error) })
      .where(eq(syncLogs.id, logId));
  } finally {
    globalForSync._syncRunning = false;
  }
}

export async function POST() {
  if (globalForSync._syncRunning) {
    return NextResponse.json({ status: "already-running" }, { status: 409 });
  }

  const startTime = new Date();
  const dayOfWeek = startTime.getDay();
  const cantonsToSync = CANTON_SCHEDULE[dayOfWeek] || [];

  if (cantonsToSync.length === 0) {
    return NextResponse.json({ status: "no-cantons-scheduled", dayOfWeek });
  }

  const [logRow] = await db.insert(syncLogs).values({
    functionName: "trigger-sync",
    startTime,
    status: "running",
    cantons: cantonsToSync,
  }).returning({ id: syncLogs.id });

  // Run detached: the cron's curl returns immediately so it can't be killed by
  // Coolify's SSH command timeout. Progress/result lives in the syncLogs table.
  globalForSync._syncRunning = true;
  void runScheduledSync(cantonsToSync, logRow.id);

  return NextResponse.json(
    { status: "started", logId: logRow.id, cantons: cantonsToSync },
    { status: 202 }
  );
}
