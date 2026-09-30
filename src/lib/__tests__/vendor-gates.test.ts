import { describe, expect, it } from "bun:test";
import { allowedResults, gatekeeperReadiness, type GatekeeperLine } from "@/lib/vendors";

const line = (code: string, result: GatekeeperLine["result"], extra: Partial<GatekeeperLine> = {}): GatekeeperLine => ({
  requirementId: code, code, label: code, detail: null, level: "blocking", result,
  note: null, verifiedAt: null, expiresOn: null, ...extra,
});

describe("Must Pass gates", () => {
  it("mandatory gates never offer Not Applicable or Equivalent", () => {
    expect(allowedResults({})).not.toContain("not_applicable");
    expect(allowedResults({})).not.toContain("equivalent_verified");
  });
  it("licenses/subcontractors offer N/A; references offer Equivalent", () => {
    expect(allowedResults({ allowsNotApplicable: true })).toContain("not_applicable");
    expect(allowedResults({ allowsEquivalent: true })).toContain("equivalent_verified");
  });
  it("N/A on a mandatory gate does not pass", () => {
    expect(gatekeeperReadiness([line("w9", "not_applicable")]).clear).toBe(false);
  });
  it("permitted exceptions pass", () => {
    const r = gatekeeperReadiness([
      line("licenses", "not_applicable", { allowsNotApplicable: true }),
      line("references", "equivalent_verified", { allowsEquivalent: true }),
      line("w9", "verified_meets"),
    ]);
    expect(r.clear).toBe(true);
  });
  it("expired insurance fails; unverified fails", () => {
    expect(gatekeeperReadiness([line("insurance", "verified_meets", { expiresOn: "2020-01-01" })]).clear).toBe(false);
    expect(gatekeeperReadiness([line("x", "not_verified")]).clear).toBe(false);
  });
});

describe("gate evidence and expiry", () => {
  it("insurance/licence without an expiration date does not pass", async () => {
    const { gateState } = await import("@/lib/vendors");
    const l = line("insurance", "verified_meets", { expiryRequired: true });
    expect(gatekeeperReadiness([l]).clear).toBe(false);
    expect(gateState(l)).toBe("missing_expiry");
  });
  it("expired insurance automatically leaves Passed", async () => {
    const { gateState } = await import("@/lib/vendors");
    const l = line("insurance", "verified_meets", { expiryRequired: true, expiresOn: "2026-01-01" });
    expect(gateState(l, new Date("2026-06-01"))).toBe("expired");
    expect(gateState(l, new Date("2025-06-01"))).toBe("passed");
  });
});
