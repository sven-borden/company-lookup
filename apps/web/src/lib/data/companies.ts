import { eq, and, or, ilike, asc, desc, count, sql } from "drizzle-orm";
import { db } from "../db";
import {
  companies, companyAddresses, officers, shareholders,
} from "../db/schema";
import type { CompanyShort, CompanyFull } from "@swiss-biz-hunter/types";

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

  const where = canton ? eq(companies.canton, canton) : undefined;

  const orderCol =
    sortBy === "uid" ? companies.uid
    : sortBy === "canton" ? companies.canton
    : sortBy === "status" ? companies.status
    : companies.name;

  const orderFn = sortOrder === "desc" ? desc : asc;

  const [totalResult, rows] = await Promise.all([
    db.select({ count: count() }).from(companies).where(where),
    db.select().from(companies).where(where).orderBy(orderFn(orderCol)).limit(clampedPageSize).offset(offset),
  ]);

  const total = Number(totalResult[0].count);

  return {
    companies: rows.map(rowToCompanyShort),
    total,
    page: clampedPage,
    pageSize: clampedPageSize,
    totalPages: Math.ceil(total / clampedPageSize),
  };
}

export async function searchCompanies(
  name: string,
  filters?: SearchFilters
): Promise<CompanyShort[]> {
  if (!name || name.trim() === "") return [];

  const q = name.trim();
  const escaped = q.replace(/%/g, "\\%").replace(/_/g, "\\_");

  const nameFilter = or(
    ilike(companies.name, `${escaped}%`),
    sql`similarity(${companies.name}, ${q}) > 0.15`,
  );

  const where = and(
    nameFilter,
    filters?.canton ? eq(companies.canton, filters.canton) : undefined,
    filters?.activeOnly ? eq(companies.status, "ACTIVE") : undefined,
  );

  const rows = await db
    .select()
    .from(companies)
    .where(where)
    .orderBy(sql`similarity(${companies.name}, ${q}) DESC`, companies.name)
    .limit(20);

  return rows.map(rowToCompanyShort);
}

export async function getCompanyByUid(uid: string): Promise<CompanyFull | null> {
  if (!uid) return null;

  let normalizedUid = uid;
  const digits = uid.replace(/[^\d]/g, "");
  if (digits.length === 9 && !uid.includes("-")) {
    normalizedUid = `CHE-${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}`;
  }

  const result = await db.query.companies.findFirst({
    where: eq(companies.uid, normalizedUid),
    with: { address: true, officers: true, shareholders: true },
  });

  return result ? rowToCompanyFull(result) : null;
}

type CompanyRow = typeof companies.$inferSelect;
type AddressRow = typeof companyAddresses.$inferSelect;
type OfficerRow = typeof officers.$inferSelect;
type ShareholderRow = typeof shareholders.$inferSelect;

function rowToCompanyShort(row: CompanyRow): CompanyShort {
  return {
    uid: row.uid,
    name: row.name,
    ehraid: row.ehraid ?? 0,
    chid: row.chid ?? "",
    legalSeatId: row.legalSeatId ?? 0,
    legalSeat: row.legalSeat ?? "",
    registryOfCommerceId: row.registryOfCommerceId ?? 0,
    legalForm: {
      id: row.legalFormId ?? 0,
      uid: row.legalFormUid ?? "",
      name: {
        de: row.legalFormNameDe ?? "",
        fr: row.legalFormNameFr ?? "",
        it: row.legalFormNameIt ?? "",
        en: row.legalFormNameEn ?? "",
      },
      shortName: { de: row.legalFormShortDe ?? "" },
    },
    status: row.status as CompanyShort["status"],
    sogcDate: row.sogcDate ?? "",
    deletionDate: row.deletionDate ?? undefined,
  };
}

function rowToCompanyFull(row: CompanyRow & {
  address: AddressRow | null;
  officers: OfficerRow[];
  shareholders: ShareholderRow[];
}): CompanyFull {
  const base = rowToCompanyShort(row);

  const officerList = row.officers.map((o) => ({
    name: o.name,
    role: o.role ?? "",
    signatureType: o.signatureType ?? undefined,
  }));

  const shareholderList = row.shareholders.map((s) => ({
    name: s.name,
    shares: s.shares ?? undefined,
  }));

  const enrichmentSource = row.officers[0]?.source ?? row.shareholders[0]?.source;
  const enrichmentAt = (row.officers[0]?.enrichedAt ?? row.shareholders[0]?.enrichedAt)?.toISOString();

  return {
    ...base,
    canton: row.canton,
    translation: (row.translations as string[] | null) ?? [],
    purpose: row.purpose ?? "",
    capitalNominal: row.capitalNominal ?? "",
    capitalCurrency: row.capitalCurrency ?? "",
    cantonalExcerptWeb: row.cantonalExcerptWeb ?? "",
    zefixDetailWeb: (row.zefixDetailWeb as CompanyFull["zefixDetailWeb"]) ?? {},
    sogcPub: (row.sogcPub as CompanyFull["sogcPub"]) ?? [],
    oldNames: (row.oldNames as CompanyFull["oldNames"]) ?? [],
    headOffices: (row.headOffices as CompanyFull["headOffices"]) ?? [],
    furtherHeadOffices: (row.furtherHeadOffices as CompanyFull["furtherHeadOffices"]) ?? [],
    branchOffices: (row.branchOffices as CompanyFull["branchOffices"]) ?? [],
    hasTakenOver: (row.hasTakenOver as CompanyFull["hasTakenOver"]) ?? [],
    wasTakenOverBy: (row.wasTakenOverBy as CompanyFull["wasTakenOverBy"]) ?? [],
    auditCompanies: (row.auditCompanies as CompanyFull["auditCompanies"]) ?? [],
    address: row.address
      ? {
          organisation: row.address.organisation ?? "",
          careOf: row.address.careOf ?? "",
          street: row.address.street ?? "",
          houseNumber: row.address.houseNumber ?? "",
          addon: row.address.addon ?? "",
          poBox: row.address.poBox ?? "",
          city: row.address.city ?? "",
          swissZipCode: row.address.swissZipCode ?? "",
        }
      : { organisation: "", careOf: "", street: "", houseNumber: "", addon: "", poBox: "", city: "", swissZipCode: "" },
    ...(officerList.length > 0 || shareholderList.length > 0
      ? {
          cantonalEnrichment: {
            officers: officerList,
            shareholders: shareholderList,
            source: enrichmentSource ?? "",
            enrichedAt: enrichmentAt ?? new Date().toISOString(),
          },
        }
      : {}),
  };
}
