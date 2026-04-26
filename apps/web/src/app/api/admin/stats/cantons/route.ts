import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cantonStats } from "@/lib/db/schema";

export async function GET() {
  try {
    const rows = await db.select().from(cantonStats);
    const stats: Record<string, { totalCompanies: number; lastSyncedAt: Date | null }> = {};
    for (const row of rows) {
      stats[row.canton] = {
        totalCompanies: row.totalCompanies ?? 0,
        lastSyncedAt: row.lastSyncedAt ?? null,
      };
    }
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Failed to fetch canton stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
