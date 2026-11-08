import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { DB_COPY, homeDirectBookings, homeStartIds, type HomeBookingRow } from "@/lib/direct-bookings";

const row = (id: string, extra: Partial<HomeBookingRow> = {}): HomeBookingRow => ({
  id, partner_name: "Partner", company: null, subject: null, created_at: "2026-11-09T15:00:00Z",
  reply_sent_at: null, owned_by: null, outcome: null, ...extra,
});

describe("Home shows an unstarted Direct Booking to everyone eligible right now", () => {
  it("someone eligible now sees every unstarted request, even one that alerted other people", () => {
    const ids = homeStartIds([], true, ["r1", "r2"]);
    expect(homeDirectBookings([row("r1"), row("r2")], ids, "me").map((r) => [r.id, r.waitingForStart])).toEqual([["r1", true], ["r2", true]]);
  });
  it("someone not eligible now sees only the requests that alerted them", () => {
    const ids = homeStartIds(["r2"], false, ["r1", "r2"]);
    expect(homeDirectBookings([row("r1"), row("r2")], ids, "me").map((r) => r.id)).toEqual(["r2"]);
  });
  it("once someone presses Start it shows only for the owner", () => {
    const started = row("r1", { owned_by: "owner" });
    const ids = homeStartIds(["r1"], true, []);
    expect(homeDirectBookings([started], ids, "me")).toEqual([]);
    expect(homeDirectBookings([started], ids, "owner").map((r) => [r.id, r.waitingForStart])).toEqual([["r1", false]]);
  });
});

describe("Mark as booked asks which home, both answers optional", () => {
  const page = readFileSync("src/routes/_authenticated/direct-bookings.$requestId.tsx", "utf8");
  it("asks which home only when several were offered, with Not sure yet as the default", () => {
    expect(page).toContain("offered.length > 1 ?");
    expect(page).toContain("DB_COPY.bookedHomeUnknown");
    expect(DB_COPY.bookedHome).toBe("Which home did they book? (optional)");
    expect(DB_COPY.bookedHomeUnknown).toBe("Not sure yet");
  });
  it("the move-in date is optional and blank is saved as no date", () => {
    expect(DB_COPY.bookedMoveIn).toBe("Move-in date (optional)");
    expect(page).toContain("propertyId: home || null, moveIn: moveIn || null");
  });
  it("the database already accepts no home and no date, and refuses a home that was not offered", () => {
    const sql = readFileSync("docs/pending/direct-bookings-fix/02_guarded_actions.sql", "utf8");
    expect(sql).toContain("IF _property_id IS NOT NULL AND NOT (_property_id = ANY(coalesce(_lead.offered_property_ids, '{}'))) THEN");
    expect(sql).toContain("_move_in date DEFAULT NULL");
  });
});
