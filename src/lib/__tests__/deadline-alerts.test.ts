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

  it("reminds the owner once from 3 days before, normal priority, never overdue alerts", () => {
    const alerts = claimDeadlineAlerts(
      [
        claim({ id: "three", deadline_on: "2026-09-24" }),
        claim({ id: "four", deadline_on: "2026-09-25" }),
        claim({ id: "gone", deadline_on: "2026-09-18" }),
      ],
      NOW,
    );
    expect(alerts.map((a) => [a.entityId, a.kind, a.userId, a.priority])).toEqual([
      ["three", "claim_filing_reminder", "u1", "normal"],
      ["gone", "claim_filing_reminder", "u1", "normal"],
    ]);
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
});
function claim2(id: string, deadline_on: string): ClaimForAlerts {
  return { id, stage: "gathering", assigned_to: "u1", deadline_on, deadline_verified: true };
}
