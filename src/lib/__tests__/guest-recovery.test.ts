import { describe, expect, it } from "bun:test";
import {
  BUCKET_LABELS,
  canClose,
  closureBlockers,
  effectiveOwner,
  evaluateAuthority,
  evidenceSlots,
  findDuplicates,
  isMonetary,
  matchesManagerFilter,
  nextAction,
  nextGuestUpdateDue,
  proposeStage,
  recoveryBucket,
  slotsForReimbursement,
  stageState,
  supervisorTriggers,
  RECOVERY_POLICY,
  POLICY_VERSION,
} from "@/lib/guest-recovery";

const req = (slot: string, status: string, required = true) => ({
  slot_key: slot,
  label: slot,
  status,
  required,
}) as never;

describe("policy authority", () => {
  it("carries the policy version on every verdict", () => {
    expect(evaluateAuthority({ recovery_action: "apology" }).policyVersion).toBe(POLICY_VERSION);
    expect(POLICY_VERSION).toContain("v1");
  });

  it("non-monetary service recovery is coordinator authority", () => {
    const v = evaluateAuthority({ recovery_action: "apology" });
    expect(v.level).toBe("pc");
    expect(v.requiresDecisionReason).toBe(false);
  });

  it("a $35 courtesy item stays with the coordinator", () => {
    const v = evaluateAuthority({ recovery_action: "courtesy_item", proposed_amount: 35 });
    expect(v.level).toBe("pc");
  });

  it("a courtesy item above $50 leaves coordinator authority", () => {
    expect(evaluateAuthority({ recovery_action: "courtesy_item", proposed_amount: 65 }).level).toBe(
      "supervisor",
    );
  });

  it("refunds within Airbnb policy and under $500 are James's call", () => {
    for (const amount of [75, 250, 300]) {
      const v = evaluateAuthority({
        recovery_action: "partial_refund",
        proposed_amount: amount,
        within_airbnb_policy: true,
      });
      expect(v.level).toBe("supervisor");
      expect(v.requiresDecisionReason).toBe(false);
    }
  });

  it("over $300 James must document the reason", () => {
    for (const amount of [325, 475]) {
      const v = evaluateAuthority({
        recovery_action: "partial_refund",
        proposed_amount: amount,
        within_airbnb_policy: true,
      });
      expect(v.level).toBe("supervisor");
      expect(v.requiresDecisionReason).toBe(true);
    }
  });

  it("over $500 goes to the Director", () => {
    const v = evaluateAuthority({
      recovery_action: "partial_refund",
      proposed_amount: 550,
      within_airbnb_policy: true,
    });
    expect(v.level).toBe("director");
    expect(v.reason).toContain("$500");
  });

  it("outside standard Airbnb policy escalates whatever the amount", () => {
    const v = evaluateAuthority({
      recovery_action: "partial_refund",
      proposed_amount: 60,
      within_airbnb_policy: false,
    });
    expect(v.level).toBe("director");
    expect(v.escalations).toContain("outside_policy");
  });

  it("asks the policy question before an approval request", () => {
    const v = evaluateAuthority({ recovery_action: "partial_refund", proposed_amount: 200 });
    expect(v.requiresPolicyAnswer).toBe(true);
  });

  it("multi-night, full-stay and relocation are always Director decisions", () => {
    for (const action of ["full_refund", "shorten_stay", "relocation"] as const) {
      const v = evaluateAuthority({ recovery_action: action, proposed_amount: 25, within_airbnb_policy: true });
      expect(v.level).toBe("director");
    }
  });

  it("a safety allegation escalates on a small amount", () => {
    const v = evaluateAuthority({
      recovery_action: "credit",
      proposed_amount: 40,
      within_airbnb_policy: true,
      escalation_flags: ["safety_allegation"],
    });
    expect(v.level).toBe("director");
  });

  it("emergency proceeds and notifies", () => {
    expect(evaluateAuthority({ recovery_action: "relocation", emergency: true }).level).toBe("emergency");
  });

  it("thresholds come from the central policy", () => {
    expect(RECOVERY_POLICY.pcCourtesyCeiling).toBe(50);
    expect(RECOVERY_POLICY.supervisorRefundCeiling).toBe(500);
    expect(RECOVERY_POLICY.supervisorDocumentationThreshold).toBe(300);
  });
});

describe("supervisor escalation triggers", () => {
  const now = new Date("2026-03-10T12:00:00Z");

  it("an unaccepted P1 after 3 minutes goes to James", () => {
    const t = supervisorTriggers({ priority: "p1", created_at: "2026-03-10T11:50:00Z" }, now);
    expect(t).toContain("p1_unaccepted");
  });

  it("an accepted P1 does not", () => {
    const t = supervisorTriggers(
      { priority: "p1", created_at: "2026-03-10T11:50:00Z", accepted_at: "2026-03-10T11:51:00Z" },
      now,
    );
    expect(t).not.toContain("p1_unaccepted");
  });

  it("a P2 without a plan after 30 minutes goes to James", () => {
    expect(supervisorTriggers({ priority: "p2", created_at: "2026-03-10T11:00:00Z" }, now)).toContain(
      "p2_no_plan",
    );
  });

  it("a guest asking for more than $50 exceeds coordinator authority", () => {
    expect(supervisorTriggers({ guest_requested_amount: 120 }, now)).toContain("monetary_beyond_pc");
  });

  it("two missed vendor commitments escalate", () => {
    expect(supervisorTriggers({ vendor_missed_commitments: 2 }, now)).toContain(
      "vendor_missed_commitments",
    );
  });

  it("an active stay unresolved over two hours escalates", () => {
    const t = supervisorTriggers(
      { created_at: "2026-03-10T09:00:00Z", stay_arrival: "2026-03-08", stay_departure: "2026-03-12" },
      now,
    );
    expect(t).toContain("unresolved_two_hours");
  });

  it("a reopened issue escalates", () => {
    expect(supervisorTriggers({ reopened_at: "2026-03-09T00:00:00Z" }, now)).toContain("reopened_issue");
  });
});

describe("communication SLA", () => {
  it("P1 acknowledgment is due three minutes after the report", () => {
    const due = nextGuestUpdateDue({ priority: "p1", created_at: "2026-03-10T12:00:00Z" });
    expect(due?.toISOString()).toBe("2026-03-10T12:03:00.000Z");
  });

  it("ongoing P3 updates are every two hours", () => {
    const due = nextGuestUpdateDue({ priority: "p3", last_guest_update_at: "2026-03-10T12:00:00Z" });
    expect(due?.toISOString()).toBe("2026-03-10T14:00:00.000Z");
  });

  it("a promised time supersedes the standard checkpoint", () => {
    const due = nextGuestUpdateDue({
      priority: "p3",
      last_guest_update_at: "2026-03-10T12:00:00Z",
      promised_update_at: "2026-03-10T12:30:00Z",
    });
    expect(due?.toISOString()).toBe("2026-03-10T12:30:00.000Z");
  });

  it("an overdue guest update outranks everything else in Next Action", () => {
    const action = nextAction(
      { stage: "decision_drafted", priority: "p1", created_at: "2026-03-10T11:00:00Z" },
      { now: new Date("2026-03-10T12:00:00Z") },
    );
    expect(action).toContain("Guest update is due");
  });
});

describe("evidence", () => {
  it("apology needs no impact photo, a refund does", () => {
    expect(evidenceSlots("apology").map((s) => s.key)).not.toContain("impact_proof");
    expect(evidenceSlots("partial_refund").map((s) => s.key)).toContain("impact_proof");
  });

  it("food loss asks for the guest receipt", () => {
    expect(evidenceSlots("partial_refund", "food_loss").map((s) => s.key)).toContain("guest_receipt");
  });

  it("a maintenance failure asks for the vendor diagnosis", () => {
    expect(evidenceSlots("partial_refund", "maintenance_failure").map((s) => s.key)).toContain(
      "vendor_diagnosis",
    );
  });

  it("reimbursement adds the guest receipt", () => {
    expect(slotsForReimbursement("partial_refund").map((s) => s.key)).toContain("guest_receipt");
  });
});

describe("next action", () => {
  const now = new Date("2026-03-10T12:00:00Z");
  const base = { priority: "p3" as const, last_guest_update_at: "2026-03-10T11:55:00Z" };

  it("starts by confirming the impact", () => {
    expect(nextAction({ ...base, stage: "reported" }, { now })).toContain("Confirm the impact");
  });

  it("waits on blocking evidence", () => {
    const action = nextAction(
      { ...base, stage: "evidence", impact_detail: "No hot water" },
      { requirements: [req("impact_proof", "awaiting")], now },
    );
    expect(action).toContain("Obtain");
  });

  it("asks for the remedy once evidence is met", () => {
    const action = nextAction(
      { ...base, stage: "evidence", impact_detail: "No hot water" },
      { requirements: [req("impact_proof", "verified")], now },
    );
    expect(action).toContain("Decide the remedy");
  });

  it("asks for an amount on a monetary remedy", () => {
    const action = nextAction(
      { ...base, stage: "decision_drafted", impact_detail: "x", recovery_action: "partial_refund" },
      { now },
    );
    expect(action).toContain("proposed amount");
  });

  it("asks the policy question before routing approval", () => {
    const action = nextAction(
      {
        ...base,
        stage: "decision_drafted",
        impact_detail: "x",
        recovery_action: "partial_refund",
        proposed_amount: 200,
      },
      { now },
    );
    expect(action).toContain("Airbnb");
  });

  it("routes to James inside his limit", () => {
    const action = nextAction(
      {
        ...base,
        stage: "decision_drafted",
        impact_detail: "x",
        recovery_action: "partial_refund",
        proposed_amount: 200,
        within_airbnb_policy: true,
      },
      { now },
    );
    expect(action).toContain("James");
  });

  it("routes to the Director above the limit", () => {
    const action = nextAction(
      {
        ...base,
        stage: "decision_drafted",
        impact_detail: "x",
        recovery_action: "partial_refund",
        proposed_amount: 900,
        within_airbnb_policy: true,
      },
      { now },
    );
    expect(action).toContain("Director");
  });

  it("a returned approval asks for the missing information", () => {
    expect(nextAction({ ...base, stage: "awaiting_approval", approval_status: "returned" }, { now })).toContain(
      "Returned for information",
    );
  });

  it("checkout within a day raises urgency", () => {
    const action = nextAction(
      {
        ...base,
        stage: "decision_drafted",
        impact_detail: "x",
        recovery_action: "courtesy_item",
        proposed_amount: 25,
        stay_departure: "2026-03-11",
      },
      { now: new Date("2026-03-10T12:00:00") },
    );
    expect(action).toContain("checks out");
  });

  it("a disputed guest gets a call, whatever the stage", () => {
    expect(nextAction({ ...base, stage: "guest_offered", outcome: "guest_disputed" }, { now })).toContain(
      "Call them",
    );
  });

  it("closed recoveries have nothing outstanding", () => {
    expect(nextAction({ stage: "closed" })).toContain("Closed");
  });
});

describe("closure gates", () => {
  const complete = {
    stage: "completed" as const,
    corrective_action: "Replaced the water heater element",
    final_communication_at: "2026-03-10T12:00:00Z",
    approved_amount: 200,
    delivered_amount: 200,
  };

  it("a complete recovery may close", () => {
    expect(canClose(complete)).toBe(true);
  });

  it("missing corrective action blocks closure", () => {
    expect(closureBlockers({ ...complete, corrective_action: null })[0]).toContain("corrective action");
  });

  it("approved money that was never issued blocks closure", () => {
    expect(closureBlockers({ ...complete, delivered_amount: null })[0]).toContain("actual amount issued");
  });

  it("an unaccepted handoff blocks closure", () => {
    expect(closureBlockers({ ...complete, handoff_status: "requested" }).join(" ")).toContain("handoff");
  });
});

describe("ownership", () => {
  it("a requested handoff leaves the original owner responsible", () => {
    expect(effectiveOwner({ assigned_to: "a", handoff_to: "b", handoff_status: "requested" })).toBe("a");
  });

  it("an accepted handoff transfers ownership", () => {
    expect(effectiveOwner({ assigned_to: "a", handoff_to: "b", handoff_status: "accepted" })).toBe("b");
  });
});

describe("queue buckets", () => {
  const now = new Date("2026-03-10T12:00:00Z");

  it("awaiting approval lands in approval required", () => {
    expect(recoveryBucket({ stage: "awaiting_approval", priority: "p3", last_guest_update_at: "2026-03-10T11:55:00Z" }, { now })).toBe(
      "approval_required",
    );
  });

  it("an approved recovery needs action", () => {
    expect(
      recoveryBucket(
        { stage: "approved", priority: "p3", last_guest_update_at: "2026-03-10T11:55:00Z" },
        { now },
      ),
    ).toBe("approved_action_needed");
  });

  it("a declined approval goes to reassess", () => {
    expect(
      recoveryBucket({ stage: "decision_drafted", approval_status: "declined" }, { now }),
    ).toBe("reassess");
  });

  it("every bucket has a label", () => {
    expect(BUCKET_LABELS.needs_attention).toBe("Needs attention");
  });
});

describe("manager oversight", () => {
  const now = new Date("2026-03-10T12:00:00Z");

  it("finds approvals above the supervisor limit", () => {
    expect(
      matchesManagerFilter({ stage: "awaiting_approval", proposed_amount: 800 }, "above_supervisor_limit", now),
    ).toBe(true);
  });

  it("finds approvals over $300 with no written reason", () => {
    expect(
      matchesManagerFilter({ stage: "awaiting_approval", proposed_amount: 400 }, "documentation_missing", now),
    ).toBe(true);
  });

  it("finds approved money that was never delivered", () => {
    expect(
      matchesManagerFilter({ stage: "approved", approved_amount: 300 }, "approved_not_delivered", now),
    ).toBe(true);
  });

  it("finds cases outside standard policy", () => {
    expect(
      matchesManagerFilter({ stage: "evidence", within_airbnb_policy: false }, "outside_policy", now),
    ).toBe(true);
  });
});

describe("stage proposal and duplicates", () => {
  it("delivered money proposes completed", () => {
    expect(proposeStage({ stage: "approved", delivered_amount: 120 }, [])).toBe("completed");
  });

  it("no impact recorded stays reported", () => {
    expect(proposeStage({ stage: "evidence" }, [])).toBe("reported");
  });

  it("an open recovery on the same ticket warns", () => {
    const dupes = findDuplicates({ ticket_id: "t1" }, [{ stage: "evidence", ticket_id: "t1" }]);
    expect(dupes.length).toBe(1);
  });

  it("a closed recovery does not warn", () => {
    expect(findDuplicates({ ticket_id: "t1" }, [{ stage: "closed", ticket_id: "t1" }]).length).toBe(0);
  });
});

describe("vocabulary", () => {
  it("only money-moving remedies are monetary", () => {
    expect(isMonetary("apology")).toBe(false);
    expect(isMonetary("partial_refund")).toBe(true);
  });

  it("awaiting approval reads as waiting", () => {
    expect(stageState("awaiting_approval")).toBe("waiting");
  });
});
