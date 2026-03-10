import { adminDb } from "../firebase/admin";
import { CompanyShort, CompanyFull } from "@company-lookup/types";

export interface SearchFilters {
  canton?: string;
  legalFormId?: number;
  activeOnly?: boolean;
}

/**
 * Searches companies in Firestore.
 * Note: Firestore doesn't support full-text search out-of-the-box.
 * For now, we use a simple prefix search on the 'name' field.
 */
export async function searchCompanies(
  name: string,
  filters?: SearchFilters
): Promise<CompanyShort[]> {
  // If no name is provided, return empty list or handle accordingly
  if (!name || name.trim() === "") return [];

  const normalizedName = name.trim();
  
  // Basic prefix search: name >= query and name <= query + \uf8ff
  let query: any = adminDb
    .collection("companies")
    .where("name", ">=", normalizedName)
    .where("name", "<=", normalizedName + "\uf8ff")
    .limit(20);

  if (filters?.canton) {
    query = query.where("canton", "==", filters.canton);
  }
  if (filters?.activeOnly) {
    query = query.where("status", "==", "ACTIVE");
  }

  const snapshot = await query.get();
  
  return snapshot.docs.map((doc: any) => ({
    ...doc.data(),
    // Ensure UID is present if it's the doc ID
    uid: doc.id,
  })) as CompanyShort[];
}

/**
 * Fetches a single company by its UID.
 */
export async function getCompanyByUid(
  uid: string
): Promise<CompanyFull | null> {
  if (!uid) return null;

  const doc = await adminDb.collection("companies").doc(uid).get();
  
  if (!doc.exists) return null;
  
  return {
    ...doc.data(),
    uid: doc.id,
  } as CompanyFull;
}
