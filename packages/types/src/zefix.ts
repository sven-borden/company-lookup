// Zefix PublicREST API types
// Based on https://www.zefix.admin.ch/ZefixPublicREST/v3/api-docs

export const CANTONS = [
  "AG", "AI", "AR", "BE", "BL", "BS", "FR", "GE", "GL", "GR",
  "JU", "LU", "NE", "NW", "OW", "SG", "SH", "SO", "SZ", "TG",
  "TI", "UR", "VD", "VS", "ZG", "ZH",
];

// Schedule mapping (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
// Balanced roughly by number of companies/economic activity
export const CANTON_SCHEDULE: Record<number, string[]> = {
  0: ["TG", "SO", "GR", "NE", "SH", "AR", "JU", "GL", "NW", "OW", "UR", "AI"],
  1: ["ZH"],
  2: ["BE", "SZ"],
  3: ["VD", "TI"],
  4: ["GE", "SG"],
  5: ["AG", "LU", "BS"],
  6: ["ZG", "VS", "BL", "FR"],
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
