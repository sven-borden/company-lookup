import { CantonalEnrichment } from "./enriched";

// Zefix PublicREST API types
// Based on https://www.zefix.admin.ch/ZefixPublicREST/v3/api-docs

export const CANTONS = [
  "AG", "AI", "AR", "BE", "BL", "BS", "FR", "GE", "GL", "GR",
  "JU", "LU", "NE", "NW", "OW", "SG", "SH", "SO", "SZ", "TG",
  "TI", "UR", "VD", "VS", "ZG", "ZH",
];

// Schedule mapping (0 = Sunday, 1 = Monday, ..., 6 = Saturday).
// Balanced via greedy LPT (longest-processing-time) over per-canton company
// counts so each day carries ~equal load (~100k). ZH is the single largest
// canton (~115k) and a canton syncs atomically, so it owns a day alone.
// Re-tune from real cantonStats.totalCompanies after a full clean sync.
export const CANTON_SCHEDULE: Record<number, string[]> = {
  0: ["ZH"],
  1: ["BE", "SZ", "JU", "AR", "GL"],
  2: ["VD", "TG", "GR", "AI"],
  3: ["GE", "FR", "BL", "SH"],
  4: ["AG", "LU", "NE", "NW"],
  5: ["SG", "VS", "SO", "OW"],
  6: ["ZG", "TI", "BS", "UR"],
};

export enum CompanyStatus {
  ACTIVE = "ACTIVE",
  CANCELLED = "CANCELLED",
  BEING_CANCELLED = "BEING_CANCELLED",
}

export interface DFIEString {
  de?: string;
  fr?: string;
  it?: string;
  en?: string;
}

export interface LegalForm {
  id: number;
  uid: string;
  name: DFIEString;
  shortName: DFIEString;
}

export interface Address {
  organisation: string;
  careOf: string;
  street: string;
  houseNumber: string;
  addon: string;
  poBox: string;
  city: string;
  swissZipCode: string;
}

export interface BfsCommunity {
  bfsId: number;
  canton: string;
  name: string;
  registryOfCommerceId: number;
}

export interface RegistryOfCommerce {
  registryOfCommerceId: number;
  canton: string;
  address1: string;
  address2: string;
  address3: string;
  address4: string;
  homepage: string;
  url2: string;
  url3: string;
  url4: string;
  url5: string;
}

export interface CompanySearchQuery {
  name: string;
  legalFormId?: number;
  legalFormUid?: string;
  registryOfCommerceId?: number;
  legalSeatId?: number;
  canton?: string;
  activeOnly?: boolean;
}

export interface CompanyShort {
  name: string;
  ehraid: number;
  uid: string;
  chid: string;
  legalSeatId: number;
  legalSeat: string;
  registryOfCommerceId: number;
  legalForm: LegalForm;
  status: CompanyStatus;
  sogcDate: string;
  deletionDate?: string;
}

export interface CompanyOldName {
  name: string;
  sequenceNr: number;
  translation: string[];
}

export interface MutationType {
  id: number;
  key: string;
}

export interface SogcPublication {
  sogcDate: string;
  sogcId: number;
  registryOfCommerceId: number;
  registryOfCommerceCanton: string;
  registryOfCommerceJournalId: number;
  registryOfCommerceJournalDate: string;
  message: string;
  mutationTypes: MutationType[];
}

export interface CompanyFull extends CompanyShort {
  translation: string[];
  purpose: string;
  sogcPub: SogcPublication[];
  address: Address;
  canton: string;
  capitalNominal: string;
  capitalCurrency: string;
  headOffices: CompanyShort[];
  furtherHeadOffices: CompanyShort[];
  branchOffices: CompanyShort[];
  hasTakenOver: CompanyShort[];
  wasTakenOverBy: CompanyShort[];
  auditCompanies: CompanyShort[];
  oldNames: CompanyOldName[];
  cantonalExcerptWeb: string;
  zefixDetailWeb: DFIEString;
  cantonalEnrichment?: CantonalEnrichment;
}

export interface SogcPublicationAndCompanyShort {
  sogcPublication: SogcPublication;
  companyShort: CompanyShort;
}

export enum ErrorType {
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  INVALID_QUERY_WORDS = "INVALID_QUERY_WORDS",
  INVALID_REQUEST_DATA = "INVALID_REQUEST_DATA",
  RESULTLIST_TO_LARGE = "RESULTLIST_TO_LARGE",
  NOT_FOUND = "NOT_FOUND",
}

export interface ErrorDetails {
  type: ErrorType;
  message: string;
}

export interface RestApiErrorResponse {
  error: ErrorDetails;
}
