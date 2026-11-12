/**
 * Build 18 (Emily, Nov 10): items 2, 3, 6a and 6b on the screens. Source and pure-function checks;
 * no database, no Breezeway, no OwnerRez.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { payoutsCsv, type BonusPayoutRow } from "../bonus";

const read = (p: string) => readFileSync(p, "utf8");

describe("Build 18 item 2: no pay dates anywhere in bonus screens or the export", () => {
  const files = [
    "src/lib/bonus.ts",
    "src/components/bonus/BonusScorecard.tsx",
    "src/components/databases/BonusPayouts.tsx",
    "src/routes/_authenticated/bonus-verify.tsx",
    "src/routes/_authenticated/bonus-settings.tsx",
    "src/routes/_authenticated/my-scorecard.tsx",
  ];
  it("no bonus screen says Pays on, payday or reads a pay date", () => {
    for (const f of files) {
      let src = "";
      try {
        src = read(f);
      } catch {
        continue;
      }
      expect(src).not.toMatch(/Pays on/i);
      expect(src).not.toMatch(/payday/i);
      expect(src).not.toMatch(/pays_on/);
      expect(src).not.toMatch(/Paid (monthly|quarterly)/);
    }
  });

  it("the payouts CSV has no pay date column or value", () => {
    const row = {
      id: "1", plan: "ops_supervisor", plan_name: "Operations Supervisor", user_id: "u", person: "Person",
      period_start: "2026-11-09", period_end: "2026-11-30", label: "November 2026", status: "verified",
      total: 100, verified_by: "Reviewer", verified_at: "2026-12-02T15:00:00Z",
      goals: [{ name: "Queue checks", value: 96, unit: "percent", level: "goal_met", dollars: 25 }],
      pays_on: "The last payday in December 2026",
    } as unknown as BonusPayoutRow;
    const csv = payoutsCsv([row]);
    expect(csv).not.toMatch(/Pays on/i);
    expect(csv).not.toMatch(/payday/i);
    expect(csv.split("\n")[0]).toBe(
      "Person,Plan,Period,First day,Last day,Verified total,Verified by,Verified at,Queue checks measure,Queue checks level,Queue checks dollars",
    );
  });
});

describe("Build 18 item 3: no suggested hours on any card", () => {
  it("homeowner Opportunity cards and details show no suggested time", () => {
    const src = read("src/components/owner/OwnerOpportunities.tsx");
    expect(src).not.toMatch(/Suggested time/);
    expect(src).not.toMatch(/minutesLabel\(/);
    expect(src).not.toMatch(/About \$\{/);
  });

  it("staff card library, owner programs, Library and the Opportunity editor show no hour estimate", () => {
    expect(read("src/routes/_authenticated/owner-card-library.tsx")).not.toMatch(/key: "est_hours_(min|max)"/);
    expect(read("src/routes/_authenticated/owner-programs.tsx")).not.toMatch(/planning_hours_(low|high)\}/);
    expect(read("src/routes/_authenticated/owner-library.tsx")).not.toMatch(/Suggested minutes/);
    expect(read("src/components/onboarding/OwnerCollaboration.tsx")).not.toMatch(/Suggested time/);
  });

  it("the stored numbers are kept: saves still carry existing values and never clear them", () => {
    // Card library: the save patch has no hour keys, so ao_card_save keeps the stored values.
    expect(read("src/routes/_authenticated/owner-card-library.tsx")).not.toMatch(/est_hours/);
    // Opportunity editor and Library keep passing the value they loaded.
    expect(read("src/components/onboarding/OwnerCollaboration.tsx")).toMatch(/suggested_minutes: form\.minutes/);
    expect(read("src/routes/_authenticated/owner-library.tsx")).toMatch(/suggested_minutes/);
  });

  it("the owner's pace meter is unchanged", () => {
    expect(read("src/lib/ao-ui.ts")).toMatch(/hours a week to reach 100 by/);
  });
});

describe("Build 18 item 6: Build 17 leftovers", () => {
  it("a lead no longer opens the old Availability Finder; the page itself stays", () => {
    const src = read("src/components/leads/LeadDrawer.tsx");
    expect(src).not.toMatch(/availability-finder/);
    expect(src).not.toMatch(/Choose another property/);
    expect(src).not.toMatch(/choose another/i);
    expect(read("src/routes/_authenticated/availability-finder.tsx")).toMatch(/createFileRoute\("\/_authenticated\/availability-finder"\)/);
  });

  it("Edit selected shows only when the database says this person may edit this home", () => {
    // Plan catch-up (Nov 12) moved Edit selected into the bar pinned to the bottom of the Plan tab.
    const bar = read("src/components/onboarding/PlanCatchUp.tsx");
    expect(bar).toMatch(/const editable = canEditSelected && /);
    expect(bar).toMatch(/editable \? \(\s*<Button[\s\S]{0,120}>Edit selected<\/Button>/);
    expect(bar).toMatch(/dialog === "edit" && editable/);
    const page = read("src/routes/_authenticated/onboarding.$propertyId.tsx");
    expect(page).toMatch(/rpc\("can_bulk_edit_home_tasks", \{ _property_id: propertyId \}\)/);
    expect(page).toMatch(/canEditSelected=\{bulkEditQuery\.data === true\}/);
  });
});
