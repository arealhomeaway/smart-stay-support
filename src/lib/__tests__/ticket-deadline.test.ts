import { describe, expect, it } from "bun:test";
import { dueCell } from "@/lib/ticket-table";
import { guestIsWaiting, ticketDueDay, ticketLate } from "@/lib/ticket-deadline";

const now = new Date("2026-11-25T18:00:00Z");
const past = "2026-11-20T12:00:00Z";

describe("one deadline per ticket", () => {
  it("only guest messages have a guest waiting", () => {
    expect(guestIsWaiting({ source_channel: "guest_message" })).toBe(true);
    for (const c of ["breezeway", "internal", "ownerrez", "email", "inspection", null]) expect(guestIsWaiting({ source_channel: c })).toBe(false);
  });
  it("a Breezeway ticket with a passed reply clock shows its due date and is not late", () => {
    const t = { status: "open", source_channel: "breezeway", response_due_at: past, due_on: "2026-11-28" };
    expect(dueCell(t, now).line1).not.toBe("Reply now");
    expect(dueCell(t, now).overdue).toBe(false);
    expect(ticketLate(t, now)).toBe(false);
    expect(ticketDueDay(t)).toBe("2026-11-28");
  });
  it("a non-guest ticket past its due date is late", () => {
    expect(ticketLate({ status: "open", source_channel: "internal", due_on: "2026-11-24" }, now)).toBe(true);
  });
  it("a guest message keeps the reply clock", () => {
    const t = { status: "open", source_channel: "guest_message", response_due_at: past, due_on: "2026-11-28" };
    expect(dueCell(t, now).line1).toBe("Reply now");
    expect(ticketLate(t, now)).toBe(true);
  });
});
