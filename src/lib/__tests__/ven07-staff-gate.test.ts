import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { assertStaffCaller, isStaffCaller, STAFF_ONLY_MESSAGE } from "@/lib/integration-staff-gate";
import { MANUAL_ROUTINE_KINDS } from "@/lib/routine-controls";

// Fake client: the database's is_staff answers per user.
const client = (staff: Record<string, boolean>) => ({
  rpc: async (_fn: string, args: { _user_id: string }) => ({ data: staff[args._user_id] ?? false, error: null }),
});
const db = client({ staff1: true, vendor1: false, owner1: false });

describe("VEN-07 integration lookups are staff-only", () => {
  it("refuses a vendor session", async () => {
    await expect(assertStaffCaller(db, "vendor1")).rejects.toThrow(STAFF_ONLY_MESSAGE);
  });
  it("refuses a homeowner session", async () => {
    await expect(assertStaffCaller(db, "owner1")).rejects.toThrow(STAFF_ONLY_MESSAGE);
  });
  it("refuses an anonymous caller", async () => {
    expect(await isStaffCaller(db, null)).toBe(false);
  });
  it("refuses when the staff check errors", async () => {
    const broken = { rpc: async () => ({ data: true, error: new Error("x") }) };
    expect(await isStaffCaller(broken, "staff1")).toBe(false);
  });
  it("lets staff through", async () => {
    await expect(assertStaffCaller(db, "staff1")).resolves.toBeUndefined();
  });

  const gated: Record<string, number> = {
    "src/lib/ownerrez.functions.ts": 4,
    "src/lib/property-facts.functions.ts": 1,
    "src/lib/inbound.functions.ts": 2,
  };
  for (const [file, n] of Object.entries(gated)) {
    it(`${file} gates every handler on the server`, () => {
      const src = readFileSync(file, "utf8");
      const handlers = src.match(/\.handler\(/g)?.length ?? 0;
      const gates = src.match(/StaffCaller\(context\.supabase, context\.userId\)/g)?.length ?? 0;
      expect(handlers).toBe(n);
      expect(gates).toBe(n);
    });
  }
});

describe("legacy Checkout routine is retired", () => {
  it("can no longer be started by hand", () => {
    expect(MANUAL_ROUTINE_KINDS).not.toContain("checkout");
  });
  it("vendor home access is limited to open or 30-day-recent work", () => {
    const sql = readFileSync("docs/pending/ven-07/01_vendor_home_access_window.sql", "utf8");
    expect(sql).toContain("interval '30 days'");
    expect(sql).toContain("private.vendor_sees_property(auth.uid(), id)");
  });
});
