import { CantonalEnrichment } from "./enriched";

// Zefix PublicREST API types
// Based on https://www.zefix.admin.ch/ZefixPublicREST/v3/api-docs

// The only canton this platform covers. Zefix still returns a `canton` field on
// every company, so the data model keeps it — but nothing branches on its value.
export const CANTON = "VD" as const;

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
