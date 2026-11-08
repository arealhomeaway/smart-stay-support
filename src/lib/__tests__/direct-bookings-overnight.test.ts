import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  OVERNIGHT_COPY,
  boardTiles,
  clockStart,
  overnightQueueRows,
  replyClock,
  statusChip,
  waitingForMorning,
} from "../direct-bookings";

/**
 * Overnight Direct Booking requests (Emily, Nov 8, 2026; register D2, clock default in K2).
 * Arrived 11:04 PM Sunday Central (05:04 UTC Monday); the morning shift begins 8:00 AM Central
 * (14:00 UTC Monday).
 */
const ARRIVED = "2026-11-09T05:04:00Z";
const MORNING = "2026-11-09T14:00:00Z";
const night = { created_at: ARRIVED, overnight_until: MORNING, started_at: null, owned_by: null, reply_sent_at: null };

describe("the 3 minute clock for an overnight request starts when the morning shift begins (default)", () => {
  it("daytime requests still start at creation", () => {
    expect(clockStart({ created_at: "2026-11-09T18:00:00Z" })).toBe("2026-11-09T18:00:00Z");
    expect(clockStart({ created_at: "2026-11-09T18:00:00Z", overnight_until: null })).toBe("2026-11-09T18:00:00Z");
  });
  it("overnight requests start at 8:00 AM, never at arrival", () => {
    expect(clockStart(night)).toBe(MORNING);
    expect(replyClock(clockStart(night), null, new Date("2026-11-09T14:02:59Z")).late).toBe(false);
    expect(replyClock(clockStart(night), null, new Date("2026-11-09T14:03:00Z")).late).toBe(true);
    expect(replyClock(clockStart(night), null, new Date("2026-11-09T13:00:00Z")).seconds).toBe(0);
  });
  it("if someone pressed Start before the morning, the clock starts then", () => {
    expect(clockStart({ ...night, started_at: "2026-11-09T07:00:00Z" })).toBe("2026-11-09T07:00:00Z");
    expect(clockStart({ ...night, started_at: "2026-11-09T14:01:00Z" })).toBe(MORNING);
  });
});

describe("what the request shows", () => {
  it("before the morning: its real arrival time and that it waits for the morning team", () => {
    const at = new Date("2026-11-09T09:00:00Z");
    expect(waitingForMorning(night, at)).toBe(true);
    expect(statusChip("new", night, at)).toEqual({ text: "Arrived overnight at 11:04 PM. Waits for the morning team.", tone: "brand", late: false });
  });
  it("after 8:00 AM: still its real arrival time, with the clock counting from 8:00", () => {
    expect(statusChip("new", night, new Date("2026-11-09T14:01:00Z"))).toEqual({ text: "Arrived overnight at 11:04 PM. 2 minutes left.", tone: "brand", late: false });
    expect(statusChip("new", night, new Date("2026-11-09T14:04:00Z"))).toEqual({ text: "Waiting 4 minutes. Reply now.", tone: "escalated", late: true });
  });
  it("the Needs a reply tile turns red only from 8:03 AM", () => {
    const row = { ...night, status: "new" as const, outcome: null };
    expect(boardTiles([row], new Date("2026-11-09T12:00:00Z"))[0]!.red).toBe(false);
    expect(boardTiles([row], new Date("2026-11-09T14:02:00Z"))[0]!.red).toBe(false);
    expect(boardTiles([row], new Date("2026-11-09T14:03:00Z"))[0]!.red).toBe(true);
  });
  it("daytime wording is unchanged", () => {
    const day = { created_at: "2026-11-09T18:00:00Z", reply_sent_at: null };
    expect(statusChip("new", day, new Date("2026-11-09T18:00:30Z")).text).toBe("Opened just now. 3 minutes left.");
    expect(statusChip("new", day, new Date("2026-11-09T18:01:00Z")).text).toBe("Opened 1 minute ago. 2 minutes left.");
  });
});

describe("Team Queue: overnight requests wait at the top as Right now for Team A until Start", () => {
  const base = { partner_name: "P", company: null, subject: null, outcome: null, reply_sent_at: null, owned_by: null };
  it("only overnight requests nobody has started, oldest first", () => {
    const rows = [
      { ...base, id: "day", created_at: "2026-11-09T18:00:00Z", overnight_until: null },
      { ...base, id: "late", created_at: "2026-11-09T06:00:00Z", overnight_until: MORNING },
      { ...base, id: "early", created_at: "2026-11-09T04:00:00Z", overnight_until: MORNING },
      { ...base, id: "started", created_at: "2026-11-09T05:00:00Z", overnight_until: MORNING, owned_by: "u" },
      { ...base, id: "done", created_at: "2026-11-09T05:00:00Z", overnight_until: MORNING, outcome: "not_booked" },
    ];
    expect(overnightQueueRows(rows).map((r) => r.id)).toEqual(["early", "late"]);
  });
  it("labels: Right now, Team A", () => {
    expect(OVERNIGHT_COPY.urgency).toBe("Right now");
    expect(OVERNIGHT_COPY.team).toBe("Team A");
  });
  it("the Team Queue shows the group above everything else, to people who work Direct Bookings", () => {
    const page = readFileSync("src/routes/_authenticated/team-queue.tsx", "utf8");
    const group = page.indexOf('{can("direct_bookings_work") && <OvernightDirectBookings demoMode={demoMode} />}');
    expect(group).toBeGreaterThan(-1);
    expect(group < page.indexOf("<NotionImportedGroup")).toBe(true);
  });
});
