import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { dedupeRows } from "./sync-vaud";

type Row = Parameters<typeof dedupeRows>[0][number];

/** Minimal row carrying only the fields dedupeRows looks at. */
function row(uid: string, ehraid: number | null, name = uid): Row {
  return { uid, ehraid, name } as Row;
}

describe("dedupeRows", () => {
  it("leaves distinct rows untouched and in order", () => {
    const rows = [row("CHE-1", 1), row("CHE-2", 2), row("CHE-3", 3)];
    expect(dedupeRows(rows).map((r) => r.uid)).toEqual(["CHE-1", "CHE-2", "CHE-3"]);
  });

  it("collapses repeated uids, keeping the last occurrence", () => {
    const rows = [row("CHE-1", 1, "stale"), row("CHE-1", 1, "fresh")];
    const out = dedupeRows(rows);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("fresh");
  });

  it("collapses distinct uids sharing an ehraid, keeping the last", () => {
    // Postgres would reject the batch outright: companies.ehraid is UNIQUE.
    const rows = [row("CHE-OLD", 1753670), row("CHE-NEW", 1753670)];
    const out = dedupeRows(rows);
    expect(out).toHaveLength(1);
    expect(out[0].uid).toBe("CHE-NEW");
  });

  it("keeps every row with a null ehraid", () => {
    const rows = [row("CHE-1", null), row("CHE-2", null)];
    expect(dedupeRows(rows)).toHaveLength(2);
  });

  it("preserves the relative order of surviving rows", () => {
    const rows = [row("CHE-1", 1), row("CHE-2", 2), row("CHE-3", 2), row("CHE-4", 4)];
    // CHE-2 loses the ehraid clash to the later CHE-3.
    expect(dedupeRows(rows).map((r) => r.uid)).toEqual(["CHE-1", "CHE-3", "CHE-4"]);
  });
});
