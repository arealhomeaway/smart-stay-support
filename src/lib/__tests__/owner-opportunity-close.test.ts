import { expect, it } from "bun:test";
import { closeOpportunity } from "../owner-opportunity.server";

function closeDb({
  access = true,
  accessError = null as Error | null,
  closureError = null as Error | null,
  saved = true,
} = {}) {
  const reads: string[] = [];
  const closures: unknown[] = [];
  const row = { id: "review", updated_at: "2026-09-16T01:00:00Z" };
  const db = {
    rpc: async (name: string, args: unknown) => {
      if (name === "is_internal_staff") {
        expect(args).toEqual({ _user_id: "actor" });
        return { data: access, error: accessError };
      }
      expect(name).toBe("close_owner_opportunity");
      closures.push(args);
      return { data: saved ? row.id : null, error: closureError };
    },
    from: (table: string) => {
      reads.push(table);
      expect(table).toBe("owner_reviews");
      const query = {
        select: () => query,
        eq: () => query,
        single: async () => ({ data: row, error: null }),
      };
      return query;
    },
  };
  return { db, reads, closures };
}

async function attempt(db: ReturnType<typeof closeDb>["db"]) {
  try {
    await closeOpportunity(db as never, "actor", {
      opportunityId: "review",
      expectedUpdatedAt: "2026-09-16T01:00:00Z",
      reason: "Work no longer needed",
    });
    return "";
  } catch (error) {
    return (error as Error).message;
  }
}

it("denies the staff close endpoint to owners before reading an opportunity", async () => {
  const test = closeDb({ access: false });
  expect(await attempt(test.db)).toContain("Only staff");
  expect(test.reads.length).toBe(0);
  expect(test.closures.length).toBe(0);
});

it("fails closed when staff access cannot be verified", async () => {
  const test = closeDb({ accessError: new Error("Access unavailable") });
  expect(await attempt(test.db)).toBe("Access unavailable");
  expect(test.reads.length).toBe(0);
  expect(test.closures.length).toBe(0);
});

it("sends the browser-reviewed version and reason without replacing them from a fresh read", async () => {
  const test = closeDb();
  expect(await attempt(test.db)).toBe("");
  expect(test.closures).toEqual([
    {
      _review_id: "review",
      _expected_updated_at: "2026-09-16T01:00:00Z",
      _reason: "Work no longer needed",
    },
  ]);
  expect(test.reads).toEqual([]);
});

it("surfaces failed atomic closure without writing separate success history", async () => {
  const test = closeDb({
    closureError: new Error("The opportunity changed. Refresh before closing it."),
  });
  expect(await attempt(test.db)).toContain("opportunity changed");
  expect(test.reads).toEqual([]);
  expect(test.closures.length).toBe(1);
});

it("does not report success when the atomic endpoint returns no saved opportunity", async () => {
  const test = closeDb({ saved: false });
  expect(await attempt(test.db)).toContain("opportunity changed");
  expect(test.reads).toEqual([]);
});
