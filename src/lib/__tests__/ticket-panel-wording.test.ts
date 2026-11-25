import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { ticketCurrentAction, type CurrentActionInput } from "@/lib/ticket-current-action";

const base: CurrentActionInput = {
  status: "open",
  acknowledged_at: null,
  action_started_at: null,
};

describe("reply-clock wording in the ticket panel (Emily, Nov 25)", () => {
  it("a guest message ticket keeps the response clock wording", () => {
    const a = ticketCurrentAction({ ...base, guestWaiting: true });
    expect(a?.id).toBe("acknowledge");
    expect(a?.because).toContain("response clock");
  });

  it("a ticket with no guest waiting says: Take it to show you own this.", () => {
    const a = ticketCurrentAction({ ...base, guestWaiting: false });
    expect(a?.id).toBe("acknowledge");
    expect(a?.because).toBe("Take it to show you own this.");
    expect(a?.because).not.toContain("clock");
    expect(a?.because).not.toContain("confirmed");
  });

  it("the parked line drops the response timer only when no guest is waiting", () => {
    const waiting: CurrentActionInput = {
      status: "waiting",
      acknowledged_at: "2026-11-01T10:00:00Z",
      action_started_at: "2026-11-01T10:05:00Z",
      waiting_on: "vendor",
    };
    expect(ticketCurrentAction({ ...waiting, guestWaiting: true })?.because).toContain(
      "response timer is paused",
    );
    expect(ticketCurrentAction({ ...waiting, guestWaiting: false })?.because).not.toContain(
      "response timer",
    );
  });

  it("the panel passes guestIsWaiting into the Current Action", () => {
    const src = readFileSync("src/routes/_authenticated/tickets.$ticketId.tsx", "utf8");
    expect(src).toContain("guestWaiting: guestIsWaiting(ticket)");
  });

  it("the panel waiting section shows the paused-timer line only for guest tickets", () => {
    const src = readFileSync("src/routes/_authenticated/tickets.$ticketId.tsx", "utf8");
    expect(src).toContain("ticket.next_review_at && guestIsWaiting(ticket)");
  });
});

describe("Oversight legacy sections stay hidden (Emily, Nov 25)", () => {
  const src = readFileSync("src/routes/_authenticated/oversight.tsx", "utf8");

  it("the legacy block is gated off, not deleted", () => {
    expect(src).toContain("const SHOW_LEGACY_SECTIONS = false;");
    expect(src).toContain("SHOW_LEGACY_SECTIONS ? (");
  });

  it("the older sections are still in the code behind the gate", () => {
    expect(src).toContain("OnCallNowCard");
    expect(src).toContain("Workload by person");
    expect(src).toContain("oversight-table");
    expect(src).toContain("Where the work sits");
  });

  it("the four new sections, arrival checks card and All open tickets are untouched", () => {
    expect(src).toContain("<OversightSections");
    expect(src).toContain("<OverdueArrivalChecksCard");
    expect(src).toContain("AllOpenTicketsTable");
  });
});
