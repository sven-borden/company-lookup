import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { syncLogs } from "@/lib/db/schema";

export async function GET() {
  try {
    const logs = await db
      .select()
      .from(syncLogs)
      .orderBy(desc(syncLogs.startTime))
      .limit(20);
    return NextResponse.json(logs);
  } catch (error) {
    console.error("Failed to fetch sync logs:", error);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
