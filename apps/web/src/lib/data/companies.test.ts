import { describe, it, expect, vi, beforeEach } from "vitest";

// The data layer builds Drizzle query chains; these stubs record the terminal
// arguments (limit/offset, findFirst's where) without emulating SQL execution.
const { mockLimit, mockOffset, mockFindFirst, mockSelect } = vi.hoisted(() => {
  const mockOffset = vi.fn(async () => []);
  const mockLimit = vi.fn(() => ({ offset: mockOffset }));
  const mockFindFirst = vi.fn<(args?: unknown) => Promise<undefined>>(async () => undefined);

  // browseCompanies fires two selects in parallel: a count and a page of rows.
  // The count chain resolves straight off .from(); the row chain adds orderBy.
  const mockSelect = vi.fn((fields?: unknown) => {
    if (fields) {
      return { from: () => Promise.resolve([{ count: 0 }]) };
    }
    return {
      from: () => ({
        orderBy: () => ({ limit: mockLimit }),
        where: () => ({ orderBy: () => ({ limit: mockLimit }) }),
      }),
    };
  });

  return { mockLimit, mockOffset, mockFindFirst, mockSelect };
});

vi.mock("../db", () => ({
  db: {
    select: mockSelect,
    query: { companies: { findFirst: mockFindFirst } },
  },
}));

import { browseCompanies, searchCompanies, getCompanyByUid } from "./companies";

/**
 * Pull the bound parameter values out of the `where` condition findFirst was
 * called with. Drizzle's eq() builds a SQL object whose queryChunks hold the
 * column, the operator, and a Param carrying the value; the object graph is
 * circular, so it can't just be stringified.
 */
function boundParams(callArgs: unknown): unknown[] {
  const where = (callArgs as { where?: { queryChunks?: unknown[] } })?.where;
  return (where?.queryChunks ?? [])
    .filter((chunk): chunk is { value: unknown } =>
      typeof chunk === "object" && chunk !== null && "value" in chunk)
    .map((chunk) => chunk.value);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLimit.mockReturnValue({ offset: mockOffset });
  mockOffset.mockResolvedValue([]);
  mockFindFirst.mockResolvedValue(undefined);
});

describe("searchCompanies", () => {
  it("returns [] for an empty string without touching the database", async () => {
    expect(await searchCompanies("")).toEqual([]);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("returns [] for a whitespace-only query without touching the database", async () => {
    expect(await searchCompanies("   ")).toEqual([]);
    expect(mockSelect).not.toHaveBeenCalled();
  });
});

describe("browseCompanies", () => {
  it("defaults to page 1 with 20 rows per page", async () => {
    await browseCompanies();
    expect(mockLimit).toHaveBeenCalledWith(20);
    expect(mockOffset).toHaveBeenCalledWith(0);
  });

  it("clamps pageSize to a maximum of 100", async () => {
    await browseCompanies({ pageSize: 5000 });
    expect(mockLimit).toHaveBeenCalledWith(100);
  });

  it("clamps pageSize to a minimum of 1", async () => {
    await browseCompanies({ pageSize: 0 });
    expect(mockLimit).toHaveBeenCalledWith(1);
  });

  it("clamps page to a minimum of 1, so offset never goes negative", async () => {
    await browseCompanies({ page: -3 });
    expect(mockOffset).toHaveBeenCalledWith(0);
  });

  it("computes offset from the clamped page and pageSize", async () => {
    await browseCompanies({ page: 4, pageSize: 25 });
    expect(mockOffset).toHaveBeenCalledWith(75);
  });
});

describe("getCompanyByUid", () => {
  it("returns null for an empty uid without querying", async () => {
    expect(await getCompanyByUid("")).toBeNull();
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("normalizes a bare 9-digit uid into CHE-xxx.xxx.xxx form", async () => {
    await getCompanyByUid("CHE123456789");
    expect(mockFindFirst).toHaveBeenCalledTimes(1);
    expect(boundParams(mockFindFirst.mock.calls[0][0])).toContain("CHE-123.456.789");
  });

  it("leaves an already-formatted uid untouched", async () => {
    await getCompanyByUid("CHE-123.456.789");
    expect(boundParams(mockFindFirst.mock.calls[0][0])).toContain("CHE-123.456.789");
  });

  it("returns null when no row matches", async () => {
    expect(await getCompanyByUid("CHE-000.000.000")).toBeNull();
  });
});
