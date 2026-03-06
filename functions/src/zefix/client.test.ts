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

let client: ZefixClient;
let fetchMock: ReturnType<typeof createFetchMock>;

function createFetchMock() {
  const fn = Object.assign(
    async (...args: Parameters<typeof fetch>): Promise<Response> => {
      return fn._impl(...args);
    },
    {
      _impl: async (..._args: Parameters<typeof fetch>): Promise<Response> => {
        return new Response("", { status: 500 });
      },
      mockResolvedValue(body: unknown, status = 200) {
        fn._impl = async () =>
          new Response(JSON.stringify(body), {
            status,
            headers: { "Content-Type": "application/json" },
          });
      },
      mockRejectedValue(status: number, body?: unknown) {
        fn._impl = async () =>
          new Response(body ? JSON.stringify(body) : "", { status });
      },
    }
  );
  return fn;
}

function setup() {
  fetchMock = createFetchMock();
  (globalThis as any).fetch = fetchMock;
  client = new ZefixClient(mockConfig);
}

// --- Tests ---

async function testSearchCompanies() {
  setup();
  fetchMock.mockResolvedValue([mockCompanyShort]);

  const result = await client.searchCompanies({ name: "Test" });
  assert(Array.isArray(result), "should return array");
  assert(result[0].name === "Test AG", "should have correct name");
  console.log("  PASS: searchCompanies");
}

async function testGetCompanyByUid() {
  setup();
  fetchMock.mockResolvedValue([mockCompanyFull]);

  const result = await client.getCompanyByUid("CHE-123.456.789");
  assert(Array.isArray(result), "should return array");
  assert(result[0].purpose === "Test purpose", "should have purpose");
  console.log("  PASS: getCompanyByUid");
}

async function testGetCompanyByEhraid() {
  setup();
  fetchMock.mockResolvedValue(mockCompanyFull);

  const result = await client.getCompanyByEhraid(12345);
  assert(result.ehraid === 12345, "should have correct ehraid");
  console.log("  PASS: getCompanyByEhraid");
}

async function testGetCompanyByChid() {
  setup();
  fetchMock.mockResolvedValue([mockCompanyFull]);

  const result = await client.getCompanyByChid("CH12345678");
  assert(Array.isArray(result), "should return array");
  console.log("  PASS: getCompanyByChid");
}

async function testGetLegalForms() {
  setup();
  const mockForms: LegalForm[] = [
    { id: 1, uid: "0106", name: { de: "AG" }, shortName: { de: "AG" } },
  ];
  fetchMock.mockResolvedValue(mockForms);

  const result = await client.getLegalForms();
  assert(result.length === 1, "should return 1 legal form");
  console.log("  PASS: getLegalForms");
}

async function testGetCommunities() {
  setup();
  fetchMock.mockResolvedValue([{ bfsId: 261, canton: "ZH", name: "Zürich", registryOfCommerceId: 1 }]);

  const result = await client.getCommunities();
  assert(result[0].bfsId === 261, "should have correct bfsId");
  console.log("  PASS: getCommunities");
}

async function testGetRegistriesOfCommerce() {
  setup();
  fetchMock.mockResolvedValue([{ registryOfCommerceId: 1, canton: "ZH" }]);

  const result = await client.getRegistriesOfCommerce();
  assert(result[0].registryOfCommerceId === 1, "should have correct id");
  console.log("  PASS: getRegistriesOfCommerce");
}

async function testErrorHandling() {
  setup();
  fetchMock.mockRejectedValue(404, { error: { type: "NOT_FOUND", message: "Not found" } });

  try {
    await client.getCompanyByEhraid(99999);
    assert(false, "should have thrown");
  } catch (e) {
    const err = e as ZefixApiError;
    assert(err instanceof ZefixApiError, "should be ZefixApiError");
    assert(err.status === 404, "should have 404 status");
    assert(err.errorResponse?.error.type === "NOT_FOUND", "should have error type");
  }
  console.log("  PASS: errorHandling");
}

async function testBasicAuthHeader() {
  setup();
  let capturedHeaders: HeadersInit | undefined;
  (globalThis as any).fetch = async (_url: string, init?: RequestInit) => {
    capturedHeaders = init?.headers;
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  client = new ZefixClient(mockConfig);

  await client.searchCompanies({ name: "Test" });
  const expected = "Basic " + Buffer.from("user:pass").toString("base64");
  assert(
    (capturedHeaders as Record<string, string>)?.Authorization === expected,
    "should send correct Basic Auth header"
  );
  console.log("  PASS: basicAuthHeader");
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

async function runTests() {
  console.log("ZefixClient tests:");
  await testSearchCompanies();
  await testGetCompanyByUid();
  await testGetCompanyByEhraid();
  await testGetCompanyByChid();
  await testGetLegalForms();
  await testGetCommunities();
  await testGetRegistriesOfCommerce();
  await testErrorHandling();
  await testBasicAuthHeader();
  console.log("All tests passed!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
