import { adminDb } from "../firebase/admin";

const COLLECTION = "recent_searches";
const MAX_RECENT = 5;

export interface RecentSearch {
  term: string;
  searchedAt: Date;
}

export async function saveSearch(term: string): Promise<void> {
  const normalized = term.trim();
  if (!normalized) return;

  // Use term as doc ID (lowercased) so duplicates overwrite
  const docId = normalized.toLowerCase().replace(/\s+/g, "_");
  await adminDb.collection(COLLECTION).doc(docId).set({
    term: normalized,
    searchedAt: new Date(),
  });
}

export async function getRecentSearches(): Promise<RecentSearch[]> {
  const snapshot = await adminDb
    .collection(COLLECTION)
    .orderBy("searchedAt", "desc")
    .limit(MAX_RECENT)
    .get();

  return snapshot.docs.map((doc) => ({
    term: doc.data().term as string,
    searchedAt: (doc.data().searchedAt as FirebaseFirestore.Timestamp).toDate(),
  }));
}
