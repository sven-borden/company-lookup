import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { syncLogs } from "@/lib/db/schema";
import { syncCanton } from "@/lib/sync/sync-canton";

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
    const { synced, totalInDb } = await syncCanton(cantonUpper);

    await db.update(syncLogs)
      .set({ endTime: new Date(), status: "success", totalSynced: synced })
      .where(eq(syncLogs.id, logRow.id));

    return NextResponse.json({ canton: cantonUpper, synced, totalInDb });
  } catch (error) {
    console.error(`Sync failed for canton ${cantonUpper}:`, error);
    await db.update(syncLogs)
      .set({ endTime: new Date(), status: "failed", error: String(error) })
      .where(eq(syncLogs.id, logRow.id));
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sync failed" }, { status: 500 });
  }
}
