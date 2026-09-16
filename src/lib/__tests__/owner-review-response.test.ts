import { expect, it } from "bun:test";
import { respondToReview } from "../owner-portal.server";

it("preserves atomic authorization, availability and canonical approval denials", async () => {
  // SQL tests exercise actual roles, ownership, dates and writes. This boundary
  // ensures database failures cannot be converted to success or fallback writes.
  for (const message of [
    "Different owner",
    "Program closed",
    "Opportunity unavailable",
    "Use the canonical approval request",
  ]) {
    const db = {
      from: () => {
        throw new Error("No raw owner-table preflight is permitted");
      },
      rpc: async (name: string) => {
        expect(name).toBe("respond_owner_review");
        return { data: null, error: new Error(message) };
      },
    };
    await expect(
      respondToReview(db as never, "owner", {
        reviewId: "review",
        expectedUpdatedAt: "2026-09-15T00:00:00Z",
        decision: "acknowledged",
        response: "Review notes",
      }),
    ).rejects.toThrow(message);
  }
});
it("retains the viewed version and exact narrative revision in the single atomic response", async () => {
  let calls = 0;
  const db = {
    from: () => {
      throw new Error("No post-commit read");
    },
    rpc: async (name: string, args: unknown) => {
      calls++;
      expect(name).toBe("respond_owner_review");
      expect(args).toEqual({
        _review_id: "review",
        _expected_updated_at: "2026-09-15T00:00:00Z",
        _decision: "acknowledged",
        _response: "Review notes",
        _owner_update_revision: 2,
      });
      return { data: "review", error: null };
    },
  };
  expect(
    await respondToReview(db as never, "owner", {
      reviewId: "review",
      expectedUpdatedAt: "2026-09-15T00:00:00Z",
      decision: "acknowledged",
      response: "Review notes",
      ownerUpdateRevision: 2,
    }),
  ).toEqual({ ok: true });
  expect(calls).toBe(1);
});
