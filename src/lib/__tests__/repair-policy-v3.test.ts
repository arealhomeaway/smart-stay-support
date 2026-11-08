import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  MAINTENANCE_POLICY,
  MAINTENANCE_POLICY_V2,
  MAINTENANCE_POLICY_VERSION,
  authorityLadder,
  authorityTier,
  ownerApprovalHelp,
  plainLadderLines,
  policyForVersion,
} from "../maintenance-policy";
import { evaluateAuthority, nextAction } from "../work-orders";
import { repairBand } from "../ticket-checklists";
import { authorizationNeed } from "../expenses";
import { approvalPolicyLine } from "../ops-send-to-owner";
import { authorizationState } from "../vendor-sourcing";
import { finalReviewRequirement } from "../final-review";
import { ownerSectionRelevant } from "../work-entry";

/**
 * Repair approval ladder, policy v3 (Emily, Nov 7, 2026, punch list H1):
 *  - $249 and under: it proceeds and the cost is recorded.
 *  - $250 to $349: the Operations Supervisor approves and the owner is told the same day.
 *  - $350 and up: the Operations Supervisor AND the owner both approve before work starts.
 *  - Emergencies: mitigate under a documented exception.
 */
const LADDER = [
  "$249 and under: it proceeds and the cost is recorded.",
  "$250 to $349: the Operations Supervisor approves and the owner is told the same day.",
  "$350 and up: the Operations Supervisor and the owner both approve before work starts.",
  "Emergencies: mitigate under a documented exception.",
];

const finance = (amount: number) => authorizationNeed({ expense_type: "vendor_service", amount });

describe("policy v3 is the current policy", () => {
  it("stores Supervisor at $250, owner at $350 inclusive, Supervisor also in the owner tier, same day notice", () => {
    expect(MAINTENANCE_POLICY.version).toBe(MAINTENANCE_POLICY_VERSION);
    expect(MAINTENANCE_POLICY.supervisorApprovalThreshold).toBe(250);
    expect(MAINTENANCE_POLICY.ownerApprovalThreshold).toBe(350);
    expect(MAINTENANCE_POLICY.ownerThresholdInclusive).toBe(true);
    expect(MAINTENANCE_POLICY.supervisorAlsoApprovesOwnerTier).toBe(true);
    expect(MAINTENANCE_POLICY.ownerNoticeSameDay).toBe(true);
  });
  it("the staged setting value matches the code exactly, with v2 kept as a previous version", () => {
    const sql = readFileSync("docs/pending/repair-policy-v3/02_policy_v3_value.sql", "utf8");
    const value = JSON.parse(/SET value = '(.+?)'::jsonb/.exec(sql)![1]!);
    expect(value).toEqual({
      version: MAINTENANCE_POLICY_VERSION,
      supervisorApprovalThreshold: 250,
      ownerApprovalThreshold: 350,
      ownerThresholdInclusive: true,
      supervisorAlsoApprovesOwnerTier: true,
      ownerNoticeSameDay: true,
      previousVersions: [MAINTENANCE_POLICY_V2],
    });
  });
});

describe("boundaries: who must approve and who is told", () => {
  it("$249.99 proceeds, nobody approves, nobody is asked", () => {
    const v = evaluateAuthority({ quote_amount: 249.99 });
    expect([v.level, v.supervisorApprovalRequired, v.ownerApprovalRequired, v.ownerFyiRequired]).toEqual(["self", false, false, false]);
    expect(authorityTier(249.99)).toBe("proceed");
    expect(finance(249.99).required).toBe(false);
  });
  it("$250: the Operations Supervisor approves and the owner is told the same day", () => {
    const v = evaluateAuthority({ quote_amount: 250 });
    expect([v.level, v.supervisorApprovalRequired, v.ownerApprovalRequired, v.ownerFyiRequired, v.ownerNoticeSameDay]).toEqual(["supervisor", true, false, true, true]);
    expect(v.reason).toContain("the owner is told the same day");
    expect(finance(250)).toMatchObject({ required: true, who: "supervisor", alsoSupervisor: false });
  });
  it("$349.99: still the Operations Supervisor, owner told the same day", () => {
    const v = evaluateAuthority({ quote_amount: 349.99 });
    expect([v.level, v.supervisorApprovalRequired, v.ownerApprovalRequired, v.ownerFyiRequired]).toEqual(["supervisor", true, false, true]);
    expect(authorityTier(349.99)).toBe("supervisor");
  });
  it("exactly $350: the Operations Supervisor and the owner both approve", () => {
    const v = evaluateAuthority({ quote_amount: 350 });
    expect([v.level, v.supervisorApprovalRequired, v.ownerApprovalRequired, v.ownerFyiRequired]).toEqual(["owner", true, true, false]);
    expect(authorityTier(350)).toBe("owner");
    expect(finance(350)).toMatchObject({ required: true, who: "owner", alsoSupervisor: true });
  });
  it("$351: the Operations Supervisor and the owner both approve", () => {
    const v = evaluateAuthority({ quote_amount: 351 });
    expect([v.level, v.supervisorApprovalRequired, v.ownerApprovalRequired]).toEqual(["owner", true, true]);
  });
  it("in the owner tier, owner approval alone is not enough anywhere", () => {
    const ownerOnly = { quote_amount: 350, approval_status: "approved", supervisor_approval_status: "not_required" };
    expect(nextAction(ownerOnly)).toContain("Operations Supervisor");
    expect(authorizationNeed({ expense_type: "vendor_service", amount: 350 }, ownerOnly).satisfiedByWorkOrder).toBe(false);
    expect(authorizationState(ownerOnly).satisfied).toBe(false);
    const both = { ...ownerOnly, supervisor_approval_status: "approved" };
    expect(authorizationNeed({ expense_type: "vendor_service", amount: 350 }, both).satisfiedByWorkOrder).toBe(true);
    expect(authorizationState(both).satisfied).toBe(true);
  });
  it("emergencies mitigate under a documented exception", () => {
    const v = evaluateAuthority({ phase: "mitigation", emergency_reason: "water_intrusion", quote_amount: 900 });
    expect([v.level, v.ownerApprovalRequired, v.supervisorApprovalRequired, v.mitigationOnly]).toEqual(["emergency", false, false, true]);
  });
  it("the owner section and Final Review agree that exactly $350 needs the owner", () => {
    expect(ownerSectionRelevant({ entry_kind: "maintenance", estimated_cost: 349.99, insurance_risk: "no" }).relevant).toBe(false);
    expect(ownerSectionRelevant({ entry_kind: "maintenance", estimated_cost: 350, insurance_risk: "no" }).relevant).toBe(true);
    expect(finalReviewRequirement({ repairAmount: 349.99 }).required).toBe(false);
    expect(finalReviewRequirement({ repairAmount: 350 }).reasons).toEqual(["Major repair of $350 or more, which needs the owner."]);
  });
});

describe("an existing Work Order keeps its old version and result", () => {
  const V2 = MAINTENANCE_POLICY_V2.version;
  it("a v2 Work Order at exactly $350 stays with the Supervisor alone, owner told afterwards", () => {
    const v = evaluateAuthority({ quote_amount: 350, policy_version: V2 });
    expect([v.level, v.supervisorApprovalRequired, v.ownerApprovalRequired, v.ownerFyiRequired, v.policyVersion]).toEqual(["supervisor", true, false, true, V2]);
    expect(v.reason).toBe("$350 falls between $200 and $350, so a supervisor approves before work starts and the homeowner is told afterwards.");
  });
  it("a v2 Work Order at $200 still needs the Supervisor, and above $350 the owner alone", () => {
    expect(evaluateAuthority({ quote_amount: 200, policy_version: V2 }).level).toBe("supervisor");
    const above = evaluateAuthority({ quote_amount: 351, policy_version: V2 });
    expect([above.level, above.ownerApprovalRequired, above.supervisorApprovalRequired]).toEqual(["owner", true, false]);
  });
  it("new or unstamped work uses v3", () => {
    expect(evaluateAuthority({ quote_amount: 200 }).level).toBe("self");
    expect(evaluateAuthority({ quote_amount: 200, policy_version: MAINTENANCE_POLICY_VERSION }).policyVersion).toBe(MAINTENANCE_POLICY_VERSION);
    expect(policyForVersion("some other text")).toBe(MAINTENANCE_POLICY);
  });
  it("Finance reads the linked Work Order's version too", () => {
    const old = { approval_status: "not_required", supervisor_approval_status: "approved", policy_version: V2 };
    expect(authorizationNeed({ expense_type: "vendor_service", amount: 350 }, old)).toMatchObject({ who: "supervisor", satisfiedByWorkOrder: true });
  });
});

describe("the Repair card, Work Orders and Finance show the same ladder", () => {
  it("the ladder reads exactly as decided", () => {
    expect(plainLadderLines()).toEqual(LADDER);
    expect(authorityLadder()).toEqual(LADDER);
  });
  for (const amount of [200, 249, 249.99, 250, 300, 349.99, 350, 351, 1200]) {
    it(`$${amount}: one answer on every screen`, () => {
      const wo = evaluateAuthority({ phase: "permanent", quote_amount: amount });
      const card = repairBand(amount, false)!;
      const fin = finance(amount);
      expect(card.reason).toBe(wo.reason);
      expect(card.label).toBe(wo.label);
      expect([card.ownerApprovalRequired, card.supervisorApprovalRequired]).toEqual([wo.ownerApprovalRequired, wo.supervisorApprovalRequired]);
      expect(fin.required ? fin.reason : null).toBe(fin.required ? wo.reason : null);
      expect(approvalPolicyLine(amount)).toBe(LADDER[amount < 250 ? 0 : amount < 350 ? 1 : 2]!);
    });
  }
  it("the Work Order owner approval help states the same line", () => {
    expect(ownerApprovalHelp().startsWith(LADDER[2]!)).toBe(true);
  });
});

describe("word check on the new ladder text", () => {
  const banned = [/\bseats?\b/i, /\bmedians?\b/i, /\bthresholds?\b/i, /—|–/, /\b(Emily|Micah|Kati|James|Josh|Avy|Nelson|Qym|Mike|Romeo|Roms)\b/];
  const texts: string[] = [
    ...LADDER,
    ownerApprovalHelp(),
    ...[0, 249.99, 250, 349.99, 350, 351].flatMap((a) => {
      const v = evaluateAuthority({ quote_amount: a });
      return [v.label, v.reason, nextAction({ quote_amount: a })];
    }),
    nextAction({ quote_amount: 300, supervisor_approval_status: "approved" }),
    evaluateAuthority({ quote_amount: 400, contractual_exception: true }).reason,
    ...[249, 250, 350].map((a) => approvalPolicyLine(a)),
    finalReviewRequirement({ repairAmount: 400 }).reasons.join(" "),
    ownerSectionRelevant({ entry_kind: "maintenance", estimated_cost: 400 }).reasons.join(" "),
    readFileSync("docs/pending/repair-policy-v3/01_expense_authorization_v3.sql", "utf8")
      .split("\n")
      .filter((l) => /'(Under \$|Operations Supervisor and owner approvals|The Operations Supervisor and the owner must)/.test(l))
      .join(" "),
  ];
  it("no seat, Median, threshold, long dash or person's name", () => {
    expect(texts.every((t) => t.length > 0)).toBe(true);
    const hits = texts.flatMap((t) => banned.filter((re) => re.test(t)).map((re) => `${re} in "${t}"`));
    expect(hits).toEqual([]);
  });
});
