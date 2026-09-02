import { describe, expect, it } from "bun:test";
import {
  evaluateAuthority,
  evidenceSlots,
  findDuplicates,
  isMonetary,
  nextAction,
  precedentCeiling,
  proposeStage,
  slotsForReimbursement,
  stageState,
} from "@/lib/guest-recovery";

const req = (slot: string, status: string, required = true) => ({
  slot_key: slot,
  label: slot,
  status,
  required,
}) as never;

describe("authority", () => {
  it("apology is always within your own authority", () => {
    const v = evaluateAuthority({ recovery_action: "apology" });
    expect(v.level).toBe("self");
    expect(v.policyGap).toBe(false);
  });

  it("precedent is 30% of nightly rate per impacted night", () => {
    expect(precedentCeiling({ nightly_rate: 200, impacted_nights: 2 })).toBe(120);
  });

  it("safety event uses 50% of the first night", () => {
    expect(precedentCeiling({ nightly_rate: 300, safety_event: true })).toBe(150);
  });

  it("amount within precedent stays with the coordinator", () => {
    const v = evaluateAuthority({
      recovery_action: "partial_refund",
      nightly_rate: 200,
      impacted_nights: 2,
      proposed_amount: 100,
    });
    expect(v.level).toBe("self");
  });

  it("amount above precedent escalates to director and says why", () => {
    const v = evaluateAuthority({
      recovery_action: "partial_refund",
      nightly_rate: 200,
      impacted_nights: 1,
      proposed_amount: 400,
    });
    expect(v.level).toBe("director");
    expect(v.policyGap).toBe(true);
    expect(v.reason).toContain("exceeds the documented precedent");
  });

  it("missing nightly rate cannot be checked, so a supervisor signs off", () => {
    const v = evaluateAuthority({ recovery_action: "credit", proposed_amount: 75 });
    expect(v.level).toBe("supervisor");
    expect(v.precedentAmount).toBeNull();
  });

  it("full refund and relocation are leadership decisions with no documented threshold", () => {
    for (const action of ["full_refund", "relocation", "shorten_stay"] as const) {
      const v = evaluateAuthority({ recovery_action: action, proposed_amount: 10 });
      expect(v.level).toBe("director");
      expect(v.policyGap).toBe(true);
    }
  });

  it("emergency proceeds and notifies", () => {
    expect(evaluateAuthority({ recovery_action: "relocation", emergency: true }).level).toBe("emergency");
  });
});

describe("evidence", () => {
  it("apology needs no impact photo, a refund does", () => {
    expect(evidenceSlots("apology").map((s) => s.key)).not.toContain("impact_proof");
    expect(evidenceSlots("partial_refund").map((s) => s.key)).toContain("impact_proof");
  });

  it("reimbursement adds the guest receipt", () => {
    expect(slotsForReimbursement("partial_refund").map((s) => s.key)).toContain("guest_receipt");
  });
});

describe("next action", () => {
  it("starts by confirming the impact", () => {
    expect(nextAction({ stage: "reported" })).toContain("Confirm the impact");
  });

  it("waits on blocking evidence", () => {
    const action = nextAction(
      { stage: "evidence", impact_detail: "No hot water" },
      { requirements: [req("impact_proof", "awaiting")] },
    );
    expect(action).toContain("Waiting on evidence");
  });

  it("asks for the remedy once evidence is met", () => {
    const action = nextAction(
      { stage: "evidence", impact_detail: "No hot water" },
      { requirements: [req("impact_proof", "verified")] },
    );
    expect(action).toContain("Decide the remedy");
  });

  it("asks for an amount on a monetary remedy", () => {
    const action = nextAction({
      stage: "decision_drafted",
      impact_detail: "x",
      recovery_action: "partial_refund",
    });
    expect(action).toContain("proposed amount");
  });

  it("routes to director when above precedent", () => {
    const action = nextAction({
      stage: "decision_drafted",
      impact_detail: "x",
      recovery_action: "partial_refund",
      nightly_rate: 100,
      impacted_nights: 1,
      proposed_amount: 500,
    });
    expect(action).toContain("Director approval");
  });

  it("checkout within a day raises urgency", () => {
    const now = new Date("2026-03-10T12:00:00");
    const action = nextAction(
      {
        stage: "decision_drafted",
        impact_detail: "x",
        recovery_action: "partial_refund",
        nightly_rate: 200,
        impacted_nights: 1,
        proposed_amount: 50,
        stay_departure: "2026-03-11",
      },
      { now },
    );
    expect(action).toContain("checks out");
  });

  it("a disputed guest gets a call, whatever the stage", () => {
    expect(nextAction({ stage: "guest_offered", outcome: "guest_disputed" })).toContain("Call them");
  });

  it("closed recoveries have nothing outstanding", () => {
    expect(nextAction({ stage: "closed" })).toContain("Closed");
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
