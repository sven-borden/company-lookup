import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cantonStats } from "@/lib/db/schema";
import { CANTON } from "@swiss-biz-hunter/types";

export async function GET() {
  try {
    const [row] = await db.select().from(cantonStats).where(eq(cantonStats.canton, CANTON));

    return NextResponse.json({
      totalCompanies: row?.totalCompanies ?? 0,
      lastSyncedAt: row?.lastSyncedAt ?? null,
    });
  } catch (error) {
    console.error("Failed to fetch stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
