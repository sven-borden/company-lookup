import { adminDb } from "../firebase/admin";
import type { CompanyShort, CompanyFull } from "@company-lookup/types";

interface SearchFilters {
  canton?: string;
  legalFormId?: number;
  activeOnly?: boolean;
}

export async function searchCompanies(
  name: string,
  filters?: SearchFilters
): Promise<CompanyShort[]> {
  let query = adminDb
    .collection("companies")
    .where("name", ">=", name)
    .where("name", "<=", name + "\uf8ff")
    .limit(50);

  if (filters?.canton) {
    query = query.where("canton", "==", filters.canton);
  }
  if (filters?.activeOnly) {
    query = query.where("status", "==", "ACTIVE");
  }

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => doc.data() as CompanyShort);
}

export async function getCompanyByUid(
  uid: string
): Promise<CompanyFull | null> {
  const doc = await adminDb.collection("companies").doc(uid).get();
  if (!doc.exists) return null;
  return doc.data() as CompanyFull;
}
