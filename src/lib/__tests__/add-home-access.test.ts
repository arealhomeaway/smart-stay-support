import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { ADD_HOME_DENIED, assertCanAddHome } from "@/lib/property-intake.server";

// Register A12 and the cleanup list (Emily, Nov 9): only Onboarding roles and
// Admin can add a home, on the server as well as on both screens.

function client(roles: string[], director = false) {
  return {
    from: (table: string) => {
      if (table !== "user_roles") throw new Error(`unexpected table ${table}`);
      return { select: () => ({ eq: async () => ({ data: roles.map((role) => ({ role })), error: null }) }) };
    },
    rpc: async (name: string) => {
      if (name !== "is_onboarding_director") throw new Error(`unexpected rpc ${name}`);
      return { data: director, error: null };
    },
  } as never;
}

describe("Add a home on the server", () => {
  it("refuses a Property Coordinator", async () => {
    await expect(assertCanAddHome(client(["tech"]), "u1")).rejects.toThrow(ADD_HOME_DENIED);
  });
  it("refuses the Operations Supervisor and the Director of Operations", async () => {
    await expect(assertCanAddHome(client(["manager"]), "u1")).rejects.toThrow(ADD_HOME_DENIED);
  });
  it("refuses Finance", async () => {
    await expect(assertCanAddHome(client(["accounting"]), "u1")).rejects.toThrow(ADD_HOME_DENIED);
  });
  it("allows Onboarding accounts, the Director of Onboarding and Admin", async () => {
    const allowed = async (roles: string[], director = false) =>
      assertCanAddHome(client(roles, director), "u1").then(() => true, () => false);
    expect(await allowed(["onboarding"])).toBe(true);
    expect(await allowed(["manager"], true)).toBe(true);
    expect(await allowed(["admin"])).toBe(true);
    expect(await allowed(["tech"])).toBe(false);
  });
  it("refuses when access cannot be read", async () => {
    const broken = {
      from: () => ({ select: () => ({ eq: async () => ({ data: null, error: { message: "x" } }) }) }),
      rpc: async () => ({ data: null, error: null }),
    } as never;
    await expect(assertCanAddHome(broken, "u1")).rejects.toThrow("Could not verify your access level.");
  });

  it("both actions that create a home run the check", () => {
    const src = readFileSync("src/lib/property-intake.functions.ts", "utf8");
    for (const fn of ["importOwnerRezPropertyFn", "createPropertyManuallyFn"]) {
      const body = src.slice(src.indexOf(`export const ${fn}`));
      const handler = body.slice(0, body.indexOf("});") + 3);
      expect(handler).toContain("await assertCanAddHome(context.supabase, context.userId)");
    }
  });

  // Fix Nov 12 (Admin approval): everyone on the onboarding team may add a home on Onboarding Home,
  // including as Upcoming; the other list actions stay the Admin's and the Director of Onboarding's.
  it("Onboarding Home shows Add a home to the onboarding team by the shared rule", () => {
    const src = readFileSync("src/routes/_authenticated/onboarding.index.tsx", "utf8");
    expect(src).toContain("const addHome = canAddHome({ roles, onboardingDirector: isOnboardingDirector, readOnly });");
    const gate = src.indexOf("const addHomeButton = addHome ? (");
    expect(gate > -1 && gate < src.indexOf("<Plus className=\"size-4\" /> Add a home")).toBe(true);
    expect(src).toContain("lead={manage}");
  });

  it("an onboarding account may add an Upcoming home; Operations roles are still refused", async () => {
    const allowed = async (roles: string[], director = false) =>
      assertCanAddHome(client(roles, director), "u1").then(() => true, () => false);
    expect(await allowed(["onboarding"])).toBe(true);
    expect(await allowed(["manager"])).toBe(false);
    expect(await allowed(["tech"])).toBe(false);
    const src = readFileSync("src/lib/onboarding-home.functions.ts", "utf8");
    const body = src.slice(src.indexOf("export const addUpcomingHomeFn"), src.indexOf("export const startUpcomingHomeFn"));
    expect(body).toContain("await assertCanAddHome(context.supabase, context.userId)");
    expect(body).not.toContain("assertLead");
  });

  it("Contract fell through, Under contract, Not an onboarding home, list assignment and stagers stay lead only", () => {
    const src = readFileSync("src/lib/onboarding-home.functions.ts", "utf8");
    const names = ["dismissOwnerRezListingFn", "startUpcomingHomeFn", "contractFellThroughFn", "assignFromListFn", "setProjectStagersFn"];
    for (const fn of names) {
      const from = src.indexOf(`export const ${fn}`);
      const next = src.indexOf("export const ", from + 10);
      expect(src.slice(from, next === -1 ? undefined : next)).toContain("await assertLead(context.supabase, context.userId)");
    }
    const page = readFileSync("src/routes/_authenticated/onboarding.index.tsx", "utf8");
    expect(page).toContain("const manage = mayManageHomes(viewer, readOnly);");
    expect(page).toContain("pickers={manage ? data.pickers : null}");
  });
});
