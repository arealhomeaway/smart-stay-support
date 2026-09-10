import { describe, expect, it } from "bun:test";
import { handoffAcceptPatch, handoffSelfAcceptCheck } from "../handoff-accept";

describe("handoffSelfAcceptCheck — a handoff's requester cannot also accept it", () => {
  it("refuses when the current user is who the handoff was requested from", () => {
    const result = handoffSelfAcceptCheck("user-1", "user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("someone else");
  });

  it("allows a different user to accept", () => {
    expect(handoffSelfAcceptCheck("user-2", "user-1")).toEqual({ ok: true });
  });

  it("allows acceptance when no requester is recorded", () => {
    expect(handoffSelfAcceptCheck("user-2", null)).toEqual({ ok: true });
  });

  it("allows acceptance when the current user is not yet known", () => {
    expect(handoffSelfAcceptCheck(undefined, "user-1")).toEqual({ ok: true });
  });
});

describe("handoffAcceptPatch — acceptance never touches to_user", () => {
  it("writes only status, responded_at, accepted_by and accepted_at", () => {
    const now = "2026-09-06T12:00:00.000Z";
    const patch = handoffAcceptPatch("user-2", now);
    expect(patch).toEqual({
      status: "accepted",
      responded_at: now,
      accepted_by: "user-2",
      accepted_at: now,
    });
    expect(Object.keys(patch)).not.toContain("to_user");
    expect(Object.keys(patch)).not.toContain("from_user");
  });

  it("records a null acceptor rather than guessing one", () => {
    const now = "2026-09-06T12:00:00.000Z";
    expect(handoffAcceptPatch(null, now).accepted_by).toBeNull();
  });
});
