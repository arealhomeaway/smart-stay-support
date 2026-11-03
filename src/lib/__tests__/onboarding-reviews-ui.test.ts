import { describe, it, expect } from "bun:test";
import { reviewAction, runReviewOverdueSweep, waitingLabel, type ReviewState } from "../onboarding-reviews";

const base: ReviewState = { enabled: true, settings: null, review: null, reviewers: [], blocked_by: null, history: [] };
describe("review helpers", () => {
  it("steps without review keep the normal Complete button", () => {
    expect(reviewAction(null)).toBe("complete");
    expect(reviewAction({ ...base, enabled: false })).toBe("complete");
  });
  it("reviewed steps submit, wait, resubmit after send back, and finish after approval or skip", () => {
    expect(reviewAction(base)).toBe("submit");
    expect(reviewAction({ ...base, review: { id: "r", status: "pending", due_at: null, round: 1 } })).toBe("waiting");
    expect(reviewAction({ ...base, review: { id: "r", status: "changes_requested", due_at: null, round: 1 } })).toBe("submit");
    expect(reviewAction({ ...base, review: { id: "r", status: "approved", due_at: null, round: 1 } })).toBe("done");
    expect(reviewAction({ ...base, review: { id: "r", status: "skipped", due_at: null, round: 1 } })).toBe("done");
  });
  it("held-back steps name the step under review", () => {
    expect(waitingLabel("LOA review")).toBe("Waiting on review of LOA review");
    expect(waitingLabel(null)).toBeNull();
  });
  it("overdue job step reports count and surfaces errors", async () => {
    expect(await runReviewOverdueSweep({ rpc: async () => ({ data: 2, error: null }) })).toEqual({ overdue_alerts: 2 });
    await expect(runReviewOverdueSweep({ rpc: async () => ({ data: null, error: { message: "boom" } }) })).rejects.toThrow("boom");
  });
});
