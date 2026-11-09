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
    await expect(assertCanAddHome(client(["onboarding"]), "u1")).resolves.toBeUndefined();
    await expect(assertCanAddHome(client(["manager"], true), "u1")).resolves.toBeUndefined();
    await expect(assertCanAddHome(client(["admin"]), "u1")).resolves.toBeUndefined();
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

  it("the Onboarding page shows Add property only by the same rule", () => {
    const src = readFileSync("src/routes/_authenticated/onboarding.index.tsx", "utf8");
    expect(src).toContain("const mayAddHome = canAddHome(");
    expect(src.indexOf("{mayAddHome ? (")).toBeGreaterThan(-1);
    expect(src.indexOf("{mayAddHome ? (")).toBeLessThan(src.indexOf("<AddPropertyDialog"));
  });
});
