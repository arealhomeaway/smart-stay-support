import { describe, expect, it } from "bun:test";
import { COORDINATOR_ROLE_LABELS, ROUTING_NOTE_BANNED, decideRoute } from "@/lib/coverage-model";
import { HOME_BOOKING_COPY, homeDirectBookings, type HomeBookingRow } from "@/lib/direct-bookings";

const row = (id: string, owned_by: string | null, extra: Partial<HomeBookingRow> = {}): HomeBookingRow => ({
  id, partner_name: "Partner", company: null, subject: null, created_at: `2026-11-09T15:0${id}:00Z`,
  reply_sent_at: null, owned_by, outcome: null, ...extra,
});

describe("Needs you now: Direct Booking requests", () => {
  it("before Start, shows for everyone it alerted and nobody else", () => {
    const rows = [row("1", null)];
    expect(homeDirectBookings(rows, ["1"], "me").map((r) => [r.id, r.waitingForStart])).toEqual([["1", true]]);
    expect(homeDirectBookings(rows, [], "someone-not-alerted")).toEqual([]);
  });

  it("after Start, shows only for the owner", () => {
    const rows = [row("1", "owner")];
    expect(homeDirectBookings(rows, ["1"], "owner").map((r) => [r.id, r.waitingForStart])).toEqual([["1", false]]);
    expect(homeDirectBookings(rows, ["1"], "other-alerted-person")).toEqual([]);
  });

  it("leaves once the reply is sent or an outcome is saved, never twice, oldest first", () => {
    const rows = [row("3", null), row("1", "me"), row("2", null, { reply_sent_at: "2026-11-09T15:05:00Z" }), row("4", "me", { outcome: "booked" }), row("3", null)];
    expect(homeDirectBookings(rows, ["2", "3"], "me").map((r) => r.id)).toEqual(["1", "3"]);
  });

  it("uses plain words", () => {
    expect(HOME_BOOKING_COPY.waitingForStart).toBe("New request. Press Start to own it and reply within 3 minutes.");
    expect(HOME_BOOKING_COPY.started).toBe("Direct booking you started. Reply within 3 minutes.");
  });
});

describe("Breezeway notes: plain words, same order and logic", () => {
  const base = { afterHours: false, onCallUserId: null, teamB: [], lastRouted: new Map<string, string>(), triage: null, supervisorOnDuty: null };
  const all = [
    decideRoute({ ...base, afterHours: true, onCallUserId: "oncall" }),
    decideRoute({ ...base, teamB: [{ userId: "b", roleCode: "po_evening", weight: 7 }] }),
    decideRoute({ ...base, triage: { userId: "a", roleCode: "ge_day" } }),
    decideRoute({ ...base, supervisorOnDuty: { userId: "s", roleCode: "ops_supervisor" } }),
    decideRoute({ ...base }),
  ];

  it("never say seat, triage, weighted load, code names or urgency codes", () => {
    for (const d of all) for (const bad of ROUTING_NOTE_BANNED) expect({ r: d.reason, bad: bad.test(d.reason) }).toEqual({ r: d.reason, bad: false });
  });

  it("name the role and why", () => {
    expect(all[1]!.reason).toBe("Came from Breezeway, so it went to the Property Operations evening and weekend coordinator on shift with the least open work.");
    expect(all[2]!.reason).toBe("No one on Property Operations was on shift, so it went to the Guest Experience day and weekend coordinator, who covers Property Operations at this time.");
  });

  it("the order is unchanged: on call overnight, then Property Operations, then the cover role, then the Supervisor, then nobody", () => {
    expect(all.map((d) => d.userId)).toEqual(["oncall", "b", "a", "s", null]);
    const both = decideRoute({ ...base, afterHours: true, onCallUserId: "oncall", teamB: [{ userId: "b", roleCode: "po_day", weight: 0 }] });
    expect(both.userId).toBe("oncall");
  });

  it("every coordinator role has a plain name", () => {
    expect(Object.keys(COORDINATOR_ROLE_LABELS).sort()).toEqual(["ge_day", "ge_evening", "ge_parttime", "po_day", "po_evening"]);
    for (const l of Object.values(COORDINATOR_ROLE_LABELS)) for (const bad of ROUTING_NOTE_BANNED) expect(bad.test(l)).toBe(false);
  });
});
