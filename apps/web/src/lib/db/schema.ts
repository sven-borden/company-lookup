import {
  pgTable, text, integer, numeric, timestamp, jsonb, serial, index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import {
  SogcPublication, CompanyOldName, CompanyShort, DFIEString,
} from "@swiss-biz-hunter/types";

export const companies = pgTable("companies", {
  uid: text("uid").primaryKey(),
  ehraid: integer("ehraid").unique(),
  chid: text("chid"),
  name: text("name").notNull(),
  status: text("status").notNull(),
  canton: text("canton").notNull(),
  legalSeat: text("legal_seat"),
  legalSeatId: integer("legal_seat_id"),
  legalFormId: integer("legal_form_id"),
  legalFormUid: text("legal_form_uid"),
  legalFormNameDe: text("legal_form_name_de"),
  legalFormNameFr: text("legal_form_name_fr"),
  legalFormNameIt: text("legal_form_name_it"),
  legalFormNameEn: text("legal_form_name_en"),
  legalFormShortDe: text("legal_form_short_de"),
  purpose: text("purpose"),
  capitalNominal: numeric("capital_nominal"),
  capitalCurrency: text("capital_currency"),
  sogcDate: text("sogc_date"),
  deletionDate: text("deletion_date"),
  registryOfCommerceId: integer("registry_of_commerce_id"),
  cantonalExcerptWeb: text("cantonal_excerpt_web"),
  zefixDetailWeb: jsonb("zefix_detail_web").$type<DFIEString>(),
  sogcPub: jsonb("sogc_pub").$type<SogcPublication[]>(),
  oldNames: jsonb("old_names").$type<CompanyOldName[]>(),
  translations: jsonb("translations").$type<string[]>(),
  headOffices: jsonb("head_offices").$type<CompanyShort[]>(),
  furtherHeadOffices: jsonb("further_head_offices").$type<CompanyShort[]>(),
  branchOffices: jsonb("branch_offices").$type<CompanyShort[]>(),
  hasTakenOver: jsonb("has_taken_over").$type<CompanyShort[]>(),
  wasTakenOverBy: jsonb("was_taken_over_by").$type<CompanyShort[]>(),
  auditCompanies: jsonb("audit_companies").$type<CompanyShort[]>(),
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("idx_companies_canton").on(t.canton),
  index("idx_companies_status").on(t.status),
]);

export const companyAddresses = pgTable("company_addresses", {
  companyUid: text("company_uid").primaryKey(),
  organisation: text("organisation"),
  careOf: text("care_of"),
  street: text("street"),
  houseNumber: text("house_number"),
  addon: text("addon"),
  poBox: text("po_box"),
  city: text("city"),
  swissZipCode: text("swiss_zip_code"),
});

export const officers = pgTable("officers", {
  id: serial("id").primaryKey(),
  companyUid: text("company_uid").notNull(),
  name: text("name").notNull(),
  role: text("role"),
  signatureType: text("signature_type"),
  source: text("source"),
  enrichedAt: timestamp("enriched_at", { withTimezone: true }),
}, (t) => [
  index("idx_officers_company_uid").on(t.companyUid),
]);

export const shareholders = pgTable("shareholders", {
  id: serial("id").primaryKey(),
  companyUid: text("company_uid").notNull(),
  name: text("name").notNull(),
  shares: text("shares"),
  source: text("source"),
  enrichedAt: timestamp("enriched_at", { withTimezone: true }),
}, (t) => [
  index("idx_shareholders_company_uid").on(t.companyUid),
]);

export const cantonStats = pgTable("canton_stats", {
  canton: text("canton").primaryKey(),
  totalCompanies: integer("total_companies"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
});

export const syncLogs = pgTable("sync_logs", {
  id: serial("id").primaryKey(),
  functionName: text("function_name"),
  startTime: timestamp("start_time", { withTimezone: true }),
  endTime: timestamp("end_time", { withTimezone: true }),
  status: text("status"),
  cantons: jsonb("cantons"),
  totalSynced: integer("total_synced"),
  results: jsonb("results"),
  error: text("error"),
});

export const recentSearches = pgTable("recent_searches", {
  term: text("term").primaryKey(),
  searchedAt: timestamp("searched_at", { withTimezone: true }).defaultNow(),
});

export const companiesRelations = relations(companies, ({ one, many }) => ({
  address: one(companyAddresses, {
    fields: [companies.uid],
    references: [companyAddresses.companyUid],
  }),
  officers: many(officers),
  shareholders: many(shareholders),
}));

export const companyAddressesRelations = relations(companyAddresses, ({ one }) => ({
  company: one(companies, {
    fields: [companyAddresses.companyUid],
    references: [companies.uid],
  }),
}));

export const officersRelations = relations(officers, ({ one }) => ({
  company: one(companies, {
    fields: [officers.companyUid],
    references: [companies.uid],
  }),
}));

export const shareholdersRelations = relations(shareholders, ({ one }) => ({
  company: one(companies, {
    fields: [shareholders.companyUid],
    references: [companies.uid],
  }),
}));
