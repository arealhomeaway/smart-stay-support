import {
  DEFAULT_SETTINGS,
  OVERNIGHT_COPY,
  beforeOvernightClock,
  boardTiles,
  clockStart,
  clockTimeLabel,
  overnightQueueRows,
  readSettings,
  replyClock,
  statusChip,
} from "../direct-bookings";

/**
 * Overnight Direct Booking requests (Emily, Nov 8, 2026; register D2, D3, K2).
 * Arrived 11:00 PM Sunday Central (05:00 UTC Monday). The window ends 8:00 AM Central
 * (14:00 UTC); the reply clock starts at the setting, default 9:00 AM Central (15:00 UTC).
 */
const ARRIVED = "2026-11-09T05:00:00Z";
const MORNING = "2026-11-09T14:00:00Z";
const NINE = "2026-11-09T15:00:00.000Z";
const night = { created_at: ARRIVED, overnight_until: MORNING, started_at: null, owned_by: null, reply_sent_at: null };
const at = (iso: string) => new Date(iso);

describe("an overnight request's clock starts at 9:00 AM (a setting), so the reply is due by 9:03 AM", () => {
  it("the setting defaults to 9:00 AM and is read from the saved settings", () => {
    expect(DEFAULT_SETTINGS.overnightClockStart).toBe("09:00");
    expect(readSettings({}).overnightClockStart).toBe("09:00");
    expect(readSettings({ overnightClockStart: "09:30" }).overnightClockStart).toBe("09:30");
    expect(readSettings({ overnightClockStart: "nine" }).overnightClockStart).toBe("09:00");
    expect(clockTimeLabel("09:00")).toBe("9:00 AM");
  });
  it("starts at 9:00 AM, not at arrival and not at 8:00 AM", () => {
    expect(clockStart(night)).toBe(NINE);
    expect(clockStart(night, "09:00")).toBe(NINE);
  });
  it("a Start before 9:00 AM does not move the clock earlier", () => {
    expect(clockStart({ ...night, started_at: "2026-11-09T14:10:00Z", owned_by: "u" } as never)).toBe(NINE);
  });
  it("a later edit to the setting moves the clock with no code change", () => {
    expect(clockStart(night, "09:30")).toBe("2026-11-09T15:30:00.000Z");
    // Never earlier than the end of the overnight window.
    expect(clockStart(night, "07:00")).toBe("2026-11-09T14:00:00.000Z");
  });
  it("daytime requests keep their normal clock from the moment they arrive", () => {
    expect(clockStart({ created_at: "2026-11-11T20:00:00Z" })).toBe("2026-11-11T20:00:00Z");
    expect(clockStart({ created_at: "2026-11-11T20:00:00Z", overnight_until: null }, "09:00")).toBe("2026-11-11T20:00:00Z");
  });
});

describe("what an 11 PM request shows", () => {
  it("until 9:00 AM: its real arrival time and Reply clock starts at 9:00 AM, no red, no late count", () => {
    for (const t of ["2026-11-09T05:30:00Z", "2026-11-09T14:00:00Z", "2026-11-09T14:45:00Z", "2026-11-09T14:59:59Z"]) {
      expect(beforeOvernightClock(night, at(t))).toBe(true);
      expect(statusChip("new", night, at(t))).toEqual({ text: "Arrived overnight at 11:00 PM. Reply clock starts at 9:00 AM.", tone: "brand", late: false });
      expect(replyClock(clockStart(night), null, at(t)).late).toBe(false);
      expect(boardTiles([{ ...night, status: "new" as const, outcome: null }], at(t))[0]!.red).toBe(false);
    }
  });
  it("the same after someone pressed Start at 8:10 AM", () => {
    const started = { ...night, owned_by: "u", started_at: "2026-11-09T14:10:00Z" };
    expect(statusChip("working", started, at("2026-11-09T14:45:00Z")).text).toBe("Arrived overnight at 11:00 PM. Reply clock starts at 9:00 AM.");
  });
  it("not late at 8:45 AM", () => {
    expect(statusChip("new", night, at("2026-11-09T14:45:00Z")).late).toBe(false);
  });
  it("3 minutes left at 9:00 AM", () => {
    expect(statusChip("new", night, at("2026-11-09T15:00:00Z"))).toEqual({ text: "Arrived overnight at 11:00 PM. 3 minutes left.", tone: "brand", late: false });
    expect(statusChip("new", night, at("2026-11-09T15:02:59Z")).late).toBe(false);
  });
  it("turns red at 9:03 AM", () => {
    expect(statusChip("new", night, at("2026-11-09T15:03:00Z"))).toEqual({ text: "Waiting 3 minutes. Reply now.", tone: "escalated", late: true });
    expect(boardTiles([{ ...night, status: "new" as const, outcome: null }], at("2026-11-09T15:03:00Z"))[0]!.red).toBe(true);
    expect(statusChip("waiting_approval", night, at("2026-11-09T15:03:00Z")).late).toBe(true);
    expect(statusChip("waiting_approval", night, at("2026-11-09T15:02:00Z")).late).toBe(false);
  });
  it("a reply sent at 9:02 AM took 2 minutes", () => {
    expect(replyClock(clockStart(night), "2026-11-09T15:02:00Z").seconds).toBe(120);
    expect(replyClock(clockStart(night), "2026-11-09T15:02:00Z").late).toBe(false);
  });
});

describe("a request created at 2 PM on a Wednesday keeps its normal clock from 2:00", () => {
  const day = { created_at: "2026-11-11T20:00:00Z", reply_sent_at: null, overnight_until: null };
  it("counts from 2:00 PM and turns red at 2:03 PM, as before", () => {
    expect(beforeOvernightClock(day, at("2026-11-11T20:00:00Z"))).toBe(false);
    expect(statusChip("new", day, at("2026-11-11T20:00:30Z")).text).toBe("Opened just now. 3 minutes left.");
    expect(statusChip("new", day, at("2026-11-11T20:01:00Z")).text).toBe("Opened 1 minute ago. 2 minutes left.");
    expect(statusChip("new", day, at("2026-11-11T20:03:00Z"))).toEqual({ text: "Waiting 3 minutes. Reply now.", tone: "escalated", late: true });
    expect(boardTiles([{ ...day, status: "new" as const, outcome: null }], at("2026-11-11T20:03:00Z"))[0]!.red).toBe(true);
  });
});

describe("every screen that reads the clock reads the setting", () => {
  it("the list, the request page and the Team Queue pass the saved start time", () => {
    const list = readFileSync("src/routes/_authenticated/direct-bookings.index.tsx", "utf8");
    expect(list).toContain("boardTiles(board, now, data?.settings.replyTargetMinutes, data?.settings.overnightClockStart)");
    expect(list).toContain("statusChip(r.status, r, now, data?.settings.replyTargetMinutes, data?.settings.overnightClockStart)");
    const page = readFileSync("src/routes/_authenticated/direct-bookings.$requestId.tsx", "utf8");
    expect(page).toContain("statusChip(status, lead, now, d.settings.replyTargetMinutes, d.settings.overnightClockStart)");
    expect(page).toContain("replyClock(clockStart(lead, d.settings.overnightClockStart), lead.reply_sent_at");
    const queue = readFileSync("src/components/operations/OvernightDirectBookings.tsx", "utf8");
    expect(queue).toContain("readSettings(data?.value).overnightClockStart");
    expect(OVERNIGHT_COPY.clockStarts("9:00 AM")).toBe("Reply clock starts at 9:00 AM.");
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
