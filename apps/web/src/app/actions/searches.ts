"use server";

import { saveSearch } from "@/lib/data/searches";

export async function saveSearchAction(term: string): Promise<void> {
  await saveSearch(term);
}
