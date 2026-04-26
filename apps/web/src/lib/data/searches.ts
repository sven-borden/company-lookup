import { desc } from "drizzle-orm";
import { db } from "../db";
import { recentSearches } from "../db/schema";

export interface RecentSearch {
  term: string;
  searchedAt: Date;
}

export async function saveSearch(term: string): Promise<void> {
  const normalized = term.trim();
  if (!normalized) return;
  await db.insert(recentSearches)
    .values({ term: normalized, searchedAt: new Date() })
    .onConflictDoUpdate({ target: recentSearches.term, set: { searchedAt: new Date() } });
}

export async function getRecentSearches(): Promise<RecentSearch[]> {
  const rows = await db
    .select()
    .from(recentSearches)
    .orderBy(desc(recentSearches.searchedAt))
    .limit(5);
  return rows.map((r) => ({ term: r.term, searchedAt: r.searchedAt ?? new Date() }));
}
