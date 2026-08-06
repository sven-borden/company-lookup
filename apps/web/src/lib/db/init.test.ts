import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn<(query: unknown) => Promise<{ count: number }>>(),
}));

vi.mock("./index", () => ({ db: { execute: mockExecute } }));

import { initializeDatabase, purgeOtherCantons } from "./init";

/**
 * Count the chunks of a Drizzle SQL object that become bind parameters
 * ($1, $2, ...) at execution time.
 *
 * Static text is a StringChunk (its `value` is a string array) and an embedded
 * `sql.raw(...)` is a nested SQL object (it has `queryChunks`); both are
 * inlined. Anything else is an interpolated value, which Drizzle binds.
 */
function bindParamCount(query: unknown): number {
  const chunks = (query as { queryChunks?: unknown[] })?.queryChunks ?? [];

  return chunks.reduce<number>((total, chunk) => {
    if (typeof chunk !== "object" || chunk === null) return total + 1;
    if (Array.isArray((chunk as { value?: unknown }).value)) return total; // StringChunk
    if ("queryChunks" in chunk) return total + bindParamCount(chunk);      // nested SQL
    return total + 1;
  }, 0);
}

/** Render a Drizzle SQL object's static chunks so tests can match on shape. */
function sqlText(query: unknown): string {
  const chunks = (query as { queryChunks?: Array<{ value?: unknown }> })?.queryChunks ?? [];
  return chunks
    .map((chunk) => (Array.isArray(chunk?.value) ? chunk.value.join("") : ""))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("purgeOtherCantons", () => {
  it("stops after a single delete when nothing matches", async () => {
    mockExecute.mockResolvedValue({ count: 0 });

    await purgeOtherCantons();

    // One batch delete that came back empty, plus the canton_stats cleanup.
    expect(mockExecute).toHaveBeenCalledTimes(2);
    expect(sqlText(mockExecute.mock.calls[0][0])).toContain("DELETE FROM companies");
    expect(sqlText(mockExecute.mock.calls[1][0])).toContain("DELETE FROM canton_stats");
  });

  it("keeps deleting until a batch comes back empty", async () => {
    mockExecute
      .mockResolvedValueOnce({ count: 20000 })
      .mockResolvedValueOnce({ count: 20000 })
      .mockResolvedValueOnce({ count: 137 })
      .mockResolvedValue({ count: 0 });

    await purgeOtherCantons();

    // 3 non-empty batches + 1 empty batch that breaks the loop + canton_stats.
    expect(mockExecute).toHaveBeenCalledTimes(5);
  });

  it("deletes in bounded batches rather than one unbounded statement", async () => {
    mockExecute.mockResolvedValue({ count: 0 });

    await purgeOtherCantons();

    expect(sqlText(mockExecute.mock.calls[0][0])).toContain("LIMIT");
  });

  it("targets rows outside the configured canton", async () => {
    mockExecute.mockResolvedValue({ count: 0 });

    await purgeOtherCantons();

    expect(sqlText(mockExecute.mock.calls[0][0])).toContain("canton <>");
  });
});

describe("initializeDatabase", () => {
  // Regression: PostgreSQL rejects bind parameters in DDL. A partial index
  // whose predicate carried $1 failed at boot with "42P18: could not determine
  // data type of parameter $1", which aborted initialization before the
  // remaining indexes were created and before the purge ever ran.
  it("issues no statement containing a bind parameter", async () => {
    mockExecute.mockResolvedValue({ count: 0 });

    await initializeDatabase();

    const offenders = mockExecute.mock.calls
      .map(([query]) => ({ sql: sqlText(query), params: bindParamCount(query) }))
      .filter((call) => call.params > 0);

    expect(offenders).toEqual([]);
  });

  it("creates the partial canton index used by the purge", async () => {
    mockExecute.mockResolvedValue({ count: 0 });

    await initializeDatabase();

    const statements = mockExecute.mock.calls.map(([query]) => sqlText(query));
    expect(statements.some((s) => s.includes("idx_companies_non_target_canton"))).toBe(true);
    expect(statements.some((s) => s.includes("DROP INDEX IF EXISTS idx_companies_canton"))).toBe(true);
    expect(statements.some((s) => s.includes("idx_companies_name ON companies(name)"))).toBe(true);
  });
});
