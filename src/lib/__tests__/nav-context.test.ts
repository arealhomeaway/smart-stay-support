import { describe, expect, it } from "bun:test";
import { resolveOrigin } from "../nav-context";

describe("resolveOrigin — the Onboarding Project workspace has a natural parent", () => {
  it("falls back to the Director hub when no remembered workspace token is given", () => {
    const origin = resolveOrigin(undefined, "onboarding");
    expect(origin.label).toBe("Director hub");
    expect(origin.href).toBe("/onboarding");
  });

  it("falls back to the Director hub for an unknown/expired token too", () => {
    const origin = resolveOrigin("not-a-real-token", "onboarding");
    expect(origin.label).toBe("Director hub");
    expect(origin.href).toBe("/onboarding");
  });
});
