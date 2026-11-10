import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  ARRIVAL_COPY,
  arrivalDueLine,
  arrivalIngestRow,
  arrivalTime,
  arrivalTotals,
  filterArrivalRows,
  isArrivalCheckTicket,
  isArrivalTestTicket,
  type ArrivalRow,
} from "@/lib/arrival-check";
import { ticketShownInLens } from "@/lib/email-intake";
import { needsYouNow, type HomeTicket } from "@/lib/home-work";
import { databaseMode } from "@/lib/databases";

/** Build 12 (Emily, Nov 10; register BN4, BN10; docs/specs/arrival-check.md). */
const row = (over: Partial<ArrivalRow>): ArrivalRow => ({
  id: "a", home_label: "1 Maple St", property_id: "h1", arrival_on: "2026-11-20",
  check_in_at: "2026-11-20T21:00:00Z", deadline_at: "2026-11-20T19:00:00Z", time_zone: "America/New_York",
  team: "property_operations", status: "complete", result: "on_time", outcome: "ready", issue_text: null,
  backup_plan: null, completed_by: "u1", completed_at: "2026-11-20T18:00:00Z", ticket_id: "t1",
  late_booking: false, is_test: false, cleared_at: null, ...over,
});

describe("arrival check times", () => {
  it("shows every arrival time in Central time (spec item 2)", () => {
    expect(arrivalTime("2026-11-20T19:00:00Z", "America/New_York")).toBe("1:00 PM");
    expect(arrivalTime("2026-11-20T22:00:00Z", "America/Chicago")).toBe("4:00 PM");
    expect(arrivalTime("2026-11-20T22:00:00Z", null)).toBe("4:00 PM");
  });

  it("the Team Queue due line turns red only inside the last 30 minutes before the deadline", () => {
    const deadline = "2026-11-20T19:00:00Z";
    expect(arrivalDueLine(deadline, "America/New_York", Date.parse("2026-11-20T18:29:00Z"))).toEqual({ text: "Due 1:00 PM", urgent: false });
    expect(arrivalDueLine(deadline, "America/New_York", Date.parse("2026-11-20T18:30:00Z")).urgent).toBe(true);
    expect(arrivalDueLine(deadline, "America/New_York", Date.parse("2026-11-20T19:30:00Z")).urgent).toBe(true);
  });
});

describe("what the sync stores", () => {
  it("keeps the guest's first name only", () => {
    const r = arrivalIngestRow({ id: 9, property_id: 492500, arrival: "2026-11-20T00:00:00", guest: { first_name: "Dana", id: 4 }, guest_name: "Dana Private", adults: 2 });
    expect(r.guest).toEqual({ first_name: "Dana" });
    expect(JSON.stringify(r)).not.toContain("Private");
    expect(r.arrival).toBe("2026-11-20");
    expect(r.property_id).toBe("492500");
    expect(arrivalIngestRow({ id: 1, guest_name: "Lee Private" }).guest).toEqual({ first_name: "Lee" });
  });

  it("the hourly sync hands its own bookings over and makes no new OwnerRez call", () => {
    const src = readFileSync("src/lib/guest-touch-base.server.ts", "utf8");
    const fetchAt = src.indexOf("await fetchBookingsWindow([...homes.keys()]");
    const storeAt = src.indexOf("await storeArrivalBookings(admin, bookings);");
    expect(fetchAt).toBeGreaterThan(0);
    expect(storeAt).toBeGreaterThan(fetchAt);
    const store = src.slice(src.indexOf("async function storeArrivalBookings"), src.indexOf("async function mappedHomes"));
    expect(store).not.toContain("ownerRez");
    expect(store).toContain("catch");
  });
});

describe("Arrival readiness list", () => {
  const rows = [
    row({ id: "1", result: "on_time" }),
    row({ id: "2", result: "late", completed_at: "2026-11-20T19:30:00Z" }),
    row({ id: "3", result: "missed", status: "open", completed_by: null, completed_at: null, outcome: null }),
    row({ id: "4", result: "on_time", outcome: "issue", issue_text: "Blind broken", backup_plan: "Vendor at 1 PM" }),
    row({ id: "5", status: "cancelled", result: null }),
    row({ id: "6", result: "late", late_booking: true }),
    row({ id: "7", result: "missed", is_test: true }),
    row({ id: "8", is_test: true, cleared_at: "2026-11-21T00:00:00Z" }),
  ];

  it("totals never count cancelled reservations, late bookings or tests", () => {
    expect(arrivalTotals(filterArrivalRows(rows, {}))).toEqual({ arrivals: 4, onTime: 2, onTimeShare: 50, late: 1, missed: 1, issues: 1 });
  });

  it("filters by result, home, person and dates; cleared tests never show", () => {
    expect(filterArrivalRows(rows, { result: "missed" }).map((r) => r.id)).toEqual(["3", "7"]);
    expect(filterArrivalRows(rows, { result: "cancelled" }).map((r) => r.id)).toEqual(["5"]);
    expect(filterArrivalRows(rows, {}).some((r) => r.id === "8")).toBe(false);
    expect(filterArrivalRows(rows, { from: "2026-11-21" })).toEqual([]);
    expect(filterArrivalRows(rows, { home: "other" })).toEqual([]);
    expect(filterArrivalRows(rows, { term: "blind" }).map((r) => r.id)).toEqual(["4"]);
  });

  it("Operations, Finance and Admin read it; onboarding roles never see it", () => {
    expect(databaseMode("arrival-readiness", { roles: ["tech"] })).toBe("view");
    expect(databaseMode("arrival-readiness", { roles: ["manager"], seats: { opsSupervisor: true } })).toBe("view");
    expect(databaseMode("arrival-readiness", { roles: ["manager"], seats: { opsDirector: true } })).toBe("view");
    expect(databaseMode("arrival-readiness", { roles: ["manager"], seats: { finance: true } })).toBe("view");
    expect(databaseMode("arrival-readiness", { roles: ["admin"] })).toBe("view");
    for (const seats of [{ onboardingDirector: true }, { projectManager: true }, { utilities: true }, {}]) {
      expect(databaseMode("arrival-readiness", { roles: ["onboarding"], seats })).toBe("hidden");
    }
  });
});

describe("arrival check tickets", () => {
  it("are recognised by their source, and test ones open only for the test plan leaders", () => {
    const real = { external_source: "ownerrez", external_id: "arrival:123", is_demo: false };
    const test = { external_source: "ownerrez", external_id: "arrival:test-abc", is_demo: true };
    expect(isArrivalCheckTicket(real)).toBe(true);
    expect(isArrivalCheckTicket({ external_source: "ownerrez", external_id: "review:1" })).toBe(false);
    expect(isArrivalTestTicket(test)).toBe(true);
    expect(isArrivalTestTicket(real)).toBe(false);
    expect(ticketShownInLens(test, false, true)).toBe(true);
    expect(ticketShownInLens(test, false, false)).toBe(false);
  });

  it("an owned arrival check shows in Needs you now with its due time; an unowned one does not", () => {
    const t = {
      id: "t1", title: "Arrival check: 1 Maple St", priority: "p2", status: "open", external_source: "ownerrez",
      external_id: "arrival:1", due_at: "2026-11-20T19:00:00Z", assigned_to: "me",
      properties: { name: "Maple", address_line1: "1 Maple St", time_zone: "America/New_York" },
    } as unknown as HomeTicket;
    const items = needsYouNow([t], "me", Date.parse("2026-11-20T15:00:00Z"));
    expect(items).toHaveLength(1);
    expect(items[0]!.kind).toBe("arrival");
    expect(items[0]!.detail.startsWith("Due 1:00 PM")).toBe(true);
    expect(needsYouNow([{ ...t, assigned_to: null } as HomeTicket], "me", Date.parse("2026-11-20T15:00:00Z"))).toHaveLength(0);
  });
});

describe("wording", () => {
  it("no long dashes, no seat, no tracking codes on the arrival check screens", () => {
    const texts = [
      JSON.stringify(ARRIVAL_COPY.panelTitle),
      ...Object.values(ARRIVAL_COPY).filter((v) => typeof v === "string"),
      readFileSync("src/components/tickets/ArrivalCheckPanel.tsx", "utf8"),
      readFileSync("src/components/ArrivalChecksPanel.tsx", "utf8"),
      readFileSync("src/components/databases/ArrivalReadiness.tsx", "utf8"),
    ].join("\n");
    expect(texts).not.toMatch(/[\u2014\u2013]/);
    expect(texts.toLowerCase()).not.toMatch(/\bseat\b/);
    expect(texts).not.toMatch(/\bP[1-4]\b|\bPC\d\b/);
  });
});
