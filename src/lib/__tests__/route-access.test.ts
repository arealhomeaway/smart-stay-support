import { describe, expect, it } from "bun:test";
import { canOpenPath, homePathFor, isOnboardingOnly } from "../route-access";
import { can } from "../permissions";

const kati = { roles: ["onboarding" as const], seats: { onboardingDirector: true } };
const victor = { roles: ["owner" as const] };
const admin = { roles: ["admin" as const] };

describe("route authorization", () => {
  it("Onboarding Director works all of Onboarding without Operations", () => {
    for (const p of ["/onboarding", "/onboarding/abc", "/onboarding/team", "/onboarding/templates", "/onboarding/my-work"])
      expect(canOpenPath(p, kati)).toBe(true);
    for (const p of ["/dashboard", "/oversight", "/team", "/team-queue", "/tickets", "/tickets/new", "/vendors", "/owner-library", "/owner-analytics", "/command-center", "/audit", "/oversight-access-log"])
      expect(canOpenPath(p, kati)).toBe(false);
    for (const p of ["/owner-programs", "/owner-oversight", "/homeowners"])
      expect(canOpenPath(p, kati)).toBe(true);
    expect(homePathFor(kati)).toBe("/onboarding");
    expect(isOnboardingOnly(kati)).toBe(true);
    expect(can(kati.roles, "onboarding_templates", kati.seats)).toBe(true);
    expect(can(kati.roles, "onboarding_templates")).toBe(false);
  });
  it("Active Owner stays inside the owner portal", () => {
    expect(canOpenPath("/owner", victor)).toBe(true);
    for (const p of ["/onboarding", "/dashboard", "/owner-library", "/owner-programs", "/team"])
      expect(canOpenPath(p, victor)).toBe(false);
    expect(homePathFor(victor)).toBe("/owner");
  });
  it("admins keep cross-portal access", () => {
    for (const p of ["/onboarding", "/dashboard", "/owner-library", "/command-center", "/team"])
      expect(canOpenPath(p, admin)).toBe(true);
  });
});
