import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { canOpenPath } from "@/lib/route-access";
import { capabilitiesFor, type AccessSeats, type AppRole } from "@/lib/permissions";
import { departmentFor } from "@/lib/shell-nav";
import { vendorPageViews } from "@/lib/vendor-page-views";

/**
 * Nov 8, 2026 (Emily): on the Vendors page the Director of Onboarding, Project
 * Managers and Utilities do not see the Database tab, Needs Review or the
 * screening panel. They keep the vendor list, profiles and their edits.
 */
const person = (roles: AppRole[], seats: AccessSeats = {}) => ({ roles, seats });
const ONBOARDING_EDITORS = {
  "Director of Onboarding": person(["onboarding"], { onboardingDirector: true }),
  "Project Manager": person(["onboarding"], { projectManager: true }),
  Utilities: person(["onboarding"], { utilities: true }),
};
const LEADERSHIP = {
  "Operations Supervisor": person(["manager"], { opsSupervisor: true }),
  "Director of Operations": person(["manager"], { opsDirector: true }),
  Admin: person(["admin"]),
};
const PC = person(["tech"]);

const viewsFor = (p: { roles: AppRole[]; seats: AccessSeats }) => {
  const caps = capabilitiesFor(p.roles, p.seats);
  return vendorPageViews((c) => caps.has(c));
};
const vendorMenuFor = (p: { roles: AppRole[]; seats: AccessSeats }) => {
  const caps = capabilitiesFor(p.roles, p.seats);
  return (departmentFor("/vendors")?.links ?? []).filter((l) => !l.capability || caps.has(l.capability)).map((l) => l.label);
};

describe("Vendors page views", () => {
  for (const [name, p] of Object.entries(ONBOARDING_EDITORS)) {
    it(`${name}: no Database tab, Needs Review or screening panel; keeps the list, profiles and edits`, () => {
      expect(viewsFor(p)).toEqual({ database: false, review: false, screening: false });
      expect(vendorMenuFor(p)).toEqual(["Directory", "Gold Standard", "Market Coverage"]);
      expect(canOpenPath("/vendors", p)).toBe(true);
      expect(canOpenPath("/vendors/some-vendor", p)).toBe(true);
      expect(capabilitiesFor(p.roles, p.seats).has("vendor_admin")).toBe(true);
    });
  }

  for (const [name, p] of Object.entries(LEADERSHIP)) {
    it(`${name}: sees every view as before`, () => {
      expect(viewsFor(p)).toEqual({ database: true, review: true, screening: true });
      expect(vendorMenuFor(p)).toEqual(["Directory", "Database", "Gold Standard", "Market Coverage", "Needs Review"]);
    });
  }

  it("a coordinator keeps Needs Review and the read only screening panel, without the Database tab, as before", () => {
    expect(viewsFor(PC)).toEqual({ database: false, review: true, screening: true });
    expect(vendorMenuFor(PC)).toEqual(["Directory", "Gold Standard", "Market Coverage", "Needs Review"]);
  });

  it("the page, the profile and the vendor panel all read the same rule", () => {
    const page = readFileSync("src/routes/_authenticated/vendors.index.tsx", "utf8");
    const profile = readFileSync("src/routes/_authenticated/vendors.$vendorId.tsx", "utf8");
    const sheet = readFileSync("src/components/VendorOrgSheet.tsx", "utf8");
    expect(page).toContain("{views.review && <TabsTrigger value=\"review\">Needs Review</TabsTrigger>}");
    expect(page).toContain("canManage && views.database && <TabsTrigger value=\"database\">Database</TabsTrigger>");
    expect(profile).toContain("showScreening={showScreening}");
    expect(sheet).toContain("{showScreening && <TabsTrigger value=\"screening\">Screening</TabsTrigger>}");
  });
});
