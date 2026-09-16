import { expect, it } from "bun:test";
import { closeOpportunity } from "../owner-opportunity.server";

function closeDb({ access = true, accessError = null as Error | null, saved = true } = {}) {
  const reads: string[] = [];
  const filters: [string, unknown][] = [];
  const history: unknown[] = [];
  const row = {
    id: "review",
    program_id: "program",
    title: "Property review",
    status: "awaiting_owner",
    updated_at: "2026-09-16T01:00:00Z",
  };
  const db = {
    rpc: async (name: string, args: unknown) => {
      expect(name).toBe("is_internal_staff");
      expect(args).toEqual({ _user_id: "actor" });
      return { data: access, error: accessError };
    },
    from: (table: string) => {
      reads.push(table);
      let mutation = false;
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          if (mutation) filters.push([key, value]);
          return query;
        },
        update: () => {
          mutation = true;
          return query;
        },
        single: async () => ({ data: row, error: null }),
        maybeSingle: async () => ({ data: saved ? { id: row.id } : null, error: null }),
        insert: async (value: unknown) => {
          history.push(value);
          return { error: null };
        },
      };
      return query;
    },
  };
  return { db, reads, filters, history };
}

async function attempt(db: ReturnType<typeof closeDb>["db"]) {
  try {
    await closeOpportunity(db as never, "actor", {
      opportunityId: "review",
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
  expect(test.history.length).toBe(0);
});

it("fails closed when staff access cannot be verified", async () => {
  const test = closeDb({ accessError: new Error("Access unavailable") });
  expect(await attempt(test.db)).toBe("Access unavailable");
  expect(test.reads.length).toBe(0);
});

it("does not record closure when a concurrent response or changed access prevents the update", async () => {
  const test = closeDb({ saved: false });
  expect(await attempt(test.db)).toContain("opportunity changed");
  expect(test.filters).toEqual([
    ["id", "review"],
    ["updated_at", "2026-09-16T01:00:00Z"],
    ["status", "awaiting_owner"],
  ]);
  expect(test.history.length).toBe(0);
});

it("preserves staff closure and records its history after a matching update", async () => {
  const test = closeDb();
  expect(await attempt(test.db)).toBe("");
  expect(test.history.length).toBe(1);
});
