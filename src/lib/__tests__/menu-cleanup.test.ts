/**
 * Left menu cleanup (Emily, Nov 8 2026). Checked through the real permission
 * model (ROLE_CAPABILITIES, canOpenPath) and the same menu and tab rules the
 * app shell renders from.
 */
import { describe, expect, it } from "bun:test";
import { can, type AppRole } from "../permissions";
import { canOpenPath } from "../route-access";
import {
  ANALYTICS_TARGETS,
  DEPARTMENTS,
  onboardingOnlyMenu,
  operationsMenu,
  pageTabGroupFor,
  visiblePageTabs,
  type MenuGroup,
  type NavAccess,
} from "../shell-nav";

const accessFor = (roles: AppRole[], flags: string[] = []): NavAccess => ({
  can: (c) => can(roles, c),
  canOpen: (p) => canOpenPath(p, { roles }),
  flagEnabled: (k) => flags.includes(k),
});
const shape = (groups: MenuGroup[]) =>
  groups.map((g) => [g.label, g.items.map((i) => i.label)] as const);
const allPaths = (groups: MenuGroup[]) => groups.flatMap((g) => g.items.map((i) => i.to));

describe("who sees what", () => {
  it("a Property Coordinator", () => {
    expect(shape(operationsMenu(accessFor(["tech"])))).toEqual([
      // Databases (Nov 8, register M1, M2); Guest Claims & Refunds hidden behind its switch.
      // Vendors left the menu (Nov 9, register M1): it opens from the Databases card.
      ["My day", ["Home", "Team Queue", "Direct Bookings", "Databases"]],
      // Fix batch 2 (Nov 8): coordinators open the Team group read only.
      ["Team", ["Team & Coverage", "Playbooks"]],
      ["Homes and owners", ["Properties"]],
    ]);
  });

  it("a Supervisor", () => {
    expect(shape(operationsMenu(accessFor(["manager"])))).toEqual([
      ["My day", ["Home", "Team Queue", "Direct Bookings", "Databases", "Oversight"]],
      ["Team", ["Team & Coverage", "Playbooks"]],
      ["Homes and owners", ["Properties", "Onboarding", "Active Owner"]],
      ["Insight", ["Analytics"]],
      // Admin as today: Supervisors open it at the first Admin page they can open.
      ["Admin", ["Admin"]],
    ]);
  });

  it("an Admin", () => {
    expect(shape(operationsMenu(accessFor(["admin"])))).toEqual([
      ["My day", ["Home", "Team Queue", "Direct Bookings", "Databases", "Oversight"]],
      ["Team", ["Team & Coverage", "Playbooks"]],
      ["Homes and owners", ["Properties", "Onboarding", "Active Owner"]],
      ["Insight", ["Analytics"]],
      ["Admin", ["Admin"]],
    ]);
  });

  it("an onboarding-only account keeps its menu as it was", () => {
    const menu = onboardingOnlyMenu(accessFor(["onboarding"]));
    expect(menu[0]?.label).toBe("Onboarding");
    expect(menu[0]?.items.map((i) => i.label)).toEqual([
      "Onboarding Home",
      "Properties",
      "My Tasks",
      "Owner Completions",
      "Team",
      "Handoff standard",
    ]);
    // Active Owner only for people who can open it (e.g. the Onboarding Director).
    expect(menu.map((g) => g.label)).not.toContain("Active Owner");
    const director = onboardingOnlyMenu({
      ...accessFor(["onboarding"]),
      can: (c) => can(["onboarding"], c, { onboardingDirector: true }),
    });
    expect(director.find((g) => g.label === "Active Owner")).toEqual({
      label: "Active Owner",
      items: [{ key: "owner-programs", label: "Active Owner", to: "/owner-programs" }],
    });
    // Fix batch 2 (Nov 8): the shared pages the Director of Onboarding may open follow Active Owner.
    // Databases (Nov 8, register P3): onboarding accounts get it in their menu too.
    expect(director.map((g) => g.label)).toEqual(["Onboarding", "Active Owner", "Team", "Databases"]);
  });
});

describe("removed from the menu, pages kept", () => {
  for (const roles of [["tech"], ["manager"], ["admin"]] as AppRole[][]) {
    it(`${roles[0]}: no My Work, Work Orders, Work Map, Program oversight, Homeowners or old booking pages`, () => {
      const paths = allPaths(operationsMenu(accessFor(roles)));
      for (const gone of ["/tickets", "/work-orders", "/map", "/owner-oversight", "/homeowners", "/leads", "/availability-finder", "/inquiry-sources"])
        expect(paths).not.toContain(gone);
      const labels = operationsMenu(accessFor(roles)).flatMap((g) => g.items.map((i) => i.label));
      for (const gone of ["My Work", "Work Orders", "Work Map", "Program Oversight", "Homeowners", "Lead Management", "Reports", "Bookings & Leads"])
        expect(labels).not.toContain(gone);
    });
  }

  it("the pages still open by direct link", () => {
    for (const p of ["/tickets", "/work-orders", "/map", "/owner-oversight", "/homeowners"])
      expect(canOpenPath(p, { roles: ["admin"] })).toBe(true);
  });

  it("Program oversight and Homeowners stay in the Active Owner menu", () => {
    const ao = DEPARTMENTS.find((d) => d.key === "active-owner")!.links;
    expect(ao.find((l) => l.to === "/owner-oversight")?.label).toBe("Program oversight");
    expect(ao.find((l) => l.to === "/homeowners")?.label).toBe("Homeowners");
  });

  it("Quarterly Reviews stays behind its own switch", () => {
    const off = allPaths(operationsMenu(accessFor(["admin"])));
    const on = allPaths(operationsMenu(accessFor(["admin"], ["quarterly_reviews"])));
    expect(off).not.toContain("/quarterly");
    expect(on).toContain("/quarterly");
  });
});

describe("Vendors and Work Orders", () => {
  it("Vendors is in no left menu (Nov 9, register M1), Work Orders hidden, and the page still opens by address", () => {
    for (const roles of [["tech"], ["manager"], ["admin"]] as AppRole[][]) {
      const menu = operationsMenu(accessFor(roles, ["work_orders_page", "quarterly_reviews", "claims_menu"]));
      expect(allPaths(menu)).not.toContain("/vendors");
      expect(menu.flatMap((g) => [g.label, ...g.items.map((i) => i.label)])).not.toContain("Vendors");
      const myDay = operationsMenu(accessFor(roles)).find((g) => g.label === "My day")!;
      expect(myDay.items.map((i) => i.to)).not.toContain("/work-orders");
      expect(canOpenPath("/vendors", { roles })).toBe(true);
    }
    expect(allPaths(operationsMenu(accessFor(["onboarding"])))).not.toContain("/vendors");
    const onb = onboardingOnlyMenu(accessFor(["onboarding"], ["work_orders_page"]));
    expect(allPaths(onb)).not.toContain("/vendors");
    expect(onb.map((g) => g.label)).not.toContain("Vendors");
  });

  it("the Work Orders tab is gone from the Vendors tab bar while the switch is off", () => {
    const group = pageTabGroupFor("/vendors")!;
    expect(visiblePageTabs(group, accessFor(["admin"])).map((t) => t.label)).toEqual(["Vendors"]);
    expect(visiblePageTabs(group, accessFor(["admin"], ["work_orders_page"])).map((t) => t.label)).toEqual([
      "Work Orders",
      "Vendors",
    ]);
  });

  it("turning work_orders_page on brings Work Orders back to the menu after Direct Bookings", () => {
    const myDay = operationsMenu(accessFor(["tech"], ["work_orders_page"])).find((g) => g.label === "My day")!;
    const labels = myDay.items.map((i) => i.label);
    expect(labels.indexOf("Work Orders")).toBe(labels.indexOf("Direct Bookings") + 1);
  });

  it("the Work Map tab on Properties waits behind work_map", () => {
    const group = pageTabGroupFor("/properties")!;
    expect(visiblePageTabs(group, accessFor(["admin"])).map((t) => t.label)).toEqual(["Properties"]);
    expect(visiblePageTabs(group, accessFor(["admin"], ["work_map"])).map((t) => t.label)).toEqual([
      "Properties",
      "Work Map",
    ]);
  });
});

describe("Analytics replaces Reports", () => {
  // The old rule: the Reports item opened the first of these the person could open.
  const oldReportsTarget = (roles: AppRole[]) =>
    [
      { to: "/analytics", capability: "analytics" },
      { to: "/owner-analytics", capability: "owner_programs" },
      { to: "/cleaner-hours", capability: "cleaner_hours" },
      { to: "/finance", capability: "finance_workspace" },
      { to: "/command-center", capability: "command_center" },
    ].find((c) => can(roles, c.capability as never) && canOpenPath(c.to, { roles }))?.to;

  it("opens the same place the Reports item did, for every role", () => {
    expect(ANALYTICS_TARGETS.map((t) => t.to)).toEqual([
      "/analytics",
      "/owner-analytics",
      "/cleaner-hours",
      "/finance",
      "/command-center",
    ]);
    for (const roles of [["tech"], ["manager"], ["admin"]] as AppRole[][]) {
      const item = operationsMenu(accessFor(roles)).find((g) => g.label === "Insight")?.items[0];
      expect(item?.to).toBe(oldReportsTarget(roles));
      if (item) expect(item.label).toBe("Analytics");
    }
    expect(operationsMenu(accessFor(["manager"])).find((g) => g.label === "Insight")?.items[0]?.to).toBe("/analytics");
  });

  it("keeps the same tabs", () => {
    expect(pageTabGroupFor("/analytics")?.tabs.map((t) => t.to)).toEqual(ANALYTICS_TARGETS.map((t) => t.to));
  });
});

describe("screen words", () => {
  it("menu labels never use banned words or names", () => {
    const labels = [
      ...operationsMenu(accessFor(["admin"], ["work_orders_page", "quarterly_reviews"])),
      ...onboardingOnlyMenu(accessFor(["onboarding"])),
    ].flatMap((g) => [g.label, ...g.items.map((i) => i.label)]);
    for (const l of labels) expect(l).not.toMatch(/\b(seat|hit|median)\b/i);
  });
});
