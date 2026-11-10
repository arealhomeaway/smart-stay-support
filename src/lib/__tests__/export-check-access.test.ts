import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { canOpenPath } from "@/lib/route-access";
import { capabilitiesFor, type AccessSeats, type AppRole } from "@/lib/permissions";
import { pageTabGroupFor, visiblePageTabs } from "@/lib/shell-nav";

/** Who opens the read only Export check (register N10; Emily, Nov 9). */
const PEOPLE: { who: string; roles: AppRole[]; seats: AccessSeats; opens: boolean }[] = [
  { who: "Admin", roles: ["admin"], seats: { opsDirector: true }, opens: true },
  { who: "Operations Supervisor", roles: ["manager"], seats: { opsSupervisor: true }, opens: true },
  { who: "Director of Operations", roles: ["manager"], seats: { opsDirector: true }, opens: true },
  { who: "Director of Onboarding", roles: ["onboarding"], seats: { onboardingDirector: true }, opens: true },
  { who: "Supervisor type account with no role", roles: ["manager"], seats: {}, opens: false },
  { who: "Finance lead", roles: ["manager"], seats: { finance: true }, opens: false },
  { who: "Property Coordinator", roles: ["tech"], seats: {}, opens: false },
  { who: "Project Manager", roles: ["onboarding"], seats: { projectManager: true }, opens: false },
];

describe("Export check access", () => {
  for (const p of PEOPLE) {
    it(`${p.who} ${p.opens ? "opens" : "cannot open"} the Export check, by address too`, () => {
      expect(canOpenPath("/export-check", { roles: p.roles, seats: p.seats })).toBe(p.opens);
      expect(capabilitiesFor(p.roles, p.seats).has("export_check")).toBe(p.opens);
    });
  }

  it("shows Export check in Admin tools for the Admin only", () => {
    const group = pageTabGroupFor("/export-check")!;
    const tabs = (roles: AppRole[], seats: AccessSeats) =>
      visiblePageTabs(group, {
        can: (c) => capabilitiesFor(roles, seats).has(c),
        canOpen: (path) => canOpenPath(path, { roles, seats }),
      }).map((t) => t.label);
    expect(tabs(["admin"], { opsDirector: true })).toContain("Export check");
    expect(tabs(["manager"], { opsSupervisor: true })).not.toContain("Export check");
  });

  it("Oversight links to it for the people who can open it, and the page has nothing to press", () => {
    const oversight = readFileSync("src/routes/_authenticated/oversight.tsx", "utf8");
    // Build 9 H1 (Emily, Nov 10): the link follows showExportCheckLink, which first requires canOpenPath("/export-check").
    expect(oversight).toContain("showExportCheckLink(access)");
    const page = readFileSync("src/routes/_authenticated/export-check.tsx", "utf8");
    expect(page).not.toMatch(/<Button|onClick|useMutation/);
  });

  it("the database rule names the same people", () => {
    const sql = readFileSync("docs/pending/nightly-export/01_nightly_export.sql", "utf8");
    const rule = sql.slice(sql.indexOf("FUNCTION public.can_view_export_check"), sql.indexOf("REVOKE ALL ON FUNCTION public.can_view_export_check"));
    for (const part of ["has_role(_user_id, 'admin')", "is_director(_user_id)", "is_onboarding_director(_user_id)", "holds_functional_role(_user_id, 'ops_supervisor')"])
      expect(rule).toContain(part);
  });
});
