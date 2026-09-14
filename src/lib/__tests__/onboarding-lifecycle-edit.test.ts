import { describe, expect, it } from "bun:test";
import { lifecycleEditIssue } from "../onboarding-state";
import { setPropertyLifecycle } from "../onboarding.server";

describe("controlled lifecycle editing", () => {
  it("allows pause and resume before handoff", () => {
    expect(lifecycleEditIssue({ lifecycle_status: "onboarding" }, { status: "paused" })).toBe(null);
    expect(lifecycleEditIssue({ lifecycle_status: "paused" }, { status: "onboarding" })).toBe(null);
  });
  it("cannot erase review, corrections, acceptance, or project-start boundaries", () => {
    for (const lifecycle_status of [
      "handoff_requested",
      "handoff_corrections",
      "active_operations",
      "offboarded",
      "not_onboarded",
      null,
    ])
      expect(Boolean(lifecycleEditIssue({ lifecycle_status }, { status: "onboarding" }))).toBe(
        true,
      );
    expect(
      Boolean(
        lifecycleEditIssue(
          { lifecycle_status: "paused", handoff_accepted_at: "2026-09-14" },
          { status: "onboarding" },
        ),
      ),
    ).toBe(true);
  });
  it("requires reviewed stage progression", () => {
    expect(
      lifecycleEditIssue(
        { lifecycle_status: "onboarding", onboarding_stage: "setup" },
        { status: "onboarding", stage: "final_prep" },
      ),
    ).toContain("stage capture");
  });
  it("rejects a direct reset of handoff review without writing", async () => {
    let writes = 0;
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({
        data: {
          lifecycle_status: "handoff_requested",
          onboarding_stage: "pm_readiness",
          handoff_accepted_at: null,
        },
        error: null,
      }),
      update: () => {
        writes++;
        return query;
      },
    };
    let message = "";
    try {
      await setPropertyLifecycle(
        { rpc: async () => ({ data: true, error: null }), from: () => query } as never,
        "staff",
        { propertyId: "property", status: "paused", reason: "QA attempt" },
      );
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("handoff review chain");
    expect(writes).toBe(0);
  });
});
