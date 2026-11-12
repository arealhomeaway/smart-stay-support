// Staged file 06, screen side: Admin passes the Mark ready and step review checks, only once the database allows it.
import { describe, expect, it } from "bun:test";
import { canDecideStepReview, canMarkHomeReady } from "@/lib/home-context";

const ME = "me", DIR = "director", ADMIN = "admin";

describe("file 06 screens: Mark ready", () => {
  it("the Director of Onboarding still marks ready; others still do not", () => {
    expect(canMarkHomeReady(DIR, DIR)).toBe(true);
    expect(canMarkHomeReady(ME, DIR)).toBe(false);
    expect(canMarkHomeReady(ME, DIR, false, true)).toBe(false);
  });
  it("an Admin marks ready once file 06 is applied, not before", () => {
    expect(canMarkHomeReady(ADMIN, DIR, true, false)).toBe(false);
    expect(canMarkHomeReady(ADMIN, DIR, true, true)).toBe(true);
    expect(canMarkHomeReady(null, DIR, true, true)).toBe(false);
  });
});

describe("file 06 screens: step review", () => {
  const waiting = [{ user_id: "reviewer", decision: null }, { user_id: null, decision: null }];
  it("the assigned reviewer decides; another teammate does not", () => {
    expect(canDecideStepReview("reviewer", waiting)).toBe(true);
    expect(canDecideStepReview(ME, waiting)).toBe(false);
  });
  it("an Admin decides once file 06 is applied, and nothing is left to decide after every role has signed", () => {
    expect(canDecideStepReview(ADMIN, waiting, true, false)).toBe(false);
    expect(canDecideStepReview(ADMIN, waiting, true, true)).toBe(true);
    expect(canDecideStepReview(ADMIN, [{ user_id: "reviewer", decision: "approved" }], true, true)).toBe(false);
  });
});
