import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn<(query: unknown) => Promise<{ count: number }>>(),
}));

vi.mock("./index", () => ({ db: { execute: mockExecute } }));

import { purgeOtherCantons } from "./init";

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
