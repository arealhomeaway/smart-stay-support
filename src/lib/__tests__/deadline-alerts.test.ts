import { describe, expect, it } from "bun:test";
import {
  claimDeadlineAlerts,
  newAlerts,
  alertKey,
  ticketSlaAlerts,
  vendorDispatchAlerts,
  type ClaimForAlerts,
  type TicketForAlerts,
  type WorkOrderForAlerts,
} from "@/lib/deadline-alerts";

const NOW = new Date("2026-09-21T12:00:00.000Z");
const minutesFromNow = (m: number) => new Date(NOW.getTime() + m * 60_000).toISOString();

function ticket(over: Partial<TicketForAlerts> & { id: string }): TicketForAlerts {
  return { status: "in_progress", assigned_to: "u1", ...over };
}

describe("SLA breach warnings", () => {
  it("warns shortly before a clock runs out and escalates once it has", () => {
    const alerts = ticketSlaAlerts(
      [
        ticket({ id: "soon", ref: "T-1", response_due_at: minutesFromNow(20) }),
        ticket({ id: "late", ref: "T-2", response_due_at: minutesFromNow(-90) }),
        ticket({ id: "plenty", response_due_at: minutesFromNow(600) }),
      ],
      NOW,
    );
    expect(alerts.map((a) => a.kind)).toEqual(["sla_response_warning", "sla_response_breached"]);
    expect(alerts[1]!.priority).toBe("urgent");
    expect(alerts[1]!.linkPath).toBe("/tickets/late");
  });

  it("says nothing once the clock has been satisfied, or the ticket is closed or unassigned", () => {
    const alerts = ticketSlaAlerts(
      [
        ticket({ id: "done", response_due_at: minutesFromNow(-60), acknowledged_at: minutesFromNow(-70) }),
        ticket({ id: "closed", status: "closed", response_due_at: minutesFromNow(-60) }),
        ticket({ id: "nobody", assigned_to: null, response_due_at: minutesFromNow(-60) }),
      ],
      NOW,
    );
    expect(alerts).toEqual([]);
  });

  it("tracks the work-start clock separately from acknowledgement", () => {
    const alerts = ticketSlaAlerts(
      [
        ticket({
          id: "t",
          acknowledged_at: minutesFromNow(-100),
          response_due_at: minutesFromNow(-120),
          action_due_at: minutesFromNow(-10),
        }),
      ],
      NOW,
    );
    expect(alerts.map((a) => a.kind)).toEqual(["sla_action_breached"]);
  });
});

describe("missed vendor dispatch", () => {
  const wo = (over: Partial<WorkOrderForAlerts> & { id: string }): WorkOrderForAlerts => ({
    assigned_to: "u1",
    acknowledge_minutes: 60,
    ...over,
  });

  it("flags a vendor that never confirmed inside the window", () => {
    const alerts = vendorDispatchAlerts(
      [
        wo({ id: "silent", vendor_name: "Ace Plumbing", vendor_contacted_at: minutesFromNow(-180) }),
        wo({ id: "fresh", vendor_contacted_at: minutesFromNow(-10) }),
        wo({
          id: "confirmed",
          vendor_contacted_at: minutesFromNow(-180),
          vendor_acknowledged_at: minutesFromNow(-120),
        }),
      ],
      NOW,
    );
    expect(alerts.map((a) => a.entityId)).toEqual(["silent"]);
    expect(alerts[0]!.kind).toBe("vendor_no_acknowledgment");
    expect(alerts[0]!.title).toContain("Ace Plumbing");
  });

  it("flags a passed arrival time with nobody on site, and stays quiet once they arrive", () => {
    const alerts = vendorDispatchAlerts(
      [
        wo({ id: "late", vendor_acknowledged_at: minutesFromNow(-200), vendor_eta_at: minutesFromNow(-45) }),
        wo({
          id: "arrived",
          vendor_acknowledged_at: minutesFromNow(-200),
          vendor_eta_at: minutesFromNow(-45),
          vendor_arrived_at: minutesFromNow(-40),
        }),
        wo({ id: "upcoming", vendor_acknowledged_at: minutesFromNow(-10), vendor_eta_at: minutesFromNow(120) }),
      ],
      NOW,
    );
    expect(alerts.map((a) => a.entityId)).toEqual(["late"]);
    expect(alerts[0]!.kind).toBe("vendor_missed_eta");
    expect(alerts[0]!.linkPath).toBe("/work-orders?open=late");
  });

  it("leaves closed Work Orders alone", () => {
    expect(
      vendorDispatchAlerts([wo({ id: "x", closed_at: minutesFromNow(-10), vendor_eta_at: minutesFromNow(-200) })], NOW),
    ).toEqual([]);
  });
});

describe("claim filing reminder (Nov 18 rule)", () => {
  const claim = (over: Partial<ClaimForAlerts> & { id: string }): ClaimForAlerts => ({
    stage: "gathering",
    assigned_to: "u1",
    deadline_verified: true,
    ...over,
  });

  it("reminds the owner from 3 days before through the day before, normal priority", () => {
    const alerts = claimDeadlineAlerts(
      [
        claim({ id: "three", deadline_on: "2026-09-24" }),
        claim({ id: "four", deadline_on: "2026-09-25" }),
        claim({ id: "tomorrow", deadline_on: "2026-09-22" }),
      ],
      NOW,
    );
    expect(alerts.map((a) => [a.entityId, a.kind, a.userId, a.priority])).toEqual([
      ["three", "claim_filing_reminder", "u1", "normal"],
      ["tomorrow", "claim_filing_reminder", "u1", "normal"],
    ]);
  });

  // Nov 23 rule: one overdue alert the day after the deadline (Chicago), nothing on the day itself.
  it("sends nothing on the deadline day itself", () => {
    expect(claimDeadlineAlerts([claim({ id: "today", deadline_on: "2026-09-21" })], NOW)).toEqual([]);
  });

  it("sends one overdue alert the day after the deadline, normal priority, to the owner", () => {
    const alerts = claimDeadlineAlerts([claim({ id: "late", deadline_on: "2026-09-20" })], NOW, "sup");
    expect(alerts.map((a) => [a.entityId, a.kind, a.userId, a.priority])).toEqual([["late", "claim_filing_overdue", "u1", "normal"]]);
    expect(alerts[0]!.title).toContain("Not filed by Sep 20");
  });

  it("sends no overdue alert two or more days after the deadline", () => {
    expect(claimDeadlineAlerts([claim({ id: "old", deadline_on: "2026-09-19" }), claim({ id: "older", deadline_on: "2026-09-01" })], NOW, "sup")).toEqual([]);
  });

  it("uses the Chicago date for the day after: 11:30 PM Central on the deadline day is still nothing", () => {
    // 2026-09-21T04:30Z is Sep 20, 11:30 PM in Chicago.
    expect(claimDeadlineAlerts([claim({ id: "c", deadline_on: "2026-09-20" })], new Date("2026-09-21T04:30:00Z"))).toEqual([]);
    expect(claimDeadlineAlerts([claim({ id: "c", deadline_on: "2026-09-20" })], new Date("2026-09-21T05:30:00Z"))).toHaveLength(1);
  });

  it("sends an unowned overdue claim to the Operations Supervisor, and nothing after Submitted or unverified", () => {
    expect(claimDeadlineAlerts([claim({ id: "u", assigned_to: null, deadline_on: "2026-09-20" })], NOW, "sup").map((a) => a.userId)).toEqual(["sup"]);
    expect(claimDeadlineAlerts([
      claim({ id: "s", stage: "submitted", deadline_on: "2026-09-20" }),
      claim({ id: "v", deadline_verified: false, deadline_source: null, deadline_on: "2026-09-20" }),
    ], NOW, "sup")).toEqual([]);
  });

  it("an unowned demo claim goes to the demo stand-in, never the real Supervisor", () => {
    const demo = claim({ id: "d", assigned_to: null, deadline_on: "2026-09-20", is_demo: true });
    expect(claimDeadlineAlerts([demo], NOW, "sup", "demo-sup").map((a) => [a.userId, a.isDemo])).toEqual([["demo-sup", true]]);
    expect(claimDeadlineAlerts([demo], NOW, "sup", null)).toEqual([]);
  });

  it("sends an unowned claim to the Operations Supervisor", () => {
    const alerts = claimDeadlineAlerts([claim({ id: "c", assigned_to: null, deadline_on: "2026-09-23" })], NOW, "sup");
    expect(alerts.map((a) => a.userId)).toEqual(["sup"]);
  });

  it("sends nothing once Submitted or when the deadline needs verification", () => {
    expect(claimDeadlineAlerts([
      claim({ id: "s", stage: "submitted", deadline_on: "2026-09-23" }),
      claim({ id: "v", deadline_verified: false, deadline_source: null, deadline_on: "2026-09-23" }),
    ], NOW, "sup")).toEqual([]);
  });

  it("treats an Airbnb/Vrbo default deadline as known", () => {
    const alerts = claimDeadlineAlerts([claim({ id: "d", deadline_verified: false, deadline_source: "platform_default", deadline_on: "2026-09-23" })], NOW);
    expect(alerts).toHaveLength(1);
  });
});

describe("one alert per record per stage", () => {
  it("fires a filing reminder once per claim and deadline date, and again for a new date", () => {
    const first = claimDeadlineAlerts([claim2("c1", "2026-09-22"), claim2("c1", "2026-09-22")], NOW);
    expect(newAlerts(first, new Set()).length).toBe(1);
    const sent = new Set(first.map((a) => alertKey(a)));
    expect(newAlerts(claimDeadlineAlerts([{ ...claim2("c1", "2026-09-22"), assigned_to: "u2" }], NOW), sent)).toEqual([]);
    expect(newAlerts(claimDeadlineAlerts([claim2("c1", "2026-09-23")], NOW), sent).length).toBe(1);
  });

  it("fires one overdue alert per claim and deadline date, separate from the reminder", () => {
    const reminder = claimDeadlineAlerts([claim2("c1", "2026-09-22")], NOW);
    const sent = new Set(reminder.map((a) => alertKey(a)));
    const dayAfter = new Date("2026-09-23T12:00:00Z");
    const overdue = claimDeadlineAlerts([claim2("c1", "2026-09-22")], dayAfter);
    expect(newAlerts(overdue, sent).map((a) => a.kind)).toEqual(["claim_filing_overdue"]);
    overdue.forEach((a) => sent.add(alertKey(a)));
    expect(newAlerts(claimDeadlineAlerts([{ ...claim2("c1", "2026-09-22"), assigned_to: "u2" }], dayAfter), sent)).toEqual([]);
  });
});
function claim2(id: string, deadline_on: string): ClaimForAlerts {
  return { id, stage: "gathering", assigned_to: "u1", deadline_on, deadline_verified: true };
}
