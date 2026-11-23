import { describe, expect, it } from "bun:test";
import {
  homeTimeZone,
  localTimeToUtc,
  matchingUpdate,
  ownerFirstNames,
  ownerNickname,
  plannedSends,
  quietOwnerDays,
  reconcileHome,
  renderUpdate,
  sendDecision,
  stopReason,
  usFederalHolidays,
  type HomeFacts,
} from "@/lib/owner-closing-updates";

const facts = (over: Partial<HomeFacts> = {}): HomeFacts => ({
  closingOn: "2026-12-01",
  timeZone: "America/Chicago",
  lifecycleStatus: "onboarding",
  projectStatus: "active",
  notionStatus: "Waiting for Design",
  ...over,
});

describe("owner updates after closing: dates", () => {
  it("updates 1, 2 and 3 go at Closing + 7, 14 and 21 days", () => {
    // Tue Dec 1 2026: Dec 8, Dec 15, Dec 22 are all Tuesdays.
    expect(plannedSends("2026-12-01", "America/Chicago").map((p) => p.sendOn)).toEqual(["2026-12-08", "2026-12-15", "2026-12-22"]);
  });
  it("a weekend moves to the next business day", () => {
    // Sat Nov 28 2026 + 7 = Sat Dec 5 -> Mon Dec 7.
    expect(plannedSends("2026-11-28", "America/Chicago")[0]!.sendOn).toBe("2026-12-07");
  });
  it("a US federal holiday moves to the next business day", () => {
    // Christmas Fri Dec 25 2026: closing Dec 18 + 7 = Dec 25 -> Mon Dec 28.
    expect(plannedSends("2026-12-18", "America/Chicago")[0]!.sendOn).toBe("2026-12-28");
    // Thanksgiving Thu Nov 26 2026: closing Nov 19 + 7 -> Fri Nov 27.
    expect(plannedSends("2026-11-19", "America/Chicago")[0]!.sendOn).toBe("2026-11-27");
  });
  it("the federal holiday list uses observed days", () => {
    const y2027 = usFederalHolidays(2027);
    expect(y2027).toContain("2027-07-05"); // July 4 is a Sunday
    expect(y2027).toContain("2027-12-24"); // Christmas is a Saturday
    expect(y2027).toContain("2027-12-31"); // New Year's Day 2028 is a Saturday
    expect(usFederalHolidays(2026)).toHaveLength(11);
  });
  it("sends at 9:00 AM in the home's own time zone", () => {
    expect(localTimeToUtc("2026-12-08", 9, "America/Chicago")).toBe("2026-12-08T15:00:00.000Z");
    expect(localTimeToUtc("2026-12-08", 9, "America/Indiana/Indianapolis")).toBe("2026-12-08T14:00:00.000Z");
    expect(localTimeToUtc("2026-07-08", 9, "America/Chicago")).toBe("2026-07-08T14:00:00.000Z");
  });
  it("a home with no time zone uses its state, else Central", () => {
    expect(homeTimeZone(null, "OK")).toBe("America/Chicago");
    expect(homeTimeZone(null, "Indiana")).toBe("America/Indiana/Indianapolis");
    expect(homeTimeZone("America/New_York", "IN")).toBe("America/New_York");
    expect(homeTimeZone("not a zone", null)).toBe("America/Chicago");
  });
  it("the Project Manager preview is the business day before the send", () => {
    // Mon Dec 7 send -> Fri Dec 4 preview.
    expect(plannedSends("2026-11-28", "America/Chicago")[0]!.previewOn).toBe("2026-12-04");
  });
});

describe("owner updates after closing: scheduling", () => {
  it("only schedules sends dated today or later; a missed date is never created", () => {
    const ch = reconcileHome({ facts: facts(), today: "2026-12-10", stored: [] });
    expect(ch.map((c) => (c.kind === "create" ? c.no : null))).toEqual([2, 3]);
  });
  it("a changed closing date moves unsent updates", () => {
    const ch = reconcileHome({
      facts: facts({ closingOn: "2026-12-03" }),
      today: "2026-12-02",
      stored: [{ id: "a", no: 1, status: "scheduled", closingOn: "2026-12-01", sendOn: "2026-12-08", sendAt: "2026-12-08T15:00:00.000Z", reason: null }],
    });
    expect(ch.find((c) => c.kind === "move" && c.id === "a")).toMatchObject({ kind: "move", id: "a", sendOn: "2026-12-10" });
  });
  it("a closing date moved so the update is already past makes it missed, not sent late", () => {
    const ch = reconcileHome({
      facts: facts({ closingOn: "2026-11-20" }),
      today: "2026-12-02",
      stored: [{ id: "a", no: 1, status: "scheduled", closingOn: "2026-12-01", sendOn: "2026-12-08", sendAt: "2026-12-08T15:00:00.000Z", reason: null }],
    });
    expect(ch.find((c) => c.kind === "miss" && c.id === "a")).toMatchObject({ kind: "miss", id: "a" });
  });
  it("held and sent updates never move", () => {
    const ch = reconcileHome({
      facts: facts({ closingOn: "2026-12-03" }),
      today: "2026-12-02",
      stored: [
        { id: "a", no: 1, status: "held", closingOn: "2026-12-01", sendOn: "2026-12-08", sendAt: "2026-12-08T15:00:00.000Z", reason: null },
        { id: "b", no: 2, status: "sent", closingOn: "2026-12-01", sendOn: "2026-12-15", sendAt: "2026-12-15T15:00:00.000Z", reason: null },
      ],
    });
    expect(ch.filter((c) => c.kind !== "create")).toEqual([]);
  });
  it("the sequence stops once the home is Live", () => {
    expect(stopReason({ lifecycleStatus: "active_operations", projectStatus: "active", notionStatus: null })).toBe("The home is Live.");
    expect(stopReason({ lifecycleStatus: "onboarding", projectStatus: "complete", notionStatus: null })).toBe("The home is Live.");
    expect(stopReason({ lifecycleStatus: "onboarding", projectStatus: "active", notionStatus: "Property Handed Off" })).toBe("The home is Live.");
    const ch = reconcileHome({
      facts: facts({ lifecycleStatus: "active_operations" }),
      today: "2026-12-02",
      stored: [{ id: "a", no: 1, status: "scheduled", closingOn: "2026-12-01", sendOn: "2026-12-08", sendAt: "2026-12-08T15:00:00.000Z", reason: null }],
    });
    expect(ch).toEqual([{ kind: "stop", id: "a", no: 1, reason: "The home is Live." }]);
  });
  it("sends only on its own day from 9:00 AM until 5:00 PM home time", () => {
    const base = { sendOn: "2026-12-08", sendAt: "2026-12-08T15:00:00.000Z", timeZone: "America/Chicago" };
    expect(sendDecision({ ...base, now: new Date("2026-12-08T14:59:00Z") })).toBe("wait");
    expect(sendDecision({ ...base, now: new Date("2026-12-08T15:00:00Z") })).toBe("send");
    expect(sendDecision({ ...base, now: new Date("2026-12-08T23:00:00Z") })).toBe("missed");
    expect(sendDecision({ ...base, now: new Date("2026-12-09T15:00:00Z") })).toBe("missed");
  });
});

describe("owner updates after closing: wording", () => {
  it("fills the template exactly", () => {
    const r = renderUpdate(1, { address: "3400 N Fern Ave", nickname: "Fern Retreat", ownerFirstNames: "Rachel and Mike", projectManager: "Pat Lee" });
    expect(r.subject).toBe("Quick update on 3400 N Fern Ave");
    expect(r.body.startsWith("Hi Rachel and Mike,\n\nI hope you're having a great week! I wanted to give you a quick update on how things are coming along at Fern Retreat.")).toBe(true);
    expect(r.body.endsWith("Warmly,\nPat Lee")).toBe(true);
    expect(renderUpdate(2, { address: "A", nickname: "A", ownerFirstNames: "B", projectManager: "C" }).subject).toBe("A is coming together");
    expect(renderUpdate(3, { address: "A", nickname: "A", ownerFirstNames: "B", projectManager: "C" }).subject).toBe("Getting A ready for guests");
  });
  it("a blank nickname uses the property address", () => {
    expect(ownerNickname(null, "3400 N Fern Ave")).toBe("3400 N Fern Ave");
    expect(ownerNickname("  ", "3400 N Fern Ave")).toBe("3400 N Fern Ave");
    expect(ownerNickname("Comstock (8738)", "8738 Comstock")).toBe("Comstock");
  });
  it("owner first names", () => {
    expect(ownerFirstNames(["Rachel Ramsey", "Mike Ramsey"], "Mike & Rachel Ramsey")).toBe("Rachel and Mike");
    expect(ownerFirstNames([], "Nancy DeLeon")).toBe("Nancy");
    expect(ownerFirstNames([], "Hamann Properties, LLC.")).toBe("there");
  });
  it("Call or Email uses the next update not sent yet, else the last one", () => {
    const items = [
      { no: 1 as const, sendOn: "2026-12-08", status: "sent" },
      { no: 2 as const, sendOn: "2026-12-15", status: "scheduled" },
      { no: 3 as const, sendOn: "2026-12-22", status: "scheduled" },
    ];
    expect(matchingUpdate(items, "2026-12-10")).toBe(2);
    expect(matchingUpdate(items, "2026-12-30")).toBe(3);
  });
});

describe("6 days since the last update", () => {
  const now = new Date("2026-12-10T15:00:00Z");
  it("shows at 6 days, not before", () => {
    expect(quietOwnerDays({ lastUpdateAt: "2026-12-04T16:00:00Z", startedAt: null, now, stopped: false })).toBeNull();
    expect(quietOwnerDays({ lastUpdateAt: "2026-12-04T14:00:00Z", startedAt: null, now, stopped: false })).toBe(6);
  });
  it("never shows once the home is Live", () => {
    expect(quietOwnerDays({ lastUpdateAt: "2026-11-01T00:00:00Z", startedAt: null, now, stopped: true })).toBeNull();
  });
});
