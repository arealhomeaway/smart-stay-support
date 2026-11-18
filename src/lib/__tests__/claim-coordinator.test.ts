import { describe, expect, it } from "bun:test";
import { deadlineLine, defaultFilingDeadline, filingPlatform, filingReminderReached, lineItemsTotal, reminderRecipient } from "@/lib/claim-coordinator";

describe("filing deadline default", () => {
  it("Airbnb gets checkout + 14 days", () => expect(defaultFilingDeadline("2026-11-16", "Airbnb")).toBe("2026-11-30"));
  it("Vrbo gets checkout + 14 days", () => expect(defaultFilingDeadline("2026-11-20", "VRBO")).toBe("2026-12-04"));
  it("falls back to the reservation channel", () => expect(defaultFilingDeadline("2026-11-16", null, "airbnb")).toBe("2026-11-30"));
  it("direct, MTR lease and other sources get no default", () => {
    for (const s of ["Direct", "MTR lease", "Booking.com", null]) expect(defaultFilingDeadline("2026-11-16", s)).toBeNull();
    expect(filingPlatform("MTR lease")).toBeNull();
  });
  it("reads as a plain date or needs verification", () => {
    expect(deadlineLine({ deadline_on: "2026-11-30", deadline_source: "platform_default" })).toMatch(/^File by Nov 30/);
    expect(deadlineLine({ deadline_on: "2026-11-30", booking_source: "Direct", deadline_verified: false })).toBe("Deadline needs verification");
    expect(deadlineLine({ booking_source: "Direct", stay_departure: "2026-11-16" })).toBe("Deadline needs verification");
  });
});

describe("filing reminder window (Chicago)", () => {
  const base = { stage: "gathering", deadline_on: "2026-11-30", deadline_verified: true };
  it("starts 3 days before the deadline in Chicago time", () => {
    expect(filingReminderReached(base, new Date("2026-11-27T05:30:00Z"))).toBe(false); // Nov 26 in Chicago
    expect(filingReminderReached(base, new Date("2026-11-27T06:30:00Z"))).toBe(true); // Nov 27 in Chicago
  });
  it("ends at Submitted", () => expect(filingReminderReached({ ...base, stage: "submitted" }, new Date("2026-11-28T12:00:00Z"))).toBe(false));
  it("owner first, else the Operations Supervisor", () => {
    expect(reminderRecipient("owner", "sup")).toBe("owner");
    expect(reminderRecipient(null, "sup")).toBe("sup");
  });
});

describe("line items", () => {
  it("totals to the cent", () => expect(lineItemsTotal([{ issue: "Rug", amount_requested: "120.10" }, { issue: "Lamp", amount_requested: 0.2 }])).toBe(120.3));
});
