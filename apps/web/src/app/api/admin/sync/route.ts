import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { syncLogs } from "@/lib/db/schema";
import { CANTON } from "@swiss-biz-hunter/types";
import { syncVaud } from "@/lib/sync/sync-vaud";

// Survives across requests on a persistent (`next start`) Node server so a
// second trigger can't kick off an overlapping run.
const globalForSync = globalThis as unknown as { _syncRunning?: boolean };

async function runSync(logId: number) {
  try {
    const { synced } = await syncVaud();

    await db.update(syncLogs)
      .set({ endTime: new Date(), status: "success", totalSynced: synced })
      .where(eq(syncLogs.id, logId));
    console.log(`[sync] Run complete — ${synced} synced`);
  } catch (error) {
    console.error("Sync run failed:", error);
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

  const [logRow] = await db.insert(syncLogs).values({
    functionName: "sync-vaud",
    startTime: new Date(),
    status: "running",
    cantons: [CANTON],
  }).returning({ id: syncLogs.id });

  // Run detached: the cron's curl returns immediately so it can't be killed by
  // Coolify's SSH command timeout. Progress/result lives in the syncLogs table.
  globalForSync._syncRunning = true;
  void runSync(logRow.id);

  return NextResponse.json({ status: "started", logId: logRow.id }, { status: 202 });
}
