import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGet, mockCollection, mockAdminDb } = vi.hoisted(() => {
  const mockGet = vi.fn();
  const mockCollection = vi.fn().mockReturnValue({ get: mockGet });
  const mockAdminDb = { collection: mockCollection };
  return { mockGet, mockCollection, mockAdminDb };
});

vi.mock("../firebase/admin", () => ({ adminDb: mockAdminDb }));

import { getLegalForms, getCommunities, getRegistries } from "./reference";

beforeEach(() => {
  vi.clearAllMocks();
  mockCollection.mockReturnValue({ get: mockGet });
});

describe("getLegalForms", () => {
  it("reads from legalForms collection", async () => {
    mockGet.mockResolvedValue({
      docs: [{ data: () => ({ id: 1, uid: "0106", name: { de: "AG" }, shortName: { de: "AG" } }) }],
    });
    const result = await getLegalForms();
    expect(mockCollection).toHaveBeenCalledWith("legalForms");
    expect(result).toHaveLength(1);
    expect(result[0].uid).toBe("0106");
  });

  it("returns empty array on empty collection", async () => {
    mockGet.mockResolvedValue({ docs: [] });
    const result = await getLegalForms();
    expect(result).toEqual([]);
  });
});

describe("getCommunities", () => {
  it("reads from communities collection", async () => {
    mockGet.mockResolvedValue({
      docs: [{ data: () => ({ bfsId: 261, canton: "ZH", name: "Zürich", registryOfCommerceId: 1 }) }],
    });
    const result = await getCommunities();
    expect(mockCollection).toHaveBeenCalledWith("communities");
    expect(result[0].bfsId).toBe(261);
  });

  it("returns empty array on empty collection", async () => {
    mockGet.mockResolvedValue({ docs: [] });
    const result = await getCommunities();
    expect(result).toEqual([]);
  });
});

describe("getRegistries", () => {
  it("reads from registries collection", async () => {
    mockGet.mockResolvedValue({
      docs: [{ data: () => ({ registryOfCommerceId: 5, canton: "ZH" }) }],
    });
    const result = await getRegistries();
    expect(mockCollection).toHaveBeenCalledWith("registries");
    expect(result[0].registryOfCommerceId).toBe(5);
  });

  it("returns empty array on empty collection", async () => {
    mockGet.mockResolvedValue({ docs: [] });
    const result = await getRegistries();
    expect(result).toEqual([]);
  });
});
