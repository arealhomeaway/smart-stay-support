import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { groupPlanByHome, isOwnerEmailRunMissing } from "@/lib/ao-ui";

describe("Active Owner fix, screen rules", () => {
  it("owner plan cards group under each home's street address, in the owner's home order", () => {
    const homes = [{ propertyId: "b", name: "3915 W 104th St S" }, { propertyId: "a", name: "9211 Fitzgerald Dr" }];
    const g = groupPlanByHome([{ property_id: "a", id: 1 }, { property_id: "b", id: 2 }, { property_id: "a", id: 3 }], homes);
    expect(g.map((x) => [x.name, x.cards.map((c) => c.id)])).toEqual([["3915 W 104th St S", [2]], ["9211 Fitzgerald Dr", [1, 3]]]);
  });

  it("only a missing daily email function is skipped; other errors stop the job step", () => {
    expect(isOwnerEmailRunMissing({ code: "PGRST202", message: "Could not find the function public.ao_owner_email_run without parameters" })).toBe(true);
    expect(isOwnerEmailRunMissing({ code: "42883", message: "function public.ao_owner_email_run(timestamp with time zone) does not exist" })).toBe(true);
    expect(isOwnerEmailRunMissing({ code: "P0001", message: "ao_owner_email_run failed" })).toBe(false);
    expect(isOwnerEmailRunMissing({ code: "PGRST202", message: "Could not find the function public.ao_process_clocks" })).toBe(false);
  });

  it("the five minute job runs the Active Owner email step before owner delivery and keeps every other step", () => {
    const src = readFileSync("src/routes/api/public/hooks/owner-notify.ts", "utf8");
    const order = ["progress", "deadlines_and_vendor_reminders", "ao_owner_email", "owner", "staff", "scheduled", "welcomes", "ao_clocks"]
      .map((n) => src.indexOf(`name: "${n}"`));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("homeowner wording added by this build never mentions hours estimates, investment or pay dates", () => {
    const sql = readFileSync("docs/pending/active-owner-fix/02_engine.sql", "utf8");
    const owner = [...sql.matchAll(/'(Your homeowner plan[^']*|We added %s[^']*|Your home is live[^']*|Here is what is new[^']*)'/g)].map((m) => m[1]);
    expect(owner.length).toBeGreaterThan(3);
    for (const t of owner) expect(t).not.toMatch(/hour|invest|pay|paid/i);
  });
});
