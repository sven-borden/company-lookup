import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CANTONS } from "@swiss-biz-hunter/types";

// Hoisted mocks so factories can reference them
const { mockCommit, mockSet, mockBatchFn, mockDocRef, mockDoc, mockCollection, mockDb } =
  vi.hoisted(() => {
    const mockCommit = vi.fn().mockResolvedValue(undefined);
    const mockSet = vi.fn();
    const mockDocRef = {
      set: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
    };
    const mockDoc = vi.fn().mockReturnValue(mockDocRef);
    const mockCountGet = vi.fn().mockResolvedValue({ data: () => ({ count: 0 }) });
    const mockCount = vi.fn().mockReturnValue({ get: mockCountGet });
    const mockWhere = vi.fn();
    mockWhere.mockReturnValue({ count: mockCount, where: mockWhere });
    const mockCollection = vi.fn().mockReturnValue({ doc: mockDoc, where: mockWhere });
    const mockBatchFn = vi.fn().mockReturnValue({ set: mockSet, commit: mockCommit });
    const mockDb = { batch: mockBatchFn, collection: mockCollection };
    return { mockCommit, mockSet, mockBatchFn, mockDocRef, mockDoc, mockCollection, mockDb };
  });

vi.mock("firebase-admin/app", () => ({ initializeApp: vi.fn() }));
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn().mockReturnValue(mockDb),
}));
vi.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: vi.fn().mockImplementation((_opts: unknown, handler: unknown) => handler),
}));
vi.mock("firebase-functions/params", () => ({
  defineString: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue("test") }),
}));
vi.mock("firebase-functions/v2", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../zefix/client", () => ({
  ZefixClient: vi.fn().mockImplementation(() => ({
    getLegalForms: vi.fn().mockResolvedValue([]),
    getCommunities: vi.fn().mockResolvedValue([]),
    getRegistriesOfCommerce: vi.fn().mockResolvedValue([]),
    searchCompanies: vi.fn().mockResolvedValue([]),
    getCompanyByEhraid: vi.fn().mockResolvedValue({}),
  })),
}));

import { syncReferenceData, syncCompaniesForCanton, BATCH_SIZE, syncZefixData } from "./sync";
import { ZefixClient } from "../zefix/client";

function makeMockClient() {
  return {
    getLegalForms: vi.fn().mockResolvedValue([]),
    getCommunities: vi.fn().mockResolvedValue([]),
    getRegistriesOfCommerce: vi.fn().mockResolvedValue([]),
    searchCompanies: vi.fn().mockResolvedValue([]),
    getCompanyByEhraid: vi.fn().mockResolvedValue({}),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCommit.mockResolvedValue(undefined);
  mockDocRef.set.mockResolvedValue(undefined);
  mockDocRef.update.mockResolvedValue(undefined);
  const mockCountGet = vi.fn().mockResolvedValue({ data: () => ({ count: 0 }) });
  const mockCount = vi.fn().mockReturnValue({ get: mockCountGet });
  const mockWhere = vi.fn();
  mockWhere.mockReturnValue({ count: mockCount, where: mockWhere });
  mockCollection.mockReturnValue({ doc: mockDoc, where: mockWhere });
  mockDoc.mockReturnValue(mockDocRef);
  mockBatchFn.mockReturnValue({ set: mockSet, commit: mockCommit });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CANTONS", () => {
  it("contains all 26 Swiss cantons", () => {
    expect(CANTONS).toHaveLength(26);
    expect(CANTONS).toContain("ZH");
    expect(CANTONS).toContain("GE");
    expect(CANTONS).toContain("TI");
    expect(CANTONS).toContain("VS");
  });
});

describe("syncZefixData", () => {
  it("syncs ZH on Monday (day 1)", async () => {
    vi.setSystemTime(new Date(2024, 4, 13)); // Monday
    const clientMock = {
      searchCompanies: vi.fn().mockResolvedValue([]),
      getLegalForms: vi.fn().mockResolvedValue([]),
      getCommunities: vi.fn().mockResolvedValue([]),
      getRegistriesOfCommerce: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(ZefixClient).mockImplementation(() => clientMock as any);

    await (syncZefixData as any)();

    expect(clientMock.searchCompanies).toHaveBeenCalledWith({ name: "*", canton: "ZH" });
    expect(clientMock.searchCompanies).toHaveBeenCalledTimes(1);
  });

  it("syncs multiple cantons on Saturday (day 6)", async () => {
    vi.setSystemTime(new Date(2024, 4, 18)); // Saturday
    const clientMock = {
      searchCompanies: vi.fn().mockResolvedValue([]),
      getLegalForms: vi.fn().mockResolvedValue([]),
      getCommunities: vi.fn().mockResolvedValue([]),
      getRegistriesOfCommerce: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(ZefixClient).mockImplementation(() => clientMock as any);

    await (syncZefixData as any)();

    // CANTON_SCHEDULE[6] = ["ZG", "VS", "BL", "FR"]
    expect(clientMock.searchCompanies).toHaveBeenCalledWith({ name: "*", canton: "ZG" });
    expect(clientMock.searchCompanies).toHaveBeenCalledWith({ name: "*", canton: "VS" });
    expect(clientMock.searchCompanies).toHaveBeenCalledWith({ name: "*", canton: "BL" });
    expect(clientMock.searchCompanies).toHaveBeenCalledWith({ name: "*", canton: "FR" });
    expect(clientMock.searchCompanies).toHaveBeenCalledTimes(4);
  });

  it("syncs reference data before companies", async () => {
    vi.setSystemTime(new Date(2024, 4, 13)); // Monday
    const clientMock = {
      searchCompanies: vi.fn().mockResolvedValue([]),
      getLegalForms: vi.fn().mockResolvedValue([]),
      getCommunities: vi.fn().mockResolvedValue([]),
      getRegistriesOfCommerce: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(ZefixClient).mockImplementation(() => clientMock as any);

    await (syncZefixData as any)();

    expect(clientMock.getLegalForms).toHaveBeenCalled();
    expect(clientMock.getCommunities).toHaveBeenCalled();
    expect(clientMock.getRegistriesOfCommerce).toHaveBeenCalled();
  });
});

describe("syncReferenceData", () => {
  it("writes legal forms to legalForms collection keyed by id", async () => {
    const client = makeMockClient();
    client.getLegalForms.mockResolvedValue([
      { id: 1, uid: "0106", name: { de: "AG" }, shortName: { de: "AG" } },
    ]);
    await syncReferenceData(client as any);
    expect(mockCollection).toHaveBeenCalledWith("legalForms");
    expect(mockDoc).toHaveBeenCalledWith("1");
  });

  it("writes communities to communities collection keyed by bfsId", async () => {
    const client = makeMockClient();
    client.getCommunities.mockResolvedValue([
      { bfsId: 261, canton: "ZH", name: "Zürich", registryOfCommerceId: 1 },
    ]);
    await syncReferenceData(client as any);
    expect(mockCollection).toHaveBeenCalledWith("communities");
    expect(mockDoc).toHaveBeenCalledWith("261");
  });

  it("writes registries to registries collection keyed by registryOfCommerceId", async () => {
    const client = makeMockClient();
    client.getRegistriesOfCommerce.mockResolvedValue([{ registryOfCommerceId: 5, canton: "ZH" }]);
    await syncReferenceData(client as any);
    expect(mockCollection).toHaveBeenCalledWith("registries");
    expect(mockDoc).toHaveBeenCalledWith("5");
  });

  it("commits batch when count reaches BATCH_SIZE, then commits remainder", async () => {
    const client = makeMockClient();
    const forms = Array.from({ length: BATCH_SIZE + 1 }, (_, i) => ({
      id: i,
      uid: `${i}`,
      name: { de: "Form" },
      shortName: { de: "F" },
    }));
    client.getLegalForms.mockResolvedValue(forms);
    await syncReferenceData(client as any);
    // One mid-batch commit + one final commit
    expect(mockCommit).toHaveBeenCalledTimes(2);
  });

  it("commits final batch even when total < BATCH_SIZE", async () => {
    const client = makeMockClient();
    client.getLegalForms.mockResolvedValue([
      { id: 1, uid: "0106", name: { de: "AG" }, shortName: { de: "AG" } },
    ]);
    await syncReferenceData(client as any);
    expect(mockCommit).toHaveBeenCalledTimes(1);
  });
});

describe("syncCompaniesForCanton", () => {
  it("fetches all companies for the canton and writes to companies collection", async () => {
    const client = makeMockClient();
    const fullCompany = { uid: "CHE-123.456.789", name: "Test AG", ehraid: 1, status: "ACTIVE" };
    client.searchCompanies.mockResolvedValue([{ ehraid: 1 }]);
    client.getCompanyByEhraid.mockResolvedValue(fullCompany);

    await syncCompaniesForCanton(client as any, "ZH");

    expect(client.searchCompanies).toHaveBeenCalledWith({ name: "*", canton: "ZH" });
    expect(mockCollection).toHaveBeenCalledWith("companies");
    expect(mockDoc).toHaveBeenCalledWith(fullCompany.uid);
  });

  it("skips company and logs warning when getCompanyByEhraid throws", async () => {
    const { logger } = await import("firebase-functions/v2");
    const client = makeMockClient();
    client.searchCompanies.mockResolvedValue([{ ehraid: 99 }, { ehraid: 100 }]);
    client.getCompanyByEhraid
      .mockRejectedValueOnce(new Error("not found"))
      .mockResolvedValueOnce({ uid: "CHE-999.999.999", ehraid: 100 });

    const count = await syncCompaniesForCanton(client as any, "ZH");

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(count).toBe(1);
  });

  it("commits final batch when batchCount < BATCH_SIZE", async () => {
    const client = makeMockClient();
    client.searchCompanies.mockResolvedValue([{ ehraid: 1 }]);
    client.getCompanyByEhraid.mockResolvedValue({ uid: "CHE-123.456.789", ehraid: 1 });

    await syncCompaniesForCanton(client as any, "ZH");

    expect(mockCommit).toHaveBeenCalledTimes(1);
  });

  it("commits mid-batch when batchCount reaches BATCH_SIZE", async () => {
    const client = makeMockClient();
    const companies = Array.from({ length: BATCH_SIZE }, (_, i) => ({ ehraid: i }));
    client.searchCompanies.mockResolvedValue(companies);
    client.getCompanyByEhraid.mockImplementation(async (id: number) => ({
      uid: `CHE-${id}`,
      ehraid: id,
    }));

    await syncCompaniesForCanton(client as any, "ZH");

    // Exactly one mid-batch commit (at BATCH_SIZE), no final commit (batchCount resets to 0)
    expect(mockCommit).toHaveBeenCalledTimes(1);
  });

  it("returns correct count of synced companies", async () => {
    const client = makeMockClient();
    client.searchCompanies.mockResolvedValue([{ ehraid: 1 }, { ehraid: 2 }, { ehraid: 3 }]);
    client.getCompanyByEhraid.mockImplementation(async (id: number) => ({
      uid: `CHE-${id}`,
      ehraid: id,
    }));

    const count = await syncCompaniesForCanton(client as any, "ZH");
    expect(count).toBe(3);
  });
});
