import { adminDb } from "../firebase/admin";
import { CompanyShort, CompanyFull } from "@company-lookup/types";

export interface BrowseFilters {
  canton?: string;
  sortBy?: "name" | "uid" | "canton" | "status";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface BrowseResult {
  companies: CompanyShort[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SearchFilters {
  canton?: string;
  legalFormId?: number;
  activeOnly?: boolean;
}

/**
 * Paginates and filters companies from Firestore for the Browse page.
 */
export async function browseCompanies(filters: BrowseFilters = {}): Promise<BrowseResult> {
  const {
    canton,
    sortBy = "name",
    sortOrder = "asc",
    page = 1,
    pageSize = 20,
  } = filters;

  const clampedPageSize = Math.min(Math.max(1, pageSize), 100);
  const clampedPage = Math.max(1, page);
  const offset = (clampedPage - 1) * clampedPageSize;

  // Map "name" → "nameLower" for case-insensitive sort; others are direct field names
  const sortField = sortBy === "name" ? "nameLower" : sortBy;

  let baseQuery: FirebaseFirestore.Query = adminDb.collection("companies");
  if (canton) {
    baseQuery = baseQuery.where("canton", "==", canton);
  }

  const [countSnapshot, dataSnapshot] = await Promise.all([
    baseQuery.count().get(),
    baseQuery.orderBy(sortField, sortOrder).offset(offset).limit(clampedPageSize).get(),
  ]);

  const total = countSnapshot.data().count;
  const companies = dataSnapshot.docs.map((doc: any) => ({
    ...doc.data(),
    uid: doc.id,
  })) as CompanyShort[];

  return {
    companies,
    total,
    page: clampedPage,
    pageSize: clampedPageSize,
    totalPages: Math.ceil(total / clampedPageSize),
  };
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

  const normalizedName = name.trim().toLowerCase();

  // Case-insensitive prefix search using the stored nameLower field
  let query: any = adminDb
    .collection("companies")
    .where("nameLower", ">=", normalizedName)
    .where("nameLower", "<=", normalizedName + "\uf8ff")
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
