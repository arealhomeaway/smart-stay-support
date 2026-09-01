import { describe, expect, it } from "bun:test";
import {
  attentionFlags,
  followUpBucket,
  leadAnalytics,
  leadSort,
  nextAction,
  nextFollowUpAt,
  proposeStage,
  queueBucket,
  isOpen,
  type LeadLike,
  type LeadStage,
} from "@/lib/leads";

const NOW = new Date("2026-09-10T15:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

function lead(patch: Partial<LeadLike> & { stage: LeadStage }): LeadLike {
  return {
    created_at: daysAgo(1),
    last_contact_at: null,
    assigned_to: "user-1",
    ...patch,
  };
}

describe("follow-up clock", () => {
  it("counts from the last contact, using the stage interval", () => {
    const l = lead({ stage: "first_contact", last_contact_at: daysAgo(1) });
    const due = nextFollowUpAt(l)!;
    expect(due.toISOString()).toBe(new Date(NOW.getTime() + 86_400_000).toISOString());
  });

  it("counts from creation while nothing has been sent", () => {
    const l = lead({ stage: "new", created_at: daysAgo(3) });
    expect(followUpBucket(l, NOW)).toBe("overdue");
  });

  it("stops entirely once converted or lost", () => {
    expect(nextFollowUpAt(lead({ stage: "converted" }))).toBeNull();
    expect(followUpBucket(lead({ stage: "lost" }), NOW)).toBe("none");
  });

  it("uses the approved intervals per stage", () => {
    expect(followUpBucket(lead({ stage: "follow_up_1", last_contact_at: daysAgo(3) }), NOW)).toBe("upcoming");
    expect(followUpBucket(lead({ stage: "follow_up_1", last_contact_at: daysAgo(5) }), NOW)).toBe("overdue");
    expect(followUpBucket(lead({ stage: "final_follow_up", last_contact_at: daysAgo(6) }), NOW)).toBe("upcoming");
    expect(followUpBucket(lead({ stage: "engaged", last_contact_at: daysAgo(4) }), NOW)).toBe("overdue");
  });
});

describe("stage progression", () => {
  it("advances one step per logged contact and never past the final follow-up", () => {
    expect(proposeStage("new", "email")).toBe("first_contact");
    expect(proposeStage("first_contact", "call")).toBe("follow_up_1");
    expect(proposeStage("follow_up_1", "text")).toBe("final_follow_up");
    expect(proposeStage("final_follow_up", "call")).toBe("final_follow_up");
  });

  it("never moves the stage for a plain note", () => {
    expect(proposeStage("new", "note")).toBe("new");
  });

  it("leaves engaged and booking-pending alone", () => {
    expect(proposeStage("engaged", "call")).toBe("engaged");
    expect(proposeStage("booking_pending", "email")).toBe("booking_pending");
  });

  it("treats only converted and lost as closed", () => {
    expect(isOpen("booking_pending")).toBe(true);
    expect(isOpen("converted")).toBe(false);
    expect(isOpen("lost")).toBe(false);
  });
});

describe("next action", () => {
  it("asks for a first response on a new lead", () => {
    expect(nextAction(lead({ stage: "new" }), { now: NOW })).toBe("Send first response");
  });

  it("asks the employee to decide once the final follow-up lapses", () => {
    const l = lead({ stage: "final_follow_up", last_contact_at: daysAgo(9) });
    expect(nextAction(l, { now: NOW })).toContain("close as lost or keep open");
  });

  it("respects a recorded decision to keep the lead open", () => {
    const l = lead({ stage: "final_follow_up", last_contact_at: daysAgo(9), keep_open_reason: "Awaiting adjuster" });
    expect(nextAction(l, { now: NOW })).toContain("Still open by decision");
  });

  it("asks for property matches before a quote", () => {
    expect(nextAction(lead({ stage: "engaged" }), { now: NOW, hasProperty: false })).toBe(
      "Find available properties",
    );
    expect(nextAction(lead({ stage: "engaged" }), { now: NOW, hasProperty: true })).toBe(
      "Send property options and quote",
    );
  });
});

describe("attention flags", () => {
  it("flags unassigned open leads", () => {
    const flags = attentionFlags(lead({ stage: "new", assigned_to: null }), { now: NOW });
    expect(flags.map((f) => f.key)).toContain("unassigned");
  });

  it("flags an imminent move-in with no property match", () => {
    const l = lead({ stage: "engaged", last_contact_at: daysAgo(1), desired_move_in: "2026-09-14" });
    expect(attentionFlags(l, { now: NOW, hasProperty: false }).map((f) => f.key)).toContain("move_in");
  });

  it("says nothing about closed leads", () => {
    expect(attentionFlags(lead({ stage: "converted", assigned_to: null }), { now: NOW })).toHaveLength(0);
  });
});

describe("queue", () => {
  it("puts overdue work first and closed leads nowhere", () => {
    expect(queueBucket(lead({ stage: "first_contact", last_contact_at: daysAgo(5) }), NOW)).toBe("overdue");
    expect(queueBucket(lead({ stage: "new", created_at: NOW.toISOString() }), NOW)).toBe("new");
    expect(queueBucket(lead({ stage: "booking_pending", last_contact_at: daysAgo(1) }), NOW)).toBe("waiting");
    expect(queueBucket(lead({ stage: "lost" }), NOW)).toBeNull();
  });

  it("sorts by the soonest follow-up", () => {
    const a = lead({ stage: "first_contact", last_contact_at: daysAgo(5) });
    const b = lead({ stage: "first_contact", last_contact_at: daysAgo(0) });
    expect([b, a].sort(leadSort)[0]).toBe(a);
  });
});

describe("analytics", () => {
  const rows = [
    { ...lead({ stage: "converted" }), source: "insurance", market: "Houston", lost_reason: null, quote_amount: 5000, converted_at: NOW.toISOString(), created_at: daysAgo(10) },
    { ...lead({ stage: "lost" }), source: "website", market: "Houston", lost_reason: "budget_too_low" },
    { ...lead({ stage: "first_contact", last_contact_at: daysAgo(5) }), source: "insurance", market: "Dallas", lost_reason: null },
  ] as never[];

  it("reports conversion, revenue and compliance from real rows only", () => {
    const a = leadAnalytics(rows, NOW);
    expect(a.received).toBe(3);
    expect(a.converted).toBe(1);
    expect(a.conversionRate).toBeCloseTo(1 / 3);
    expect(a.convertedRevenue).toBe(5000);
    expect(a.followUpCompliance).toBe(0); // the single open lead is overdue
    expect(a.avgDaysToConversion).toBeCloseTo(10);
    expect(a.lossReasons[0]?.key).toBe("budget_too_low");
    expect(a.bySource[0]?.count).toBe(2);
  });
});
