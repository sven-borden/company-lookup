// Cantonal register enrichment types
// Data scraped from cantonal commercial registers (e.g. prestations.vd.ch)

export interface Officer {
  name: string;
  role: string;              // e.g. "adm. président", "gérant", "directeur", "organe de révision"
  signatureType?: string;    // e.g. "signature individuelle", "signature collective à 2"
}

export interface Shareholder {
  name: string;
  shares?: string;           // e.g. "avec 5 parts de CHF 360, privilégiées quant au dividende"
}

export interface CantonalEnrichment {
  officers: Officer[];
  shareholders: Shareholder[];  // Non-empty only for SARL/GmbH (associés are public)
  source: string;               // URL used to fetch data
  enrichedAt: string;           // ISO date string
}
