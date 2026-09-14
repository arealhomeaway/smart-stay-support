import { describe, expect, it } from "bun:test";
import { authorityTier, authorityLadder, readAuthorityPolicy } from "../maintenance-policy";
import { tierFor } from "../onboarding-finance";
import { setOnboardingPolicy } from "../onboarding-policy.server";

describe("onboarding authority configuration", () => {
  it("preserves the approved baseline for existing Operations callers", () => {
    expect(authorityTier(199)).toBe("proceed");
    expect(authorityTier(200)).toBe("supervisor");
    expect(authorityTier(350)).toBe("supervisor");
    expect(authorityTier(351)).toBe("owner");
    expect(readAuthorityPolicy(null).ownerApprovalThreshold).toBe(350);
  });
  it("uses an explicit policy for new requests and matching guidance", () => {
    const policy = readAuthorityPolicy({
      version: "QA approved test policy",
      supervisorApprovalThreshold: 100,
      ownerApprovalThreshold: 250,
    });
    expect(authorityTier(100, { policy })).toBe("supervisor");
    expect(authorityTier(250, { policy })).toBe("supervisor");
    expect(authorityTier(251, { policy })).toBe("owner");
    expect(authorityLadder(policy)[2]).toContain("$250");
    expect(authorityTier(999, { policy, emergency: true })).toBe("emergency");
  });
  it("retains a request's recorded tier when the current policy would differ", () => {
    expect(tierFor({ estimate_amount: 300, emergency: false, authority_tier: "owner" })).toBe(
      "owner",
    );
  });
  it("rejects malformed and reversed thresholds instead of allowing spending", () => {
    expect(() =>
      readAuthorityPolicy({
        version: "QA",
        supervisorApprovalThreshold: 400,
        ownerApprovalThreshold: 100,
      }),
    ).toThrow();
    expect(() =>
      readAuthorityPolicy({
        version: "QA",
        supervisorApprovalThreshold: NaN,
        ownerApprovalThreshold: 500,
      }),
    ).toThrow();
    expect(() => readAuthorityPolicy({})).toThrow();
  });
  it("rejects non-admin updates before any settings write", async () => {
    let writes = 0;
    const db = {
      rpc: async () => ({ data: false, error: null }),
      from: () => {
        writes++;
        throw new Error("Unexpected write");
      },
    };
    let message = "";
    try {
      await setOnboardingPolicy(db as never, "staff", {
        version: "QA",
        supervisorApprovalThreshold: 100,
        ownerApprovalThreshold: 250,
        reason: "QA only",
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("Only an administrator");
    expect(writes).toBe(0);
  });
});
