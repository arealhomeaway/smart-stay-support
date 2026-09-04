import { describe, expect, it } from "bun:test";
import {
  attentionHeadline,
  needsReviewBeforeClosing,
  supervisorAttention,
  type AttentionApproval,
  type AttentionEscalation,
  type AttentionTicket,
} from "@/lib/supervisor-home";
import { humanizeHistoryText } from "@/lib/ticket-lifecycle";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

function ticket(over: Partial<AttentionTicket>): AttentionTicket {
  return {
    id: crypto.randomUUID(),
    ref: 1,
    title: "t",
    status: "open",
    priority: "p3",
    reported_at: hoursAgo(1),
    ...over,
  };
}

function esc(over: Partial<AttentionEscalation>): AttentionEscalation {
  return {
    id: crypto.randomUUID(),
    ticket_id: null,
    escalated_to_role: "supervisor",
    escalated_by: "u",
    urgency: "normal",
    status: "open",
    reason: "r",
    created_at: hoursAgo(2),
    ...over,
  };
}

const approval = (status: string): AttentionApproval => ({
  id: crypto.randomUUID(),
  title: "a",
  status,
});

function byKey(buckets: ReturnType<typeof supervisorAttention>, key: string) {
  const b = buckets.find((x) => x.key === key);
  if (!b) throw new Error(`missing bucket ${key}`);
  return b;
}

describe("supervisor attention band", () => {
  it("counts unassigned open work only", () => {
    const buckets = supervisorAttention({
      tickets: [
        ticket({}),
        ticket({ assigned_to: "u1" }),
        ticket({ status: "closed" }),
        ticket({ current_action_owner: "u2" }),
      ],
      escalations: [],
      approvals: [],
      isDirector: false,
    });
    expect(byKey(buckets, "unassigned").count).toBe(1);
  });

  it("treats unaccepted handoffs and stale waiting as blockers", () => {
    const buckets = supervisorAttention({
      tickets: [
        ticket({ handoff_status: "pending", assigned_to: "u" }),
        ticket({ status: "waiting", assigned_to: "u" }),
        ticket({ status: "waiting", assigned_to: "u", next_review_at: hoursAgo(-5) }),
      ],
      escalations: [],
      approvals: [],
      isDirector: false,
    });
    expect(byKey(buckets, "blocked").count).toBe(2);
  });

  it("shows a supervisor only escalations at or below their level", () => {
    const escalations = [esc({}), esc({ escalated_to_role: "director" })];
    expect(
      byKey(
        supervisorAttention({ tickets: [], escalations, approvals: [], isDirector: false }),
        "escalations",
      ).count,
    ).toBe(1);
    expect(
      byKey(
        supervisorAttention({ tickets: [], escalations, approvals: [], isDirector: true }),
        "escalations",
      ).count,
    ).toBe(2);
  });

  it("counts only pending approvals", () => {
    const buckets = supervisorAttention({
      tickets: [],
      escalations: [],
      approvals: [approval("pending"), approval("approved")],
      isDirector: false,
    });
    expect(byKey(buckets, "approvals").count).toBe(1);
  });

  it("ages P1 and P2 into the risk bucket", () => {
    const buckets = supervisorAttention({
      tickets: [
        ticket({ priority: "p1", reported_at: hoursAgo(30), assigned_to: "u" }),
        ticket({ priority: "p2", reported_at: hoursAgo(10), assigned_to: "u" }),
      ],
      escalations: [],
      approvals: [],
      isDirector: false,
    });
    expect(byKey(buckets, "risk").count).toBe(1);
  });

  it("only lists resolved work that the review rule actually requires", () => {
    const rows = needsReviewBeforeClosing([
      ticket({ status: "resolved", priority: "p1", closure_qa_result: null }),
      ticket({ status: "resolved", priority: "p1", closure_qa_result: "pass" }),
      ticket({ status: "open", priority: "p1" }),
    ]);
    expect(rows.length).toBe(1);
  });

  it("headline ignores the neutral context tile", () => {
    const quiet = supervisorAttention({
      tickets: [],
      escalations: [esc({ status: "resolved", resolved_at: hoursAgo(4) })],
      approvals: [],
      isDirector: false,
    });
    expect(attentionHeadline(quiet)).toBe("Nothing needs your decision right now.");
  });
});

describe("history reads in plain language", () => {
  it("repairs raw status words stored by older rows", () => {
    expect(humanizeHistoryText("Status changed to in_progress.")).toBe(
      "Status changed to In progress.",
    );
    expect(humanizeHistoryText("Status changed to awaiting_guest.")).toBe(
      "Status changed to Awaiting guest confirmation.",
    );
  });

  it("leaves already-humanized text alone", () => {
    expect(humanizeHistoryText("Status changed to Resolved.")).toBe("Status changed to Resolved.");
  });
});
