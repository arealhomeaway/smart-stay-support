import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  approvalRequired,
  BANNED_SCREEN_WORDS,
  DEFAULT_SETTINGS,
  directorMayApprove,
  rankHomes,
  RATE_NOT_SET,
  readSettings,
  rentFor,
  replyClock,
  requestStatus,
  validateNotBooked,
  NOT_BOOKED_REASONS,
  type HomeCandidate,
} from "./direct-bookings";
import { DIRECT_BOOKING_TAGS, hasTag } from "./mail-categories";

const home = (o: Partial<HomeCandidate> & { id: string }): HomeCandidate => ({
  title: o.id,
  bedrooms: 3,
  bathrooms: 2,
  maxGuests: 6,
  distanceMiles: 3,
  blocked: false,
  shortStays: 0,
  petsOk: true,
  activeOwner: false,
  ...o,
});
const ask = { minBedrooms: 3, minBathrooms: 2, guests: 4, preferredBedrooms: 3, distance: 10 as const };

describe("rent", () => {
  it("3 bedroom is $189 a night, $5,670 a month", () => {
    expect(rentFor(3, null, DEFAULT_SETTINGS)).toMatchObject({ ok: true, nightly: 189, monthly: 5670 });
  });
  it("4 bedroom is $199 a night", () => {
    expect(rentFor(4, null, DEFAULT_SETTINGS)).toMatchObject({ ok: true, nightly: 199 });
  });
  it("2 and 5 bedroom have no rate and cannot be sent", () => {
    expect(rentFor(2, null, DEFAULT_SETTINGS)).toEqual({ ok: false, reason: RATE_NOT_SET });
    expect(rentFor(5, null, DEFAULT_SETTINGS)).toEqual({ ok: false, reason: RATE_NOT_SET });
    expect(RATE_NOT_SET).toBe("Rate not set. Ask the Operations Supervisor.");
  });
});

describe("approval period", () => {
  it("runs Nov 9 to Nov 23 Central", () => {
    expect(approvalRequired(DEFAULT_SETTINGS, new Date("2026-11-09T12:00:00Z"))).toBe(true);
    expect(approvalRequired(DEFAULT_SETTINGS, new Date("2026-11-23T20:00:00Z"))).toBe(true);
    expect(approvalRequired(DEFAULT_SETTINGS, new Date("2026-11-25T12:00:00Z"))).toBe(false);
  });
  it("after the period approval follows the setting, default off", () => {
    expect(DEFAULT_SETTINGS.requireApprovalAfterEnd).toBe(false);
    const on = readSettings({ ...DEFAULT_SETTINGS, requireApprovalAfterEnd: true });
    expect(approvalRequired(on, new Date("2026-12-01T12:00:00Z"))).toBe(true);
  });
  it("Director can approve only after 2 minutes", () => {
    const at = new Date("2026-11-10T15:00:00Z");
    expect(directorMayApprove("2026-11-10T14:58:30Z", DEFAULT_SETTINGS, at)).toBe(false);
    expect(directorMayApprove("2026-11-10T14:57:59Z", DEFAULT_SETTINGS, at)).toBe(true);
  });
});

describe("reply clock", () => {
  it("keeps running while waiting for approval and stops at reply sent", () => {
    const running = replyClock("2026-11-10T15:00:00Z", null, new Date("2026-11-10T15:04:00Z"));
    expect(running).toMatchObject({ seconds: 240, late: true, stopped: false });
    const done = replyClock("2026-11-10T15:00:00Z", "2026-11-10T15:02:30Z", new Date("2026-11-10T16:00:00Z"));
    expect(done).toMatchObject({ seconds: 150, late: false, stopped: true });
  });
  it("waiting for approval is its own status, not sent", () => {
    expect(requestStatus({ created_at: "", owned_by: "u", reply_sent_at: null, outcome: null, pending_approval: true })).toBe("waiting_approval");
  });
});

describe("home ranking", () => {
  it("removes homes with more than 2 short stays", () => {
    expect(rankHomes([home({ id: "a", shortStays: 3 })], ask)).toEqual([]);
  });
  it("orders firm 30 day homes, then free, then 1 to 2 short stays", () => {
    const r = rankHomes(
      [home({ id: "short", shortStays: 1 }), home({ id: "free" }), home({ id: "firm", title: "Oak 30D FIRM" })],
      ask,
    );
    expect(r.map((h) => h.id)).toEqual(["firm", "free", "short"]);
  });
  it("breaks ties by preferred bedrooms then distance", () => {
    const r = rankHomes([home({ id: "far", distanceMiles: 8 }), home({ id: "four", bedrooms: 4, distanceMiles: 1 }), home({ id: "near", distanceMiles: 2 })], ask);
    expect(r.map((h) => h.id)).toEqual(["near", "far", "four"]);
  });
  it("removes Active Owner and 7D MAX homes and homes past the distance", () => {
    const r = rankHomes([home({ id: "ao", activeOwner: true }), home({ id: "max", title: "Elm 7D MAX" }), home({ id: "far", distanceMiles: 11 })], ask);
    expect(r).toEqual([]);
  });
});

describe("outcomes", () => {
  it("not booked needs a reason and a note", () => {
    expect(validateNotBooked("", "x")).not.toBeNull();
    expect(validateNotBooked("Too expensive", "")).not.toBeNull();
    expect(validateNotBooked(NOT_BOOKED_REASONS[0], "Went elsewhere")).toBeNull();
  });
});

describe("Outlook tag", () => {
  it("matches only Resolve: direct booking, any case; the old lead tag no longer opens a request", () => {
    expect(DIRECT_BOOKING_TAGS).toEqual(["Resolve: direct booking"]);
    for (const t of ["resolve: direct booking", "RESOLVE: DIRECT BOOKING"]) {
      expect(DIRECT_BOOKING_TAGS.some((tag) => hasTag([t], tag))).toBe(true);
    }
    for (const t of ["Resolve: lead management- create a ticket", "RESOLVE: LEAD MANAGEMENT - CREATE A TICKET"]) {
      expect(DIRECT_BOOKING_TAGS.some((tag) => hasTag([t], tag))).toBe(false);
    }
  });
});

describe("screens and staged rules", () => {
  const screens = ["direct-bookings.index.tsx", "direct-bookings.$requestId.tsx", "direct-bookings.settings.tsx"].map((f) =>
    readFileSync(`src/routes/_authenticated/${f}`, "utf8"),
  );
  it("no seat, Hit or Median in on-screen words", () => {
    for (const s of screens) {
      const visible = s.match(/>[^<>{}]+</g)?.join(" ") ?? "";
      for (const w of BANNED_SCREEN_WORDS) expect(visible).not.toMatch(w);
    }
  });
  it("Start is atomic in the database: only takes an unowned request", () => {
    const sql = readFileSync("docs/pending/direct-bookings/01_direct_bookings.sql", "utf8");
    expect(sql).toMatch(/owned_by IS NULL/);
    expect(sql).toMatch(/FOR UPDATE/);
  });
});
