import {
  CompanySearchQuery,
  CompanyShort,
  CompanyFull,
  LegalForm,
  BfsCommunity,
  RegistryOfCommerce,
  RestApiErrorResponse,
  SogcPublicationAndCompanyShort,
} from "@swiss-biz-hunter/types";

export class ZefixApiError extends Error {
  constructor(
    public status: number,
    public errorResponse?: RestApiErrorResponse
  ) {
    super(errorResponse?.error.message ?? `Zefix API error: ${status}`);
    this.name = "ZefixApiError";
  }
}

export interface ZefixClientConfig {
  baseUrl: string;
  username: string;
  password: string;
}

export class ZefixClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(config: ZefixClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.authHeader =
      "Basic " +
      Buffer.from(`${config.username}:${config.password}`).toString("base64");
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: this.authHeader,
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorResponse: RestApiErrorResponse | undefined;
      try {
        errorResponse = await response.json();
      } catch {
        // response body wasn't JSON
      }
      throw new ZefixApiError(response.status, errorResponse);
    }

    return response.json();
  }

  // Company methods

  async searchCompanies(query: CompanySearchQuery): Promise<CompanyShort[]> {
    return this.request<CompanyShort[]>("/api/v1/company/search", {
      method: "POST",
      body: JSON.stringify(query),
    });
  }

  async getCompanyByUid(uid: string): Promise<CompanyFull[]> {
    return this.request<CompanyFull[]>(
      `/api/v1/company/uid/${encodeURIComponent(uid)}`
    );
  }

  async getCompanyByEhraid(id: number): Promise<CompanyFull> {
    return this.request<CompanyFull>(`/api/v1/company/ehraid/${id}`);
  }

  async getCompanyByChid(chid: string): Promise<CompanyFull[]> {
    return this.request<CompanyFull[]>(
      `/api/v1/company/chid/${encodeURIComponent(chid)}`
    );
  }

  // Reference data methods

  async getLegalForms(): Promise<LegalForm[]> {
    return this.request<LegalForm[]>("/api/v1/legalForm");
  }

  async getCommunities(): Promise<BfsCommunity[]> {
    return this.request<BfsCommunity[]>("/api/v1/community");
  }

  async getRegistriesOfCommerce(): Promise<RegistryOfCommerce[]> {
    return this.request<RegistryOfCommerce[]>("/api/v1/registryOfCommerce");
  }

  // SOGC methods

  async getSogcById(id: number): Promise<SogcPublicationAndCompanyShort> {
    return this.request<SogcPublicationAndCompanyShort>(`/api/v1/sogc/${id}`);
  }

  async getSogcByDate(
    date: string
  ): Promise<SogcPublicationAndCompanyShort[]> {
    return this.request<SogcPublicationAndCompanyShort[]>(
      `/api/v1/sogc/bydate/${encodeURIComponent(date)}`
    );
  }
}
