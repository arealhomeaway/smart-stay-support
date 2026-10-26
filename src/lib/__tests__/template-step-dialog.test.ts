import { describe, expect, it } from "bun:test";
import { completeOpportunity, handoffLocked } from "../template-step-dialog";

describe("Help Ticket #57 — template step window", () => {
  it("opens a step whose saved Opportunity has only title/what/why/how and saves it complete", () => {
    const stored = { title: "Join the readiness call", what: "W", why: "Y", how: "H" };
    const opp = completeOpportunity(stored, "Hold the Owner Investment Readiness Call");
    // The window reads resources.join — must not throw.
    expect(() => opp.resources.join("\n")).not.toThrow();
    expect(opp).toEqual({
      title: "Join the readiness call", what: "W", why: "Y", how: "H",
      resources: [], ways_to_document: "", suggested_minutes: null,
    });
  });

  it("keeps complete Opportunity content unchanged", () => {
    const full = { title: "T t", what: "a", why: "b", how: "c", resources: ["https://x"], ways_to_document: "d", suggested_minutes: 30 };
    expect(completeOpportunity(full, "x")).toEqual(full);
  });

  it("locks Blocks handoff for an Active Owner step and a homeowner-approval step only", () => {
    expect(handoffLocked({ tags: ["active_owner"] })).toBe(true);
    expect(handoffLocked({ requires_owner_approval: true, tags: [] })).toBe(true);
    expect(handoffLocked({ requires_owner_approval: false, tags: ["design"] })).toBe(false);
  });
});
