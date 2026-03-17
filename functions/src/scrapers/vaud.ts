/**
 * Vaud cantonal register client.
 *
 * Calls the JSON API behind https://prestations.vd.ch/pub/101266/
 * to retrieve current officers (adms) and shareholders (associés for SARL).
 *
 * Auth flow:
 *   1. GET /api/public/catalog/configuration  → receives XSRF-TOKEN cookie
 *   2. POST requests carry that cookie + X-XSRF-TOKEN header
 */

import { logger } from "firebase-functions/v2";
import { CompanyFull, CantonalEnrichment, Officer, Shareholder } from "@swiss-biz-hunter/types";

const BASE_URL = "https://prestations.vd.ch/pub/101266/api/public";
const REFERER = "https://prestations.vd.ch/pub/101266/";

/** Raw entry from the /hrcexcerpts/ adms array */
interface VaudAdm {
  codeEtat: "A" | "R";
  pers: string;
  fonction?: string;
  sign?: string;
  fcdAss?: string;  // share description for associés (SARL shareholders)
  noReference: number;
}

/** Minimal shape of the /hrcexcerpts/ response we care about */
interface VaudExtract {
  adms: VaudAdm[];
}

/** Minimal shape of a /companies/quick-search result line */
interface VaudSearchResult {
  hrcentId: string;
  uid: string;
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]+>/g, "").trim();
}

export class VaudClient {
  private xsrfToken: string | null = null;
  private sessionCookie: string | null = null;

  /** Initialise (or refresh) the XSRF session. */
  async init(): Promise<void> {
    const res = await fetch(`${BASE_URL}/catalog/configuration`, {
      headers: { Accept: "application/json", Referer: REFERER },
    });

    if (!res.ok) {
      throw new Error(`VaudClient init failed: ${res.status}`);
    }

    // Extract XSRF-TOKEN from Set-Cookie
    const setCookie = res.headers.get("set-cookie") ?? "";
    const match = setCookie.match(/XSRF-TOKEN=([^;]+)/);
    if (!match) throw new Error("VaudClient: no XSRF-TOKEN in Set-Cookie");
    this.xsrfToken = match[1];

    // Build the session cookie string to send back
    // Collect all cookies (XSRF-TOKEN + session token)
    this.sessionCookie = setCookie
      .split(/,(?=[^ ])/)                 // split multiple Set-Cookie headers
      .map((c) => c.split(";")[0].trim()) // keep only name=value pairs
      .join("; ");
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    if (!this.xsrfToken) await this.init();

    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Referer: REFERER,
        Cookie: this.sessionCookie ?? "",
        "X-XSRF-TOKEN": this.xsrfToken ?? "",
      },
      body: JSON.stringify(body),
    });

    // Re-auth once on 403
    if (res.status === 403) {
      logger.warn("VaudClient: 403 received, refreshing session");
      this.xsrfToken = null;
      await this.init();
      return this.post<T>(path, body);
    }

    if (!res.ok) {
      throw new Error(`VaudClient POST ${path} failed: ${res.status}`);
    }

    return res.json() as Promise<T>;
  }

  /**
   * Look up the internal hrcentId by searching company name and matching the UID.
   * The quick-search endpoint only accepts company names, not UIDs directly.
   */
  private async getHrcentId(name: string, uid: string): Promise<string | null> {
    const results = await this.post<VaudSearchResult[]>("/companies/quick-search", {
      criteria: name,
      lang: "FR",
      maxResultNumber: 10,
    });
    // Match by UID to avoid false positives from similar company names
    const match = results.find((r) => r.uid === uid);
    return match?.hrcentId ?? null;
  }

  /** Fetch the full extract JSON for a company. */
  private async getExtract(hrcentId: string, uid: string): Promise<VaudExtract | null> {
    try {
      return await this.post<VaudExtract>("/hrcexcerpts/", {
        rcentId: hrcentId,
        lng: "FR",
        rad: true,
        companyOfsUid: uid,
        extraitTravail: false,
        admOrderDirection: "ASC",
        order: "F",
      });
    } catch (err) {
      logger.warn(`VaudClient: extract fetch failed for ${uid}: ${err}`);
      return null;
    }
  }

  /**
   * Enrich a Vaud company with officer and shareholder data.
   * Returns null if enrichment is not possible (missing URL, API error, etc.).
   */
  async enrichCompany(company: CompanyFull): Promise<CantonalEnrichment | null> {
    if (!company.cantonalExcerptWeb) return null;

    // Extract the formatted UID (CHE-XXX.XXX.XXX) from the cantonal URL
    let uidOfs: string;
    try {
      const url = new URL(company.cantonalExcerptWeb);
      uidOfs = url.searchParams.get("companyOfsUid") ?? "";
      if (!uidOfs) return null;
    } catch {
      return null;
    }

    const hrcentId = await this.getHrcentId(company.name, uidOfs);
    if (!hrcentId) {
      logger.warn(`VaudClient: hrcentId not found for ${company.name} (${uidOfs})`);
      return null;
    }

    const extract = await this.getExtract(hrcentId, uidOfs);
    if (!extract) return null;

    const activeAdms = (extract.adms ?? []).filter((a) => a.codeEtat === "A");
    const officers: Officer[] = [];
    const shareholders: Shareholder[] = [];

    for (const entry of activeAdms) {
      const name = stripHtml(entry.pers);
      const role = (entry.fonction ?? "").trim();

      if (role.includes("associé")) {
        const sharesRaw = entry.fcdAss?.trim() ?? "";
        // fcdAss looks like ", avec 5 parts de CHF 360" — strip leading comma
        const shares = sharesRaw.replace(/^,\s*/, "") || undefined;
        shareholders.push({ name, shares });
      } else {
        officers.push({
          name,
          role: role || "—",
          ...(entry.sign ? { signatureType: entry.sign } : {}),
        });
      }
    }

    return {
      officers,
      shareholders,
      source: company.cantonalExcerptWeb,
      enrichedAt: new Date().toISOString(),
    };
  }
}
