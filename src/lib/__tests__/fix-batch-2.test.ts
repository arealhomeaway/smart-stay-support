import { describe, expect, it } from "bun:test";
import { canOpenPath } from "@/lib/route-access";
import { capabilitiesFor, seatsFromRoleCodes, type AccessSeats, type AppRole, type Capability } from "@/lib/permissions";
import { onboardingOnlyMenu, operationsMenu } from "@/lib/shell-nav";
import { canManagePlaybooks, canSavePlaybooks } from "@/lib/playbook-editing";
import { financeViewOnly } from "@/lib/finance-view";
import { releaseAfterLog, SHOW_NOT_LOGGED } from "@/lib/credentials.server";
import { assertCanInvite, inviteScope, OPS_INVITE_ROLES } from "@/lib/access.server";

process.env["CREDENTIAL_ENCRYPTION_KEY"] = "test-key-not-a-real-secret";

const person = (roles: AppRole[], seats: AccessSeats = {}) => ({ roles, seats });
const has = (roles: AppRole[], seats: AccessSeats, cap: Capability) => capabilitiesFor(roles, seats).has(cap);

const DIR_ONB = person(["onboarding"], { onboardingDirector: true });
const PM = person(["onboarding"], { projectManager: true });
const UTIL = person(["onboarding"], { utilities: true });
const DESIGN = person(["onboarding"]);
const PC = person(["tech"]);
const SUP = person(["manager"], { opsSupervisor: true });
const DIR_OPS = person(["manager"], { opsDirector: true });
const ADMIN = person(["admin"]);

describe("team roles that carry a permission", () => {
  it("reads Operations Supervisor, Project Manager and Utilities from role codes", () => {
    expect(seatsFromRoleCodes(["ops_supervisor"])).toEqual({ opsSupervisor: true, projectManager: false, utilities: false });
    expect(seatsFromRoleCodes(["onboarding_project_manager"]).projectManager).toBe(true);
    expect(seatsFromRoleCodes(["project_manager"]).projectManager).toBe(true);
    expect(seatsFromRoleCodes(["utilities"]).utilities).toBe(true);
    expect(seatsFromRoleCodes(["designer", "lead_designer", "onboarding_manager"])).toEqual({
      opsSupervisor: false, projectManager: false, utilities: false,
    });
  });
});

describe("1. Playbooks: the Operations Supervisor can save", () => {
  // Widened Nov 8, 2026 (Emily, docs/pending/playbooks-supervisor): the Supervisor
  // also approves, archives and uploads SOPs.
  it("saves drafts, and also approves and uploads SOPs", () => {
    expect(canSavePlaybooks(SUP.roles, SUP.seats)).toBe(true);
    expect(canManagePlaybooks(SUP.roles, SUP.seats)).toBe(true);
  });
  it("a manager account without the role still cannot save", () => {
    expect(canSavePlaybooks(["manager"], {})).toBe(false);
  });
});

describe("2. Add users", () => {
  it("Operations leadership may invite Coordinator and Supervisor only", () => {
    expect(OPS_INVITE_ROLES).toEqual(["tech", "manager"]);
    expect(has(SUP.roles, SUP.seats, "ops_user_invite")).toBe(true);
    expect(has(DIR_OPS.roles, DIR_OPS.seats, "ops_user_invite")).toBe(true);
    for (const p of [PC, DIR_ONB, PM, person(["manager"])]) expect(has(p.roles, p.seats, "ops_user_invite")).toBe(false);
  });

  type Rpc = Record<string, unknown>;
  const fake = (answers: Rpc) =>
    ({ rpc: async (fn: string, args: Record<string, unknown>) => ({ data: fn === "seat_holder_at" ? answers[fn] : Boolean(answers[fn] ?? (fn === "holds_functional_role" ? answers[`holds:${args["_code"]}`] : false)), error: null }) }) as never;

  it("the server lets Operations leadership create only Coordinator and Supervisor codes", async () => {
    const sup = fake({ "holds:ops_supervisor": true });
    expect(await inviteScope(sup, "u")).toBe("operations");
    expect(await assertCanInvite(sup, "u", "tech")).toBe("operations");
    expect(await assertCanInvite(sup, "u", "manager")).toBe("operations");
    for (const r of ["admin", "onboarding", "vendor", "owner"] as AppRole[])
      await expect(assertCanInvite(sup, "u", r)).rejects.toThrow("Property Coordinators and Supervisors");
    expect(await assertCanInvite(fake({ is_director: true }), "u", "manager")).toBe("operations");
    expect(await assertCanInvite(fake({ seat_holder_at: "u" }), "u", "tech")).toBe("operations");
  });
  it("Admin still invites every account type; others none", async () => {
    expect(await assertCanInvite(fake({ has_role: true }), "u", "vendor")).toBe("all");
    await expect(assertCanInvite(fake({}), "u", "tech")).rejects.toThrow("Only an admin");
  });
  // Build 5 (register A14): the Director of Onboarding adds people to their own department only.
  it("the Director of Onboarding invites Onboarding staff and nothing else", async () => {
    const dir = fake({ is_onboarding_director: true });
    expect(await inviteScope(dir, "u")).toBe("onboarding");
    expect(await assertCanInvite(dir, "u", "onboarding")).toBe("onboarding");
    for (const r of ["admin", "manager", "tech", "vendor", "owner"] as AppRole[])
      await expect(assertCanInvite(dir, "u", r)).rejects.toThrow("You can add Onboarding staff");
  });
});

describe("4. Vendors", () => {
  it("the Director of Onboarding, Project Manager and Utilities open and edit vendors; Design does not", () => {
    for (const p of [DIR_ONB, PM, UTIL]) {
      expect(canOpenPath("/vendors", p)).toBe(true);
      expect(has(p.roles, p.seats, "vendor_admin")).toBe(true);
    }
    expect(canOpenPath("/vendors", DESIGN)).toBe(false);
  });
  it("menus follow the same rule", () => {
    const menuFor = (p: { roles: AppRole[]; seats: AccessSeats }) =>
      onboardingOnlyMenu({
        can: (c) => has(p.roles, p.seats, c),
        canOpen: (path) => canOpenPath(path, p),
        flagEnabled: () => true,
      }).flatMap((g) => g.items.map((i) => i.to));
    expect(menuFor(DESIGN)).not.toContain("/vendors");
    expect(menuFor(DESIGN)).toContain("/playbooks");
    expect(menuFor(DESIGN)).toContain("/team");
    // Vendors left every left menu (Nov 9, register M1); onboarding roles open it from the Databases card.
    for (const p of [DIR_ONB, PM, UTIL]) {
      expect(menuFor(p)).not.toContain("/vendors");
      expect(menuFor(p)).toContain("/databases");
    }
    expect(menuFor(UTIL)).not.toContain("/work-orders");
    expect(menuFor(PM)).toContain("/work-orders");
    for (const path of ["/work-orders", "/finance", "/team", "/playbooks"]) expect(menuFor(DIR_ONB)).toContain(path);
    expect(menuFor(PM)).not.toContain("/finance");
  });
});

describe("5. Work Orders read only", () => {
  it("the Director of Onboarding and Project Manager open Work Orders without working them", () => {
    for (const p of [DIR_ONB, PM]) {
      expect(canOpenPath("/work-orders", p)).toBe(true);
      expect(has(p.roles, p.seats, "work_orders_internal")).toBe(false);
      expect(canOpenPath("/work-orders/manager", p)).toBe(false);
    }
    expect(canOpenPath("/work-orders", UTIL)).toBe(false);
  });
});

describe("6. Team & Coverage read only", () => {
  it("coordinators and onboarding accounts open it; only Operations leadership edits", () => {
    for (const p of [PC, DIR_ONB, PM, UTIL, DESIGN]) {
      expect(canOpenPath("/team", p)).toBe(true);
      expect(has(p.roles, p.seats, "user_management")).toBe(false);
    }
    expect(canOpenPath("/team", person(["owner"]))).toBe(false);
    expect(canOpenPath("/team", person(["vendor"]))).toBe(false);
  });
});

describe("7. Playbook library read only", () => {
  it("coordinators, Project Manager, Utilities and Design open it without editing", () => {
    for (const p of [PC, PM, UTIL, DESIGN]) {
      expect(canOpenPath("/playbooks", p)).toBe(true);
      expect(has(p.roles, p.seats, "playbooks_edit")).toBe(false);
      expect(canSavePlaybooks(p.roles, p.seats)).toBe(false);
    }
  });
  it("the Team group in the Operations menu shows Team & Coverage and Playbooks to coordinators", () => {
    const menu = operationsMenu({ can: (c) => has(PC.roles, PC.seats, c), canOpen: (path) => canOpenPath(path, PC) });
    expect(menu.find((g) => g.label === "Team")?.items.map((i) => i.label)).toEqual(["Team and Coverage", "Playbooks"]);
  });
});

describe("8. Finance read only", () => {
  it("the Director of Onboarding opens Finance read only; Finance staff keep working it", () => {
    const can = (p: { roles: AppRole[]; seats: AccessSeats }) => (c: Capability) => has(p.roles, p.seats, c);
    expect(canOpenPath("/finance", DIR_ONB)).toBe(true);
    expect(financeViewOnly(can(DIR_ONB))).toBe(true);
    expect(financeViewOnly(can(DIR_OPS))).toBe(false);
    expect(financeViewOnly(can(person(["manager"], { finance: true })))).toBe(false);
    expect(financeViewOnly(can(ADMIN))).toBe(false);
    expect(canOpenPath("/finance", PM)).toBe(false);
  });
});

describe("9. Opportunity Library and Participation insight", () => {
  it("the Director of Onboarding opens both but cannot edit the library or report wording", () => {
    expect(canOpenPath("/owner-library", DIR_ONB)).toBe(true);
    expect(canOpenPath("/owner-analytics", DIR_ONB)).toBe(true);
    expect(has(DIR_ONB.roles, DIR_ONB.seats, "owner_program_admin")).toBe(false);
    expect(canOpenPath("/owner-report-wording", DIR_ONB)).toBe(false);
    expect(canOpenPath("/owner-library", PM)).toBe(false);
  });
});

describe("11. Oversight, Supervisor check and Analytics by typed address", () => {
  it("refuses coordinators", () => {
    for (const path of ["/oversight", "/supervisor-check", "/analytics", "/ops-analytics"]) {
      expect(canOpenPath(path, PC)).toBe(false);
      expect(canOpenPath(path, SUP)).toBe(true);
    }
  });
});

describe("12. Door, lock and Wi-Fi codes", () => {
  it("refuses to show the code when the Show log fails", () => {
    expect(() => releaseAfterLog({ error: { message: "insert failed" } }, "1234")).toThrow(SHOW_NOT_LOGGED);
    expect(() => releaseAfterLog(null, "1234")).toThrow(SHOW_NOT_LOGGED);
    expect(releaseAfterLog({ error: null }, "1234")).toEqual({ value: "1234" });
  });
});
