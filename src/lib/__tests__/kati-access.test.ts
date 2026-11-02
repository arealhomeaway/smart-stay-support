import { describe, expect, it } from "bun:test";
import { canOpenPath } from "@/lib/route-access";
import { can } from "@/lib/permissions";
import { canEditCardLibrary, canToggleHomeAutomation, canViewContributions } from "@/lib/ao-ui";
import { DEPARTMENTS } from "@/lib/shell-nav";

// Kati Hand's live combination: permission role "onboarding" plus the
// Onboarding Director seat (no admin, manager or tech role).
const kati = { roles: ["onboarding" as const], seats: { onboardingDirector: true } };
const pc = { roles: ["tech" as const], seats: {} };
const homeowner = { roles: ["owner" as const], seats: {} };
const admin = { roles: ["admin" as const], seats: {} };

const OD_PAGES = ["/owner-card-library", "/owner-contributions", "/owner-handoff-plan", "/active-owner-followup", "/homeowners", "/owner-programs"];

const navFor = (ctx: typeof kati | typeof pc | typeof admin) =>
  DEPARTMENTS.find((d) => d.key === "active-owner")!.links
    .filter((l) => !l.capability || can(ctx.roles, l.capability, ctx.seats))
    .map((l) => l.to);

describe("Onboarding Director Active Owner access", () => {
  for (const p of OD_PAGES) it("Kati can open ${p} and sees it in the menu".replace("${p}", p), () => {
    expect(canOpenPath(p, kati)).toBe(true);
    expect(navFor(kati)).toContain(p);
  });
  it("Report wording stays Admin-only for Kati", () => {
    expect(canOpenPath("/owner-report-wording", kati)).toBe(false);
    expect(navFor(kati)).not.toContain("/owner-report-wording");
  });
  it("Kati can edit cards, switch homes and view contributions", () => {
    const who = { isAdmin: false, isOnboardingDirector: true };
    expect(canEditCardLibrary(who)).toBe(true);
    expect(canToggleHomeAutomation(who)).toBe(true);
    expect(canViewContributions(who)).toBe(true);
  });
  for (const p of [...OD_PAGES, "/owner-report-wording"]) it("a PC and a homeowner cannot open ${p}".replace("${p}", p), () => {
    expect(canOpenPath(p, pc)).toBe(false);
    expect(canOpenPath(p, homeowner)).toBe(false);
  });
  it("PC cannot edit cards or switch homes", () => {
    const who = { isAdmin: false, isOnboardingDirector: false, isStaff: true };
    expect(canEditCardLibrary(who)).toBe(false);
    expect(canToggleHomeAutomation(who)).toBe(false);
    expect(canViewContributions(who)).toBe(false);
  });
  for (const p of [...OD_PAGES, "/owner-report-wording"]) it("Admin still opens ${p}".replace("${p}", p), () => {
    expect(canOpenPath(p, admin)).toBe(true);
  });
});
