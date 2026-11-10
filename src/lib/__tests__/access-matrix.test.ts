import { describe, expect, it } from "bun:test";
import { canOpenPath, viewOnlyPath } from "@/lib/route-access";
import { vendorPageAccess } from "@/lib/vendor-page-views";
import { capabilitiesFor, type AccessSeats, type AppRole, type Capability } from "@/lib/permissions";
import { canEditPlaybooks, canManagePlaybooks, canSavePlaybooks } from "@/lib/playbook-editing";

/**
 * THE ACCESS TABLE (fix batch 2, Nov 8 2026). Which role can open which page
 * and do its main action. Any permission change makes this fail; update it
 * only with written approval of the change.
 *
 * Account types are only the six that exist; the leadership and department
 * roles are team roles on top of them.
 */
const PROFILES: Record<string, { roles: AppRole[]; seats: AccessSeats }> = {
  PC: { roles: ["tech"], seats: {} },
  Supervisor: { roles: ["manager"], seats: { opsSupervisor: true } },
  DirOps: { roles: ["manager"], seats: { opsDirector: true } },
  DirOnb: { roles: ["onboarding"], seats: { onboardingDirector: true } },
  PM: { roles: ["onboarding"], seats: { projectManager: true } },
  Utilities: { roles: ["onboarding"], seats: { utilities: true } },
  Design: { roles: ["onboarding"], seats: {} },
  Finance: { roles: ["manager"], seats: { finance: true } },
  // A Supervisor who also holds Finance keeps the Supervisor's wider access (Build 5).
  SupFinance: { roles: ["manager"], seats: { opsSupervisor: true, finance: true } },
  Admin: { roles: ["admin"], seats: {} },
  Owner: { roles: ["owner"], seats: {} },
  Vendor: { roles: ["vendor"], seats: {} },
};

const PAGES = [
  "/dashboard", "/tickets", "/direct-bookings", "/direct-bookings/settings", "/vendors", "/work-orders",
  "/work-orders/manager", "/team", "/playbooks", "/ticket-checklists", "/oversight", "/supervisor-check",
  "/analytics", "/ops-analytics", "/finance", "/owner-library", "/owner-analytics", "/owner-programs",
  "/owner-report-wording", "/onboarding", "/properties", "/command-center", "/admin", "/owner", "/vendor",
  // Databases hub (Nov 8, register P3): every staff account opens it.
  "/databases",
  // Build 5 (Emily, Nov 7 to 9; register A1, A6, A10, A12, A16, A20, M6).
  "/team-queue", "/handoffs", "/help-tickets", "/audit", "/integrations", "/integrations/notion-import",
  "/imported-tickets", "/oversight-access-log", "/claims", "/recovery", "/property/home",
];

// Main actions, by the permission each screen and server check reads.
const ACTIONS: Capability[] = [
  "ops_user_invite", // add Operations users (Coordinator and Supervisor)
  "vendor_admin", // edit vendors
  "work_orders_internal", // work Work Orders
  "work_orders_view", // view Work Orders read only
  "finance_workspace", // work Finance
  "finance_view", // view Finance read only
  "owner_program_admin", // edit the Opportunity Library
  "owner_insight_view", // open the Opportunity Library and Participation insight
  "playbooks_edit", // no longer gates a screen: Ticket checklists and playbook editing read canEditPlaybooks (see PLAYBOOKS)
  "user_management",
  "team_schedule_view", // Team & Coverage Schedule
  "oversight",
  "analytics",
  "direct_bookings_work",
  "leads_work",
  "onboarding_user_invite", // A14: the Director of Onboarding adds Onboarding staff
  "team_queue", // A6
  "routines", // A5 Record routine work: Operations only
];

// Ticket checklists follow the same rule (register A15, Emily answer D2): the Director of
// Onboarding, Project Manager, Utilities and Design now open /ticket-checklists (view; the
// Director of Onboarding edits). Approved in writing; see playbook-roles-checklists.test.ts.
// Playbooks (Nov 8, 2026, Emily): coordinators view, Supervisor edit, Director of Operations
// edit, Director of Onboarding edit, Admin edit, Project Manager, Utilities, Design and
// Finance view. Edit = save, approve or publish a new version, archive and upload SOPs.
const PLAYBOOKS: Record<string, "edit" | "view" | "none"> = {
  PC: "view", Supervisor: "edit", DirOps: "edit", DirOnb: "edit", Admin: "edit",
  PM: "view", Utilities: "view", Design: "view", Finance: "view", SupFinance: "edit", Owner: "none", Vendor: "none",
};

const EXPECTED: Record<string, { pages: string[]; actions: string[]; savePlaybooks: boolean; approvePlaybooks: boolean }> = {
  PC: {
    pages: ["/dashboard", "/tickets", "/direct-bookings", "/vendors", "/work-orders", "/work-orders/manager", "/team", "/playbooks", "/ticket-checklists", "/properties", "/admin", "/databases", "/team-queue", "/help-tickets", "/claims", "/recovery", "/property/home"],
    actions: ["work_orders_internal", "team_schedule_view", "direct_bookings_work", "team_queue", "routines"],
    savePlaybooks: false,
    approvePlaybooks: false,
  },
  // Build 5 (Emily, Nov 9): no Onboarding workspace, only the read only Handoffs page.
  Supervisor: {
    pages: ["/dashboard", "/tickets", "/direct-bookings", "/direct-bookings/settings", "/vendors", "/work-orders", "/work-orders/manager", "/team", "/playbooks", "/ticket-checklists", "/oversight", "/supervisor-check", "/analytics", "/ops-analytics", "/owner-library", "/owner-analytics", "/owner-programs", "/owner-report-wording", "/properties", "/admin", "/owner", "/databases", "/team-queue", "/handoffs", "/help-tickets", "/claims", "/recovery", "/property/home"],
    actions: ["ops_user_invite", "vendor_admin", "work_orders_internal", "owner_program_admin", "owner_insight_view", "playbooks_edit", "user_management", "team_schedule_view", "oversight", "analytics", "direct_bookings_work", "leads_work", "team_queue", "routines"],
    savePlaybooks: true,
    approvePlaybooks: true,
  },
  DirOps: {
    pages: ["/dashboard", "/tickets", "/direct-bookings", "/direct-bookings/settings", "/vendors", "/work-orders", "/work-orders/manager", "/team", "/playbooks", "/ticket-checklists", "/oversight", "/supervisor-check", "/analytics", "/ops-analytics", "/finance", "/owner-library", "/owner-analytics", "/owner-programs", "/owner-report-wording", "/onboarding", "/properties", "/admin", "/owner", "/databases", "/team-queue", "/handoffs", "/help-tickets", "/claims", "/recovery", "/property/home"],
    actions: ["ops_user_invite", "vendor_admin", "work_orders_internal", "finance_workspace", "owner_program_admin", "owner_insight_view", "playbooks_edit", "user_management", "team_schedule_view", "oversight", "analytics", "direct_bookings_work", "leads_work", "team_queue", "routines"],
    savePlaybooks: true,
    approvePlaybooks: true,
  },
  // A12: onboarding roles open Properties. A14: the Director of Onboarding adds Onboarding staff.
  DirOnb: {
    pages: ["/vendors", "/work-orders", "/team", "/playbooks", "/ticket-checklists", "/finance", "/owner-library", "/owner-analytics", "/owner-programs", "/onboarding", "/properties", "/owner", "/databases", "/help-tickets", "/property/home"],
    actions: ["vendor_admin", "work_orders_view", "finance_view", "owner_insight_view", "playbooks_edit", "team_schedule_view", "onboarding_user_invite"],
    savePlaybooks: true,
    approvePlaybooks: true,
  },
  PM: {
    pages: ["/vendors", "/work-orders", "/team", "/playbooks", "/ticket-checklists", "/onboarding", "/properties", "/databases", "/help-tickets", "/property/home"],
    actions: ["vendor_admin", "work_orders_view", "team_schedule_view"],
    savePlaybooks: false,
    approvePlaybooks: false,
  },
  Utilities: {
    pages: ["/vendors", "/team", "/playbooks", "/ticket-checklists", "/onboarding", "/properties", "/databases", "/help-tickets", "/property/home"],
    actions: ["vendor_admin", "team_schedule_view"],
    savePlaybooks: false,
    approvePlaybooks: false,
  },
  Design: {
    pages: ["/team", "/playbooks", "/ticket-checklists", "/onboarding", "/properties", "/databases", "/help-tickets", "/property/home"],
    actions: ["team_schedule_view"],
    savePlaybooks: false,
    approvePlaybooks: false,
  },
  // Build 5, register A4 to A13, A18: Finance on a Supervisor type account. Old wrong access
  // removed: Schedule, Oversight, Supervisor check, Team Queue, Work order oversight, Active
  // Owner staff pages, vendor and playbook editing, adding users.
  Finance: {
    pages: ["/dashboard", "/tickets", "/direct-bookings", "/direct-bookings/settings", "/vendors", "/work-orders", "/playbooks", "/ticket-checklists", "/analytics", "/ops-analytics", "/finance", "/onboarding", "/properties", "/admin", "/databases", "/help-tickets", "/claims", "/recovery", "/property/home"],
    actions: ["work_orders_view", "finance_workspace", "analytics", "direct_bookings_work", "leads_work"],
    savePlaybooks: false,
    approvePlaybooks: false,
  },
  // The Supervisor role gives more than Finance on every page above, so the Supervisor's access stays.
  SupFinance: {
    pages: ["/dashboard", "/tickets", "/direct-bookings", "/direct-bookings/settings", "/vendors", "/work-orders", "/work-orders/manager", "/team", "/playbooks", "/ticket-checklists", "/oversight", "/supervisor-check", "/analytics", "/ops-analytics", "/finance", "/owner-library", "/owner-analytics", "/owner-programs", "/owner-report-wording", "/properties", "/admin", "/owner", "/databases", "/team-queue", "/handoffs", "/help-tickets", "/claims", "/recovery", "/property/home"],
    actions: ["ops_user_invite", "vendor_admin", "work_orders_internal", "finance_workspace", "owner_program_admin", "owner_insight_view", "playbooks_edit", "user_management", "team_schedule_view", "oversight", "analytics", "direct_bookings_work", "leads_work", "team_queue", "routines"],
    savePlaybooks: true,
    approvePlaybooks: true,
  },
  Admin: {
    pages: ["/dashboard", "/tickets", "/direct-bookings", "/direct-bookings/settings", "/vendors", "/work-orders", "/work-orders/manager", "/team", "/playbooks", "/ticket-checklists", "/oversight", "/supervisor-check", "/analytics", "/ops-analytics", "/finance", "/owner-library", "/owner-analytics", "/owner-programs", "/owner-report-wording", "/onboarding", "/properties", "/command-center", "/admin", "/owner", "/vendor", "/databases", "/team-queue", "/handoffs", "/help-tickets", "/audit", "/integrations", "/integrations/notion-import", "/imported-tickets", "/oversight-access-log", "/claims", "/recovery", "/property/home"],
    actions: ["vendor_admin", "work_orders_internal", "finance_workspace", "owner_program_admin", "owner_insight_view", "playbooks_edit", "user_management", "team_schedule_view", "oversight", "analytics", "direct_bookings_work", "leads_work", "team_queue", "routines"],
    savePlaybooks: true,
    approvePlaybooks: true,
  },
  Owner: {
    pages: ["/owner"],
    actions: [],
    savePlaybooks: false,
    approvePlaybooks: false,
  },
  Vendor: {
    pages: ["/vendor"],
    actions: [],
    savePlaybooks: false,
    approvePlaybooks: false,
  },
};

describe("access table: who opens which page and does its main action", () => {
  for (const [name, p] of Object.entries(PROFILES)) {
    it(name, () => {
      const caps = capabilitiesFor(p.roles, p.seats);
      expect({
        pages: PAGES.filter((path) => canOpenPath(path, p)),
        actions: ACTIONS.filter((a) => caps.has(a)) as string[],
        savePlaybooks: canSavePlaybooks(p.roles, p.seats),
        approvePlaybooks: canManagePlaybooks(p.roles, p.seats),
      }).toEqual(EXPECTED[name]!);
    });
  }

  for (const [name, p] of Object.entries(PROFILES)) {
    it(`${name}: playbooks ${PLAYBOOKS[name]}`, () => {
      const opens = canOpenPath("/playbooks", p);
      const edits = canEditPlaybooks(p.roles, p.seats);
      expect(opens ? (edits ? "edit" : "view") : "none").toBe(PLAYBOOKS[name]!);
      // One rule: whoever edits also saves, approves, archives and uploads.
      expect(canSavePlaybooks(p.roles, p.seats)).toBe(edits);
      expect(canManagePlaybooks(p.roles, p.seats)).toBe(edits);
    });
  }

  it("whoever covers the Operations Supervisor edits playbooks; a Supervisor account without the role only views", () => {
    expect(canEditPlaybooks(["tech"], { opsSupervisor: true })).toBe(true);
    expect(canEditPlaybooks(["manager"], {})).toBe(false);
  });

  // A9: which Vendors tabs each role sees, and whether they edit vendors or leadership fields.
  const VENDOR_TABS: Record<string, string> = {
    PC: "directory gold coverage review | view", Supervisor: "directory database gold coverage review | edit lead",
    DirOps: "directory database gold coverage review | edit lead", DirOnb: "directory database gold coverage review | edit",
    PM: "directory database gold coverage review | edit", Utilities: "directory database gold coverage review | edit",
    Design: " | view", Finance: "directory gold coverage review | view", SupFinance: "directory database gold coverage review | edit lead",
    Admin: "directory database gold coverage review | edit lead", Owner: " | view", Vendor: " | view",
  };
  for (const [name, p] of Object.entries(PROFILES)) {
    it(`${name}: Vendors tabs`, () => {
      const caps = capabilitiesFor(p.roles, p.seats);
      const a = vendorPageAccess((c) => caps.has(c));
      const mode = [a.edit ? "edit" : "", a.lead ? "lead" : ""].filter(Boolean).join(" ") || "view";
      expect(`${a.tabs.join(" ")} | ${mode}`).toBe(VENDOR_TABS[name]!);
    });
  }
  it("onboarding roles keep the Database tab, read only, in a read only view", () => {
    for (const name of ["DirOnb", "PM", "Utilities"]) {
      const caps = capabilitiesFor(PROFILES[name]!.roles, PROFILES[name]!.seats);
      const a = vendorPageAccess((c) => caps.has(c), true);
      expect(a.tabs).toContain("database");
      expect(a.tabs).toContain("review");
      expect(a.edit || a.lead).toBe(false);
    }
  });

  // A4, A8 to A12, A16: the pages Finance opens only to look. Finance pages (A18) and Direct Bookings (A11) stay editable.
  it("Finance looks without changing on Home, Work orders, Vendors, Claims and refunds, Properties and Onboarding", () => {
    const fin = PROFILES.Finance!;
    for (const path of ["/dashboard", "/work-orders", "/vendors", "/vendors/abc", "/claims", "/recovery", "/properties", "/property/home", "/onboarding"]) {
      expect(viewOnlyPath(path, fin)).toBe(true);
    }
    for (const path of ["/finance", "/direct-bookings", "/databases", "/help-tickets"]) expect(viewOnlyPath(path, fin)).toBe(false);
    for (const name of ["PC", "Supervisor", "SupFinance", "DirOps", "Admin", "DirOnb"]) {
      expect(viewOnlyPath("/properties", PROFILES[name]!)).toBe(false);
    }
  });

  it("lists every profile", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(Object.keys(PROFILES).sort());
    expect(Object.keys(PLAYBOOKS).sort()).toEqual(Object.keys(PROFILES).sort());
  });
});
