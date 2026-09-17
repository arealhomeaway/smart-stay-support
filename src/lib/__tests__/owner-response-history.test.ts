import { expect, it } from "bun:test";
import { loadOwnerResponseReceipts } from "../owner-response-history.server";

it("reads all response receipts within the selected program and strips private fields", async () => {
  const rows = Array.from({ length: 1205 }, (_, i) => ({
    id: `receipt-${i}`,
    review_id: "review",
    created_at: "2026-01-02T00:00:00Z",
    detail: {
      response: `Reviewed ${i}`,
      private_note: "PRIVATE",
      ownerUpdate: {
        revision: 1,
        issue: "Original issue",
        work_performed: "Original work",
        outcome: "Original outcome",
        reviewed_at: "2026-01-01",
        internal_note: "PRIVATE",
      },
    },
  }));
  const filters: unknown[] = [];
  const pages: number[] = [];
  const query = {
    select: () => query,
    eq: (key: string, value: string) => {
      filters.push([key, value]);
      return query;
    },
    in: (key: string, value: string[]) => {
      filters.push([key, value]);
      return query;
    },
    order: () => query,
    range: async (from: number, to: number) => {
      pages.push(from);
      return {
        data: rows.slice(from, Math.min(to + 1, from + 200)),
        count: rows.length,
        error: null,
      };
    },
  };
  const receipts = await loadOwnerResponseReceipts({ from: () => query } as never, "program");
  expect(filters).toEqual([
    ["program_id", "program"],
    ["kind", ["owner_participation_response", "owner_decision"]],
  ]);
  expect(pages).toEqual([0, 200, 400, 600, 800, 1000, 1200]);
  expect(receipts.length).toBe(1205);
  expect(receipts[1204]?.response).toBe("Reviewed 1204");
  expect(receipts[1204]?.ownerUpdate?.work_performed).toBe("Original work");
  expect(JSON.stringify(receipts).includes("PRIVATE")).toBe(false);
});

it("rejects unavailable response history rather than silently omitting it from closeout", async () => {
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    order: () => query,
    range: async () => ({ data: null, count: null, error: new Error("history access denied") }),
  };
  const error = await loadOwnerResponseReceipts({ from: () => query } as never, "program").then(
    () => "unexpected success",
    (e: Error) => e.message,
  );
  expect(error).toBe("history access denied");
});
