import { describe, expect, it } from "bun:test";
import {
  amountAtRisk,
  claimBucket,
  deadlineState,
  evidenceProgress,
  evidenceSlots,
  findDuplicates,
  matchesFilter,
  nextAction,
  proposeStage,
  unrecovered,
  type DuplicateCandidate,
  type ClaimLike,
  type RequirementLike,
} from "@/lib/claims";

const NOW = new Date("2026-03-10T12:00:00Z");

function claim(over: Partial<DuplicateCandidate> = {}): DuplicateCandidate {
  return { claim_type: "channel_aircover", stage: "gathering", ...over };
}

function reqs(...parts: Array<Partial<RequirementLike>>): RequirementLike[] {
  return parts.map((p, i) => ({ slot_key: `slot_${i}`, required: true, status: "awaiting", ...p }));
}

describe("evidence", () => {
  it("names a checklist per claim type", () => {
    expect(evidenceSlots("owner_recovery").some((s) => s.key === "owner_approval")).toBe(true);
    expect(evidenceSlots("insurance").some((s) => s.key === "guest_comms")).toBe(false);
  });

  it("counts only required, unmet slots as blocking", () => {
    const p = evidenceProgress(
      reqs({ status: "verified" }, { status: "awaiting", required: false }, { status: "awaiting" }),
    );
    expect(p.blocking).length).toBe(1);
    expect(p.complete).toBe(false);
  });

  it("accepts an exception as met", () => {
    expect(evidenceProgress(reqs({ status: "accepted_exception" })).complete).toBe(true);
  });
});

describe("deadlines", () => {
  it("classifies overdue, today and approaching", () => {
    expect(deadlineState("2026-03-01", NOW)).toBe("overdue");
    expect(deadlineState("2026-03-10", NOW)).toBe("today");
    expect(deadlineState("2026-03-14", NOW)).toBe("approaching");
    expect(deadlineState("2026-05-01", NOW)).toBe("scheduled");
    expect(deadlineState(null, NOW)).toBe("none");
  });
});

describe("money", () => {
  it("uses the most committed figure available", () => {
    expect(amountAtRisk(claim({ estimated_amount: 100 }))).toBe(100);
    expect(amountAtRisk(claim({ estimated_amount: 100, actual_cost: 250 }))).toBe(250);
    expect(amountAtRisk(claim({ estimated_amount: 100, actual_cost: 250, submitted_amount: 300 }))).toBe(300);
  });

  it("derives unrecovered without inventing figures", () => {
    expect(unrecovered(claim({ submitted_amount: 300, recovered_amount: 120 }))).toBe(180);
    expect(unrecovered(claim({ submitted_amount: 300, recovered_amount: 400 }))).toBe(0);
    expect(unrecovered(claim({}))).toBeNull();
  });
});

describe("next action", () => {
  it("asks for the first missing evidence while gathering", () => {
    const action = nextAction(claim(), { requirements: reqs({ label: "Damage photos" }) });
    expect(action).toBe("Upload Damage photos");
  });

  it("asks for cost once evidence is in", () => {
    expect(nextAction(claim({ stage: "costing" }))).toBe("Get vendor estimate or invoice");
  });

  it("names the counterparty while waiting", () => {
    expect(nextAction(claim({ stage: "waiting_external" }))).toBe("Waiting on Airbnb");
  });

  it("pushes a follow-up once the follow-up date has passed", () => {
    expect(
      nextAction(claim({ stage: "waiting_external", follow_up_on: "2026-03-01" }), { now: NOW }),
    ).toBe("Follow up with Airbnb");
  });

  it("chases reimbursement after a partial approval", () => {
    expect(
      nextAction(claim({ stage: "decided", disposition: "partial", approved_amount: 200, recovered_amount: 0 })),
    ).toBe("Confirm reimbursement received");
  });
});

describe("proposed stage", () => {
  it("suggests costing once evidence is complete", () => {
    expect(proposeStage(claim(), reqs({ status: "verified" }))).toBe("costing");
  });

  it("suggests submitting once cost is known", () => {
    expect(proposeStage(claim({ actual_cost: 400 }), reqs({ status: "verified" }))).toBe("ready_to_submit");
  });

  it("never advances a claim that is waiting on someone else", () => {
    expect(proposeStage(claim({ stage: "submitted", actual_cost: 1 }), reqs({ status: "verified" }))).toBe("submitted");
  });
});

describe("home buckets", () => {
  it("puts a passed deadline in needs attention", () => {
    expect(claimBucket(claim({ deadline_on: "2026-03-01" }), { now: NOW })).toBe("needs_attention");
  });

  it("separates deadline risk from evidence gaps", () => {
    expect(claimBucket(claim({ deadline_on: "2026-03-13" }), { now: NOW })).toBe("deadline_approaching");
    expect(claimBucket(claim(), { now: NOW, requirements: reqs({}) })).toBe("evidence_missing");
  });

  it("keeps external waits out of the working queues", () => {
    expect(claimBucket(claim({ stage: "submitted" }), { now: NOW })).toBe("waiting_external");
  });

  it("drops closed claims and keeps recent recoveries", () => {
    expect(claimBucket(claim({ stage: "closed" }), { now: NOW })).toBeNull();
    expect(
      claimBucket(claim({ stage: "recovered", recovered_on: "2026-03-05" }), { now: NOW }),
    ).toBe("recently_recovered");
  });
});

describe("manager filters", () => {
  it("finds unsubmitted and long waits", () => {
    expect(matchesFilter(claim(), "unsubmitted", { now: NOW })).toBe(true);
    expect(
      matchesFilter(claim({ stage: "waiting_external", submitted_on: "2026-02-01" }), "long_wait", { now: NOW }),
    ).toBe(true);
  });

  it("flags high value and poor outcomes", () => {
    expect(matchesFilter(claim({ submitted_amount: 2500 }), "high_value", { now: NOW })).toBe(true);
    expect(matchesFilter(claim({ disposition: "denied" }), "denied_partial", { now: NOW })).toBe(true);
  });
});

describe("duplicate protection", () => {
  const existing = [
    claim({ id: "a", stage: "gathering", ticket_id: "t1", property_id: "p1", ownerrez_booking_id: "b1" }),
  ];

  it("warns about a second claim on the same ticket", () => {
    expect(findDuplicates({ ticket_id: "t1" }, existing)).length).toBe(1);
  });

  it("warns about the same claim type on the same stay", () => {
    expect(
      findDuplicates(
        { claim_type: "channel_aircover", property_id: "p1", ownerrez_booking_id: "b1" },
        existing,
      ),
    ).length).toBe(1);
  });

  it("allows a different recovery path for the same stay", () => {
    expect(
      findDuplicates({ claim_type: "insurance", property_id: "p1", ownerrez_booking_id: "b1" }, existing),
    ).length).toBe(0);
  });

  it("ignores claims that are already finished", () => {
    expect(findDuplicates({ ticket_id: "t1" }, [claim({ stage: "closed", ticket_id: "t1" })])).length).toBe(0);
  });
});
