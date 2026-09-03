import { describe, expect, it } from "bun:test";
import {
  canClose,
  closureBlockers,
  commitmentStatus,
  derivedStage,
  evaluateAuthority,
  nextAction,
  nextCheckpoint,
  secondQuoteAdvice,
  waitingOn,
  warrantyHint,
  workOrderBucket,
  MAINTENANCE_POLICY_VERSION,
  OWNER_APPROVAL_KIND,
  declineConsequence,
  matchesManagerFilter,
  ownerApprovalRequest,
  recentlyCompleted,
  repeatMaintenanceProperties,
  workOrderEvidenceSlots,
  workOrderSort,
} from "@/lib/work-orders";

const NOW = new Date("2026-09-02T12:00:00Z");
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60000).toISOString();
const ahead = (minutes: number) => new Date(NOW.getTime() + minutes * 60000).toISOString();

describe("maintenance authority", () => {
  it("A — a $150 repair proceeds with no approval at all", () => {
    const v = evaluateAuthority({ phase: "permanent", quote_amount: 150 });
    expect(v.level).toBe("self");
    expect(v.ownerApprovalRequired).toBe(false);
    expect(v.supervisorApprovalRequired).toBe(false);
  });

  it("A2 — $275 needs a supervisor first and the homeowner told after", () => {
    const v = evaluateAuthority({ phase: "permanent", quote_amount: 275 });
    expect(v.level).toBe("supervisor");
    expect(v.supervisorApprovalRequired).toBe(true);
    expect(v.ownerFyiRequired).toBe(true);
    expect(v.ownerApprovalRequired).toBe(false);
  });

  it("B — $340 is still a supervisor decision, not the owner's", () => {
    const v = evaluateAuthority({ phase: "permanent", quote_amount: 340 });
    expect(v.ownerApprovalRequired).toBe(false);
    expect(v.supervisorApprovalRequired).toBe(true);
  });

  it("C — a $650 permanent repair needs the owner, and says why", () => {
    const v = evaluateAuthority({ phase: "permanent", quote_amount: 650 });
    expect(v.level).toBe("owner");
    expect(v.reason).toContain("exceeds $350");
  });

  it("a recorded contractual exception keeps a large repair with James", () => {
    const v = evaluateAuthority({ phase: "permanent", quote_amount: 650, contractual_exception: true });
    expect(v.ownerApprovalRequired).toBe(false);
    expect(v.reason).toContain("contractual exception");
  });

  it("without an amount, a coordinator may still get the quote", () => {
    expect(evaluateAuthority({ phase: "permanent" }).level).toBe("self");
  });

  it("D — emergency mitigation proceeds but never carries the permanent repair", () => {
    const v = evaluateAuthority({ phase: "mitigation", emergency_reason: "water_intrusion", quote_amount: 1500 });
    expect(v.level).toBe("emergency");
    expect(v.mitigationOnly).toBe(true);
    expect(v.ownerApprovalRequired).toBe(false);
    const permanent = evaluateAuthority({ phase: "permanent", quote_amount: 1500 });
    expect(permanent.ownerApprovalRequired).toBe(true);
  });
});

describe("warranty", () => {
  const builder = {
    builder_present: true,
    builder_expires_on: "2027-01-01",
    "claim_process + external_links": "Zac — 405-555-0100",
  };

  it("E — an unexpired builder warranty may apply, with contact and expiry", () => {
    const hint = warrantyHint(builder, "HVAC", NOW);
    expect(hint.mayApply).toBe(true);
    expect(hint.kind).toBe("builder");
    expect(hint.contact).toContain("Zac");
    expect(hint.reason).toContain("Confirm coverage");
  });

  it("never assumes coverage when the warranty has expired", () => {
    const hint = warrantyHint({ ...builder, builder_expires_on: "2025-01-01" }, "HVAC", NOW);
    expect(hint.mayApply).toBe(false);
  });

  it("stays silent when the home has no warranty on file", () => {
    expect(warrantyHint(null, "HVAC", NOW).mayApply).toBe(false);
    expect(warrantyHint({ builder_present: false }, "Plumbing", NOW).mayApply).toBe(false);
  });

  it("a furniture warranty applies to furniture work, not plumbing", () => {
    const w = { furniture_expires_on: "2029-04-17", "claim_process + external_links": "none" };
    expect(warrantyHint(w, "Mattress replacement", NOW).mayApply).toBe(true);
    expect(warrantyHint(w, "Plumbing", NOW).mayApply).toBe(false);
    expect(warrantyHint(w, "Furniture", NOW).contact).toBeNull();
  });

  it("F — an override records the reason and stops the warranty wait", () => {
    const wo = {
      warranty_may_apply: true,
      warranty_contacted_at: ago(600),
      warranty_eta_at: ahead(20000),
      warranty_override_reason: "next_reservation_affected",
      vendor_contacted_at: ago(10),
      vendor_acknowledged_at: ago(9),
    };
    expect(waitingOn(wo)).toBe("vendor");
  });

  it("warranty work waits on the provider until a human decides otherwise", () => {
    const wo = { warranty_may_apply: true, warranty_contacted_at: ago(60), warranty_eta_at: ahead(2880) };
    expect(waitingOn(wo)).toBe("warranty");
    expect(workOrderBucket(wo, NOW)).toBe("warranty_pending");
  });

  it("asks for the provider call before a paid repair is committed", () => {
    expect(nextAction({ warranty_may_apply: true }, NOW)).toContain("contact the warranty provider");
  });
});

describe("second quote", () => {
  it("G — dramatically different quotes prompt a comparison, not a block", () => {
    const advice = secondQuoteAdvice({ quote_amount: 500, second_quote_amount: 1800 });
    expect(advice.recommended).toBe(true);
    expect(advice.signals).toContain("quotes_differ");
  });

  it("an estimate approaching replacement cost is a signal", () => {
    expect(secondQuoteAdvice({ quote_amount: 900, replacement_cost: 1200 }).recommended).toBe(true);
  });

  it("an ordinary quote needs no comparison", () => {
    expect(secondQuoteAdvice({ quote_amount: 225 }).recommended).toBe(false);
  });
});

describe("vendor commitments and checkpoints", () => {
  it("H — two missed commitments recommend a backup vendor and notify James", () => {
    const status = commitmentStatus({ missed_commitments: 2 }, NOW);
    expect(status.action).toContain("Backup vendor");
    expect(status.action).toContain("James");
  });

  it("a first miss is a coordinator follow-up, not an escalation", () => {
    expect(commitmentStatus({ missed_commitments: 1 }, NOW).action).toContain("follow up");
  });

  it("a repeated pattern goes to a performance review", () => {
    expect(commitmentStatus({ missed_commitments: 3 }, NOW).action).toContain("Micah");
  });

  it("a P1 without acknowledgment inside ten minutes moves to the backup", () => {
    const status = commitmentStatus({ priority: "p1", vendor_contacted_at: ago(15) }, NOW);
    expect(status.acknowledgeOverdue).toBe(true);
    expect(status.action).toContain("backup vendor");
  });

  it("a P2 acknowledged inside thirty minutes is fine", () => {
    expect(
      commitmentStatus({ priority: "p2", vendor_contacted_at: ago(20) }, NOW).acknowledgeOverdue,
    ).toBe(false);
  });

  it("a passed ETA with no arrival is a missed ETA", () => {
    expect(commitmentStatus({ vendor_eta_at: ago(30) }, NOW).etaMissed).toBe(true);
  });

  it("checkpoints derive in order", () => {
    expect(nextCheckpoint({}, NOW)).toBe("contact_vendor");
    expect(nextCheckpoint({ vendor_name: "Ace", vendor_contacted_at: ago(5) }, NOW)).toBe("await_acknowledgment");
    expect(
      nextCheckpoint({ vendor_name: "Ace", vendor_contacted_at: ago(5), vendor_acknowledged_at: ago(4) }, NOW),
    ).toBe("confirm_eta");
    expect(
      nextCheckpoint(
        {
          vendor_name: "Ace",
          vendor_contacted_at: ago(5),
          vendor_acknowledged_at: ago(4),
          vendor_eta_at: ahead(60),
        },
        NOW,
      ),
    ).toBe("await_arrival");
  });
});

describe("stage, queue and closure", () => {
  it("stage is derived from what actually happened", () => {
    expect(derivedStage({})).toBe("needs_diagnosis");
    expect(derivedStage({ quote_requested_at: ago(60) })).toBe("quote_requested");
    expect(derivedStage({ quote_amount: 200 })).toBe("quote_received");
    expect(derivedStage({ quote_amount: 900 })).toBe("awaiting_approval");
    expect(derivedStage({ quote_amount: 900, approval_status: "approved" })).toBe("approved");
    expect(derivedStage({ vendor_arrived_at: ago(30) })).toBe("in_progress");
    expect(derivedStage({ closed_at: ago(1) })).toBe("closed");
  });

  it("owner notified is never owner approved", () => {
    const wo = { quote_amount: 900, approval_status: "pending" };
    expect(nextAction(wo, NOW)).toContain("not owner approved");
    expect(workOrderBucket(wo, NOW)).toBe("waiting_owner");
    expect(closureBlockers({ ...wo, vendor_completed_at: ago(1), evidence_complete: true, final_cost: 900 })).toContain(
      "Owner approval for this repair is not documented.",
    );
  });

  it("I — vendor saying done with no evidence cannot close", () => {
    const wo = { vendor_completed_at: ago(10), final_cost: 220 };
    expect(canClose(wo)).toBe(false);
    expect(closureBlockers(wo)).toContain("Completion photo or video evidence is missing.");
    expect(workOrderBucket(wo, NOW)).toBe("evidence_missing");
  });

  it("an occupied home needs the guest update before closure", () => {
    const wo = { vendor_completed_at: ago(10), evidence_complete: true, final_cost: 220, occupied_now: true };
    expect(closureBlockers(wo)).toContain("The guest in the home has not been updated.");
  });

  it("J — mitigation alone does not close work when the permanent repair is outstanding", () => {
    const wo = {
      phase: "mitigation" as const,
      emergency_reason: "essential_utility_loss",
      temporary_mitigation: "Mini fridge delivered",
      vendor_completed_at: ago(60),
      evidence_complete: true,
      final_cost: 120,
      permanent_repair_needed: true,
    };
    expect(canClose(wo)).toBe(false);
    expect(workOrderBucket(wo, NOW)).toBe("permanent_pending");
    expect(nextAction(wo, NOW)).toContain("permanent repair");
  });

  it("a fully evidenced repair closes", () => {
    const wo = { quote_amount: 225, vendor_completed_at: ago(10), evidence_complete: true, final_cost: 225 };
    expect(canClose(wo)).toBe(true);
    expect(nextAction(wo, NOW)).toBe("Ready to close.");
  });
});

describe("owner approval, evidence and oversight", () => {
  const base = {
    phase: "permanent" as const,
    priority: "p2",
    approval_status: "not_required" as const,
    quote_amount: 900,
    title: "Water heater replacement",
  };

  it("the owner approval request carries the decision context", () => {
    const req = ownerApprovalRequest({ ...base, emergency_reason: "no_hot_water" });
    expect(req.kind).toBe(OWNER_APPROVAL_KIND);
    expect(req.amount).toBe(900);
    expect(req.detail.emergency_mitigation_performed).toBe(true);
    expect(req.detail.policy_version).toBe(MAINTENANCE_POLICY_VERSION);
  });

  it("a declined approval keeps the consequence visible", () => {
    expect(declineConsequence({ ...base, approval_status: "declined", occupied_now: true })).toContain("guest");
    expect(declineConsequence({ ...base, approval_status: "approved" })).toBeNull();
  });

  it("permanent work adds the quote evidence slot; warranty adds correspondence", () => {
    const slots = workOrderEvidenceSlots("permanent", true).map((s) => s.key);
    expect(slots).toContain("vendor_quote");
    expect(slots).toContain("warranty_correspondence");
    expect(workOrderEvidenceSlots("mitigation").map((s) => s.key)).not.toContain("vendor_quote");
  });

  it("the queue puts the most urgent, oldest work first", () => {
    const rows = [
      { ...base, priority: "p3", created_at: "2026-01-01" },
      { ...base, priority: "p1", created_at: "2026-02-01" },
    ];
    expect([...rows].sort(workOrderSort)[0]?.priority).toBe("p1");
  });

  it("recently completed work stays visible for thirty days only", () => {
    const now = new Date("2026-03-01T00:00:00Z");
    expect(recentlyCompleted({ ...base, closed_at: "2026-02-20T00:00:00Z" }, 30, now)).toBe(true);
    expect(recentlyCompleted({ ...base, closed_at: "2025-12-01T00:00:00Z" }, 30, now)).toBe(false);
  });

  it("manager filters surface outstanding approvals and unrepaired homes", () => {
    expect(matchesManagerFilter({ ...base, approval_status: "pending" }, "owner_approval_pending")).toBe(true);
    expect(
      matchesManagerFilter({ ...base, phase: "mitigation", permanent_repair_needed: true }, "mitigated_not_repaired"),
    ).toBe(true);
    expect(matchesManagerFilter({ ...base, closed_at: "2026-01-01" }, "owner_approval_pending")).toBe(false);
  });

  it("repeat maintenance is counted per home inside the window", () => {
    const now = new Date("2026-03-01T00:00:00Z");
    const repeats = repeatMaintenanceProperties(
      [
        { property_id: "a", created_at: "2026-02-01" },
        { property_id: "a", created_at: "2026-02-20" },
        { property_id: "b", created_at: "2026-02-20" },
      ],
      90,
      now,
    );
    expect(repeats).toEqual([{ property_id: "a", count: 2 }]);
  });
});
