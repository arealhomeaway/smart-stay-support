import { describe, expect, it } from "bun:test";
import { canOpenPath } from "@/lib/route-access";
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
  Admin: { roles: ["admin"], seats: {} },
  Owner: { roles: ["owner"], seats: {} },
  Vendor: { roles: ["vendor"], seats: {} },
};

const PAGES = [
  "/dashboard", "/tickets", "/direct-bookings", "/direct-bookings/settings", "/vendors", "/work-orders",
  "/work-orders/manager", "/team", "/playbooks", "/ticket-checklists", "/oversight", "/supervisor-check",
  "/analytics", "/ops-analytics", "/finance", "/owner-library", "/owner-analytics", "/owner-programs",
  "/owner-report-wording", "/onboarding", "/properties", "/command-center", "/admin", "/owner", "/vendor",
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
];

// Ticket checklists follow the same rule (register A15, Emily answer D2): the Director of
// Onboarding, Project Manager, Utilities and Design now open /ticket-checklists (view; the
// Director of Onboarding edits). Approved in writing; see playbook-roles-checklists.test.ts.
// Playbooks (Nov 8, 2026, Emily): coordinators view, Supervisor edit, Director of Operations
// edit, Director of Onboarding edit, Admin edit, Project Manager, Utilities, Design and
// Finance view. Edit = save, approve or publish a new version, archive and upload SOPs.
const PLAYBOOKS: Record<string, "edit" | "view" | "none"> = {
  PC: "view", Supervisor: "edit", DirOps: "edit", DirOnb: "edit", Admin: "edit",
  PM: "view", Utilities: "view", Design: "view", Finance: "view", Owner: "none", Vendor: "none",
};

const EXPECTED: Record<string, { pages: string[]; actions: string[]; savePlaybooks: boolean; approvePlaybooks: boolean }> = {
  PC: {
    pages: ["/dashboard", "/tickets", "/direct-bookings", "/vendors", "/work-orders", "/work-orders/manager", "/team", "/playbooks", "/ticket-checklists", "/properties", "/admin"],
    actions: ["work_orders_internal", "team_schedule_view", "direct_bookings_work"],
    savePlaybooks: false,
    approvePlaybooks: false,
  },
  Supervisor: {
    pages: ["/dashboard", "/tickets", "/direct-bookings", "/direct-bookings/settings", "/vendors", "/work-orders", "/work-orders/manager", "/team", "/playbooks", "/ticket-checklists", "/oversight", "/supervisor-check", "/analytics", "/ops-analytics", "/owner-library", "/owner-analytics", "/owner-programs", "/owner-report-wording", "/onboarding", "/properties", "/admin", "/owner"],
    actions: ["ops_user_invite", "vendor_admin", "work_orders_internal", "owner_program_admin", "owner_insight_view", "playbooks_edit", "user_management", "team_schedule_view", "oversight", "analytics", "direct_bookings_work", "leads_work"],
    savePlaybooks: true,
    approvePlaybooks: true,
  },
  DirOps: {
    pages: ["/dashboard", "/tickets", "/direct-bookings", "/direct-bookings/settings", "/vendors", "/work-orders", "/work-orders/manager", "/team", "/playbooks", "/ticket-checklists", "/oversight", "/supervisor-check", "/analytics", "/ops-analytics", "/finance", "/owner-library", "/owner-analytics", "/owner-programs", "/owner-report-wording", "/onboarding", "/properties", "/admin", "/owner"],
    actions: ["ops_user_invite", "vendor_admin", "work_orders_internal", "finance_workspace", "owner_program_admin", "owner_insight_view", "playbooks_edit", "user_management", "team_schedule_view", "oversight", "analytics", "direct_bookings_work", "leads_work"],
    savePlaybooks: true,
    approvePlaybooks: true,
  },
  DirOnb: {
    pages: ["/vendors", "/work-orders", "/team", "/playbooks", "/ticket-checklists", "/finance", "/owner-library", "/owner-analytics", "/owner-programs", "/onboarding", "/owner"],
    actions: ["vendor_admin", "work_orders_view", "finance_view", "owner_insight_view", "playbooks_edit", "team_schedule_view"],
    savePlaybooks: true,
    approvePlaybooks: true,
  },
  PM: {
    pages: ["/vendors", "/work-orders", "/team", "/playbooks", "/ticket-checklists", "/onboarding"],
    actions: ["vendor_admin", "work_orders_view", "team_schedule_view"],
    savePlaybooks: false,
    approvePlaybooks: false,
  },
  Utilities: {
    pages: ["/vendors", "/team", "/playbooks", "/ticket-checklists", "/onboarding"],
    actions: ["vendor_admin", "team_schedule_view"],
    savePlaybooks: false,
    approvePlaybooks: false,
  },
  Design: {
    pages: ["/team", "/playbooks", "/ticket-checklists", "/onboarding"],
    actions: ["team_schedule_view"],
    savePlaybooks: false,
    approvePlaybooks: false,
  },
  Finance: {
    pages: ["/dashboard", "/tickets", "/direct-bookings", "/direct-bookings/settings", "/vendors", "/work-orders", "/work-orders/manager", "/team", "/playbooks", "/ticket-checklists", "/oversight", "/supervisor-check", "/analytics", "/ops-analytics", "/finance", "/owner-library", "/owner-analytics", "/owner-programs", "/owner-report-wording", "/onboarding", "/properties", "/admin", "/owner"],
    actions: ["vendor_admin", "work_orders_internal", "finance_workspace", "owner_program_admin", "owner_insight_view", "playbooks_edit", "user_management", "team_schedule_view", "oversight", "analytics", "direct_bookings_work", "leads_work"],
    savePlaybooks: false,
    approvePlaybooks: false,
  },
  Admin: {
    pages: ["/dashboard", "/tickets", "/direct-bookings", "/direct-bookings/settings", "/vendors", "/work-orders", "/work-orders/manager", "/team", "/playbooks", "/ticket-checklists", "/oversight", "/supervisor-check", "/analytics", "/ops-analytics", "/finance", "/owner-library", "/owner-analytics", "/owner-programs", "/owner-report-wording", "/onboarding", "/properties", "/command-center", "/admin", "/owner", "/vendor"],
    actions: ["vendor_admin", "work_orders_internal", "finance_workspace", "owner_program_admin", "owner_insight_view", "playbooks_edit", "user_management", "team_schedule_view", "oversight", "analytics", "direct_bookings_work", "leads_work"],
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

  it("lists every profile", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(Object.keys(PROFILES).sort());
    expect(Object.keys(PLAYBOOKS).sort()).toEqual(Object.keys(PROFILES).sort());
  });
});
