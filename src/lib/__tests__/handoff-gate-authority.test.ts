import { describe, expect, it } from "bun:test";
import {
  HANDOFF_GATE_STEPS,
  gateReviewAuthority,
  handoffGateChain,
  nextHandoffGate,
  type GateAuthorityInput,
} from "@/lib/handoff-gate-authority";

const base: GateAuthorityInput = {
  gateStep: "kati_review",
  viewerId: "kati",
  holdsSeat: true,
  requestedBy: "pm",
  projectManagerId: "pm",
  priorReviews: [],
};

const reason = (r: ReturnType<typeof gateReviewAuthority>) => (r.ok ? "" : r.reason);

describe("the four-gate handoff sequence", () => {
  it("runs Kati, Micah, Operations acceptance, then Live", () => {
    expect(HANDOFF_GATE_STEPS).toEqual([
      "kati_review",
      "micah_review",
      "operations_acceptance",
      "live_confirmation",
    ]);
    expect(nextHandoffGate("kati_review")).toBe("micah_review");
    expect(nextHandoffGate("micah_review")).toBe("operations_acceptance");
    expect(nextHandoffGate("operations_acceptance")).toBe("live_confirmation");
    expect(nextHandoffGate("live_confirmation")).toBe("complete");
  });

  it("lets the named role pass the gate it holds", () => {
    expect(gateReviewAuthority(base).ok).toBe(true);
  });

  it("blocks the project manager who submitted the handoff", () => {
    expect(reason(gateReviewAuthority({ ...base, viewerId: "pm" }))).toContain(
      "cannot approve their own handoff",
    );
  });

  it("blocks the home's project manager even when they did not submit it", () => {
    expect(
      reason(gateReviewAuthority({ ...base, viewerId: "pm2", requestedBy: "someone_else", projectManagerId: "pm2" })),
    ).toContain("project manager on this home");
  });

  it("refuses a gate the person does not hold", () => {
    expect(reason(gateReviewAuthority({ ...base, viewerId: "micah", holdsSeat: false }))).toContain(
      "Director of Onboarding",
    );
  });

  it("refuses to take a gate out of order", () => {
    expect(
      reason(gateReviewAuthority({ ...base, step: "live_confirmation" })),
    ).toContain("Gates are passed in order");
  });

  it("stops one person standing in for two different review roles", () => {
    const r = gateReviewAuthority({
      ...base,
      gateStep: "micah_review",
      viewerId: "kati",
      priorReviews: [{ step: "kati_review", decision: "accepted", reviewerId: "kati" }],
    });
    expect(reason(r)).toContain("Each review role signs for itself");
  });

  it("allows the Operations Supervisor to accept and then confirm Live", () => {
    const r = gateReviewAuthority({
      ...base,
      gateStep: "live_confirmation",
      viewerId: "james",
      priorReviews: [
        { step: "kati_review", decision: "accepted", reviewerId: "kati" },
        { step: "micah_review", decision: "accepted", reviewerId: "micah" },
        { step: "operations_acceptance", decision: "accepted", reviewerId: "james" },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it("shows where the handoff stands", () => {
    const chain = handoffGateChain("micah_review", false);
    expect(chain.map((g) => g.state)).toEqual(["done", "current", "upcoming", "upcoming"]);
    expect(handoffGateChain("live_confirmation", true).every((g) => g.state === "done")).toBe(true);
  });
});
