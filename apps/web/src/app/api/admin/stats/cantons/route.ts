import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export async function GET() {
  try {
    const stats: Record<string, { totalCompanies: number; lastSyncedAt: unknown }> = {};
    const snapshot = await adminDb.collection("canton_stats").get();

    snapshot.forEach((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      stats[doc.id] = {
        totalCompanies: data.totalCompanies || 0,
        lastSyncedAt: data.lastSyncedAt?.toDate?.() || data.lastSyncedAt,
      };
    });

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Failed to fetch canton stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
