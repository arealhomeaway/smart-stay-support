import { expect, it } from "bun:test";
import { respondToReview } from "../owner-portal.server";

function fixture(reviewChange = {}, programChange = {}) {
  const updates: Record<string, unknown>[] = [];
  const filters: [string, unknown][] = [];
  const review = {
    id: "review",
    program_id: "program",
    title: "Property work",
    auto_ticket: true,
    status: "awaiting_owner",
    available_from: null,
    updated_at: "2026-09-15T00:00:00Z",
    ...reviewChange,
  };
  const program = { owner_user_id: "owner", archived_at: null, status: "active", ...programChange };
  const db = {
    rpc: async (_name: string, args: Record<string, unknown>) => {
      updates.push(args);
      return {
        data: null,
        error: new Error("The opportunity changed. Refresh before responding."),
      };
    },
    from: (table: string) => {
      let writing = false;
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          if (writing) filters.push([key, value]);
          return query;
        },
        single: async () => ({ data: table === "owner_reviews" ? review : program, error: null }),
        update: (patch: Record<string, unknown>) => {
          writing = true;
          updates.push(patch);
          return query;
        },
        maybeSingle: async () => ({ data: null, error: null }),
      };
      return query;
    },
  };
  return { db, updates, filters };
}
async function attempt(f: ReturnType<typeof fixture>, decision = "acknowledged") {
  try {
    await respondToReview(f.db as never, "owner", {
      reviewId: "review",
      expectedUpdatedAt: "2026-09-15T00:00:00Z",
      decision,
      response: "My review notes",
    });
    return "";
  } catch (error) {
    return (error as Error).message;
  }
}
it("rejects a different owner, closed program and unavailable review without writes", async () => {
  for (const f of [
    fixture({}, { owner_user_id: "other" }),
    fixture({}, { status: "closed" }),
    fixture({}, { archived_at: "2026-09-15" }),
    fixture({ status: "answered" }),
    fixture({ available_from: "2999-01-01T00:00:00Z" }),
  ]) {
    expect((await attempt(f)).length > 0).toBe(true);
    expect(f.updates.length).toBe(0);
  }
});
it("does not record an arbitrary repair approval through a participation response", async () => {
  const f = fixture();
  expect(await attempt(f, "approved")).toContain("canonical approval request");
  expect(f.updates.length).toBe(0);
});
it("preserves the automatic request and rejects an acknowledgement when the viewed row changed", async () => {
  const f = fixture({ updated_at: "2026-09-15T01:00:00Z" });
  expect(await attempt(f)).toContain("changed");
  expect(f.updates[0]).toEqual({
    _review_id: "review",
    _expected_updated_at: "2026-09-15T00:00:00Z",
    _decision: "acknowledged",
    _response: "My review notes",
  });
  expect(f.filters.length).toBe(0);
});
