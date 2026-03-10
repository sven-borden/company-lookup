import { describe, it, expect, vi, beforeEach } from "vitest";
import { ZefixClient, ZefixApiError } from "./client";
import type { CompanyShort, CompanyFull, LegalForm } from "@company-lookup/types";

const mockConfig = {
  baseUrl: "https://zefix.example.com",
  username: "user",
  password: "pass",
};

const mockCompanyShort: CompanyShort = {
  name: "Test AG",
  ehraid: 12345,
  uid: "CHE-123.456.789",
  chid: "CH12345678",
  legalSeatId: 1,
  legalSeat: "Zürich",
  registryOfCommerceId: 1,
  legalForm: { id: 1, uid: "0106", name: { de: "AG" }, shortName: { de: "AG" } },
  status: "ACTIVE" as any,
  sogcDate: "2024-01-01",
};

const mockCompanyFull: CompanyFull = {
  ...mockCompanyShort,
  translation: [],
  purpose: "Test purpose",
  sogcPub: [],
  address: {
    organisation: "Test AG",
    careOf: "",
    street: "Bahnhofstrasse",
    houseNumber: "1",
    addon: "",
    poBox: "",
    city: "Zürich",
    swissZipCode: "8001",
  },
  canton: "ZH",
  capitalNominal: "100000",
  capitalCurrency: "CHF",
  headOffices: [],
  furtherHeadOffices: [],
  branchOffices: [],
  hasTakenOver: [],
  wasTakenOverBy: [],
  auditCompanies: [],
  oldNames: [],
  cantonalExcerptWeb: "",
  zefixDetailWeb: { de: "" },
};

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeRawResponse(body: string, status: number): Response {
  return new Response(body, { status });
}

let client: ZefixClient;
let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  fetchSpy = vi.spyOn(globalThis, "fetch");
  client = new ZefixClient(mockConfig);
});

describe("ZefixClient", () => {
  describe("searchCompanies", () => {
    it("returns array of companies", async () => {
      fetchSpy.mockResolvedValue(makeJsonResponse([mockCompanyShort]));
      const result = await client.searchCompanies({ name: "Test" });
      expect(Array.isArray(result)).toBe(true);
      expect(result[0].name).toBe("Test AG");
    });
  });

  describe("getCompanyByUid", () => {
    it("returns array of full companies", async () => {
      fetchSpy.mockResolvedValue(makeJsonResponse([mockCompanyFull]));
      const result = await client.getCompanyByUid("CHE-123.456.789");
      expect(Array.isArray(result)).toBe(true);
      expect(result[0].purpose).toBe("Test purpose");
    });

    it("URL-encodes the uid", async () => {
      fetchSpy.mockResolvedValue(makeJsonResponse([]));
      await client.getCompanyByUid("CHE-123.456.789");
      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain(encodeURIComponent("CHE-123.456.789"));
    });
  });

  describe("getCompanyByEhraid", () => {
    it("returns a single full company", async () => {
      fetchSpy.mockResolvedValue(makeJsonResponse(mockCompanyFull));
      const result = await client.getCompanyByEhraid(12345);
      expect(result.ehraid).toBe(12345);
    });
  });

  describe("getCompanyByChid", () => {
    it("returns array of full companies", async () => {
      fetchSpy.mockResolvedValue(makeJsonResponse([mockCompanyFull]));
      const result = await client.getCompanyByChid("CH12345678");
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getLegalForms", () => {
    it("returns legal forms", async () => {
      const mockForms: LegalForm[] = [
        { id: 1, uid: "0106", name: { de: "AG" }, shortName: { de: "AG" } },
      ];
      fetchSpy.mockResolvedValue(makeJsonResponse(mockForms));
      const result = await client.getLegalForms();
      expect(result).toHaveLength(1);
    });
  });

  describe("getCommunities", () => {
    it("returns communities", async () => {
      fetchSpy.mockResolvedValue(
        makeJsonResponse([{ bfsId: 261, canton: "ZH", name: "Zürich", registryOfCommerceId: 1 }])
      );
      const result = await client.getCommunities();
      expect(result[0].bfsId).toBe(261);
    });
  });

  describe("getRegistriesOfCommerce", () => {
    it("returns registries", async () => {
      fetchSpy.mockResolvedValue(
        makeJsonResponse([{ registryOfCommerceId: 1, canton: "ZH" }])
      );
      const result = await client.getRegistriesOfCommerce();
      expect(result[0].registryOfCommerceId).toBe(1);
    });
  });

  describe("error handling", () => {
    it("throws ZefixApiError with status and errorResponse on JSON error body", async () => {
      fetchSpy.mockResolvedValue(
        makeJsonResponse({ error: { type: "NOT_FOUND", message: "Not found" } }, 404)
      );
      await expect(client.getCompanyByEhraid(99999)).rejects.toMatchObject({
        status: 404,
        errorResponse: { error: { type: "NOT_FOUND" } },
      });
    });

    it("throws ZefixApiError with correct status on 5xx", async () => {
      fetchSpy.mockResolvedValue(makeJsonResponse({ error: { type: "SERVER_ERROR", message: "err" } }, 500));
      await expect(client.searchCompanies({ name: "X" })).rejects.toMatchObject({ status: 500 });
    });

    it("throws ZefixApiError with no errorResponse when body is not JSON", async () => {
      fetchSpy.mockResolvedValue(makeRawResponse("Internal Server Error", 500));
      const err = await client.getCompanyByEhraid(1).catch((e) => e) as ZefixApiError;
      expect(err).toBeInstanceOf(ZefixApiError);
      expect(err.status).toBe(500);
      expect(err.errorResponse).toBeUndefined();
    });

    it("uses fallback message when errorResponse is absent", async () => {
      fetchSpy.mockResolvedValue(makeRawResponse("bad", 503));
      const err = await client.getCompanyByEhraid(1).catch((e) => e) as ZefixApiError;
      expect(err.message).toBe("Zefix API error: 503");
    });

    it("throws ZefixApiError instance", async () => {
      fetchSpy.mockResolvedValue(makeJsonResponse({ error: { type: "NOT_FOUND", message: "nf" } }, 404));
      await expect(client.getCompanyByEhraid(99999)).rejects.toBeInstanceOf(ZefixApiError);
    });
  });

  describe("constructor", () => {
    it("strips trailing slash from baseUrl", async () => {
      fetchSpy.mockResolvedValue(makeJsonResponse([]));
      const c = new ZefixClient({ ...mockConfig, baseUrl: "https://zefix.example.com/" });
      await c.getLegalForms();
      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).not.toContain("//api");
      expect(calledUrl).toMatch(/^https:\/\/zefix\.example\.com\/api/);
    });

    it("sends correct Basic Auth header", async () => {
      let capturedHeaders: HeadersInit | undefined;
      fetchSpy.mockImplementation(async (_url, init) => {
        capturedHeaders = init?.headers;
        return makeJsonResponse([]);
      });
      await client.searchCompanies({ name: "Test" });
      const expected = "Basic " + Buffer.from("user:pass").toString("base64");
      expect((capturedHeaders as Record<string, string>)?.Authorization).toBe(expected);
    });
  });
});
