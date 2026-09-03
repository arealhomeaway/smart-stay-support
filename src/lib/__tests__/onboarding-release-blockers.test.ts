import { describe, expect, it } from "bun:test";
import { deriveLifecycle, handoffReadiness } from "@/lib/onboarding-state";
import { applyTestDataFilter, countTestRecords, isTestRecord } from "@/lib/test-data";

const property = (over: Record<string, unknown> = {}) =>
  ({
    id: "p1",
    name: "Test home",
    lifecycle_status: "not_onboarded",
    handoff_accepted_at: null,
    ...over,
  }) as never;

const base = (over: Record<string, unknown> = {}) =>
  ({ property: property(), project: null, tasks: [], handoff: null, ...over }) as never;

describe("a home with no Onboarding Project is never Live", () => {
  it("reads as not started", () => {
    const life = deriveLifecycle(base());
    expect(life.notStarted).toBe(true);
    expect(life.live).toBe(false);
    expect(life.accepted).toBe(false);
  });

  it("stays not started when the lifecycle value is missing entirely", () => {
    const life = deriveLifecycle(base({ property: property({ lifecycle_status: null }) }));
    expect(life.notStarted).toBe(true);
  });

  it("keeps homes accepted before Resolve reading as accepted", () => {
    const life = deriveLifecycle(
      base({
        property: property({
          lifecycle_status: "active_operations",
          handoff_accepted_at: "2024-01-01T00:00:00Z",
        }),
      }),
    );
    expect(life.notStarted).toBe(false);
    expect(life.accepted).toBe(true);
  });
});

describe("handoff hard blockers cannot be carried over", () => {
  it("blocks handoff outright when onboarding was never started", () => {
    const r = handoffReadiness(base(), []);
    expect(r.ready).toBe(false);
    expect(r.blocked).toBe(true);
    expect(r.hardReasons.some((x) => x.key === "not_started")).toBe(true);
  });
});

describe("one shared definition of test data", () => {
  it("recognises the marked QA homes", () => {
    expect(isTestRecord({ name: "ZZ QA AO — Willow (test, do not use)" })).toBe(true);
    expect(isTestRecord({ name: "Cypress Lane Retreat", is_demo: true })).toBe(true);
    expect(isTestRecord({ name: "1039 Swinton Way" })).toBe(false);
  });

  it("hides test rows by default and reveals them on request", () => {
    const rows = [{ name: "Real home" }, { name: "ZZ QA — Birch" }];
    expect(applyTestDataFilter(rows, false, (r) => r)).toHaveLength(1);
    expect(applyTestDataFilter(rows, true, (r) => r)).toHaveLength(2);
    expect(countTestRecords(rows, (r) => r)).toBe(1);
  });
});
