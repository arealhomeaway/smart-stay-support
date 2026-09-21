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

  it("leaves closed work orders alone", () => {
    expect(
      vendorDispatchAlerts([wo({ id: "x", closed_at: minutesFromNow(-10), vendor_eta_at: minutesFromNow(-200) })], NOW),
    ).toEqual([]);
  });
});

describe("claim deadline reminders", () => {
  const claim = (over: Partial<ClaimForAlerts> & { id: string }): ClaimForAlerts => ({
    stage: "gathering",
    assigned_to: "u1",
    ...over,
  });

  it("reminds inside the warning window, calls out today, and escalates once passed", () => {
    const alerts = claimDeadlineAlerts(
      [
        claim({ id: "soon", deadline_on: "2026-09-23" }),
        claim({ id: "today", deadline_on: "2026-09-21" }),
        claim({ id: "gone", deadline_on: "2026-09-18" }),
        claim({ id: "far", deadline_on: "2026-10-30" }),
      ],
      NOW,
    );
    expect(alerts.map((a) => [a.entityId, a.kind])).toEqual([
      ["soon", "claim_deadline_soon"],
      ["today", "claim_deadline_soon"],
      ["gone", "claim_deadline_passed"],
    ]);
    expect(alerts[1]!.priority).toBe("urgent");
  });

  it("ignores settled claims", () => {
    expect(
      claimDeadlineAlerts([claim({ id: "done", stage: "recovered", deadline_on: "2026-09-18" })], NOW),
    ).toEqual([]);
  });
});

describe("one alert per record per stage", () => {
  it("drops anything already sent and any duplicate in the same pass", () => {
    const alerts = claimDeadlineAlerts(
      [
        { id: "c1", stage: "gathering", assigned_to: "u1", deadline_on: "2026-09-22" },
        { id: "c1", stage: "gathering", assigned_to: "u1", deadline_on: "2026-09-22" },
        { id: "c2", stage: "gathering", assigned_to: "u1", deadline_on: "2026-09-22" },
      ],
      NOW,
    );
    const sent = new Set([
      alertKey({ kind: "claim_deadline_soon", userId: "u1", entityId: "c2" }),
    ]);
    expect(newAlerts(alerts, sent).map((a) => a.entityId)).toEqual(["c1"]);
  });
});
