import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mock for adminDb
const { mockGet, mockLimit, mockWhere, mockDoc, mockCollection, mockAdminDb } = vi.hoisted(() => {
  const mockGet = vi.fn();
  const mockLimit = vi.fn();
  const mockWhere = vi.fn();
  const mockDoc = vi.fn();
  const mockCollection = vi.fn();
  const mockAdminDb = { collection: mockCollection, doc: mockDoc };

  // Chain: collection().where().where().limit().get()
  // Each method returns an object that supports chaining
  const queryChain = { where: mockWhere, limit: mockLimit, get: mockGet };
  mockWhere.mockReturnValue(queryChain);
  mockLimit.mockReturnValue(queryChain);
  mockCollection.mockReturnValue({ where: mockWhere, doc: mockDoc });
  mockDoc.mockReturnValue({ get: mockGet });

  return { mockGet, mockLimit, mockWhere, mockDoc, mockCollection, mockAdminDb };
});

vi.mock("../firebase/admin", () => ({ adminDb: mockAdminDb }));

import { searchCompanies, getCompanyByUid } from "./companies";

beforeEach(() => {
  vi.clearAllMocks();
  const queryChain = { where: mockWhere, limit: mockLimit, get: mockGet };
  mockWhere.mockReturnValue(queryChain);
  mockLimit.mockReturnValue(queryChain);
  mockCollection.mockReturnValue({ where: mockWhere, doc: mockDoc });
  mockDoc.mockReturnValue({ get: mockGet });
});

describe("searchCompanies", () => {
  it("returns [] for empty string without querying Firestore", async () => {
    const result = await searchCompanies("");
    expect(result).toEqual([]);
    expect(mockCollection).not.toHaveBeenCalled();
  });

  it("returns [] for whitespace-only string", async () => {
    const result = await searchCompanies("   ");
    expect(result).toEqual([]);
    expect(mockCollection).not.toHaveBeenCalled();
  });

  it("calls where with >= and <= prefix range on name", async () => {
    mockGet.mockResolvedValue({ docs: [] });
    await searchCompanies("Acme");
    expect(mockWhere).toHaveBeenCalledWith("nameLower", ">=", "acme");
    expect(mockWhere).toHaveBeenCalledWith("nameLower", "<=", "acme\uf8ff");
  });

  it("adds canton filter when filters.canton is set", async () => {
    mockGet.mockResolvedValue({ docs: [] });
    await searchCompanies("Acme", { canton: "ZH" });
    expect(mockWhere).toHaveBeenCalledWith("canton", "==", "ZH");
  });

  it("adds status filter when filters.activeOnly is true", async () => {
    mockGet.mockResolvedValue({ docs: [] });
    await searchCompanies("Acme", { activeOnly: true });
    expect(mockWhere).toHaveBeenCalledWith("status", "==", "ACTIVE");
  });

  it("maps doc.id to uid field in results", async () => {
    mockGet.mockResolvedValue({
      docs: [
        { id: "CHE-123.456.789", data: () => ({ name: "Test AG", status: "ACTIVE" }) },
      ],
    });
    const result = await searchCompanies("Test");
    expect(result[0].uid).toBe("CHE-123.456.789");
  });

  it("applies limit of 20", async () => {
    mockGet.mockResolvedValue({ docs: [] });
    await searchCompanies("Acme");
    expect(mockLimit).toHaveBeenCalledWith(20);
  });
});

describe("getCompanyByUid", () => {
  it("returns null for empty string", async () => {
    const result = await getCompanyByUid("");
    expect(result).toBeNull();
    expect(mockCollection).not.toHaveBeenCalled();
  });

  it("returns null when document does not exist", async () => {
    mockGet.mockResolvedValue({ exists: false });
    const result = await getCompanyByUid("CHE-123.456.789");
    expect(result).toBeNull();
  });

  it("returns company data with uid from doc.id when document exists", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      id: "CHE-123.456.789",
      data: () => ({ name: "Test AG", status: "ACTIVE" }),
    });
    const result = await getCompanyByUid("CHE-123.456.789");
    expect(result).not.toBeNull();
    expect(result!.uid).toBe("CHE-123.456.789");
    expect((result as any).name).toBe("Test AG");
  });
});
