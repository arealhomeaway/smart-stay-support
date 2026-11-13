import { describe, expect, it } from "bun:test";
import {
  clearAll,
  defaultScope,
  homesCsv,
  lifecycleFor,
  mayManageHomes,
  missingSetup,
  openAtFor,
  otherTabMatches,
  parseHomeSearch,
  tileClick,
  tileValue,
  tilesFor,
  viewOnlyFor,
  visibleRows,
  type HomeRow,
} from "../onboarding-home";

/** Onboarding Home as the project database (Admin approval Nov 12): the rules the page follows. */
const TODAY = "2026-11-12";
const ADMIN = { userId: "a", isAdmin: true, isDirector: false };
const DIRECTOR = { userId: "d", isAdmin: false, isDirector: true };
const PM = { userId: "p", isAdmin: false, isDirector: false };

const row = (o: Partial<HomeRow> = {}): HomeRow => ({
  propertyId: o.propertyId ?? "h1",
  projectId: "p1",
  name: "1399 Foxtail Ln",
  place: "Round Rock, TX",
  photo: null,
  activeOwner: false,
  ownerType: "Standard DFY",
  ownerName: "Owner Person",
  status: "Repairs",
  invoiceStatus: null,
  lifecycle: "active",
  stage: 3,
  hasPlan: true,
  closingOn: "2026-10-01",
  closed: true,
  possessionOn: null,
  committedOn: null,
  estimateOn: "2026-12-01",
  handoffOn: "2026-12-01",
  endedOn: null,
  note: null,
  schedule: { behind: false, days: 0, label: "On track" },
  team: { pm: { id: "p", name: "PM Person" }, designer: { id: "x", name: "Designer Person" }, utilities: { id: "u", name: "Utilities Person" }, director: null, stagers: [] },
  onTeam: false,
  followed: false,
  lateMine: 0,
  dueWeekMine: 0,
  ownerWaiting: 0,
  market: "Austin",
  scope: "Full furnishing",
  utilityOption: null,
  hoa: false,
  breezeway: false,
  labels: [],
  ownerRezId: null,
  isDemo: false,
  ...o,
});

describe("3.3 access", () => {
  it("Admin and the Director lead: they manage homes from the list and are never view only", () => {
    expect(mayManageHomes(ADMIN)).toBe(true);
    expect(mayManageHomes(DIRECTOR)).toBe(true);
    expect(viewOnlyFor(ADMIN, false)).toBe(false);
    expect(viewOnlyFor(DIRECTOR, false)).toBe(false);
  });
  it("a PM never manages homes from the list, and a home they are not on opens view only", () => {
    expect(mayManageHomes(PM)).toBe(false);
    expect(viewOnlyFor(PM, false)).toBe(true);
    expect(viewOnlyFor(PM, true)).toBe(false);
  });
  it("a role preview never manages homes", () => {
    expect(mayManageHomes(ADMIN, true)).toBe(false);
  });
  it("the Director and Admin get the five lead tiles; everyone else the four team tiles", () => {
    expect(tilesFor(DIRECTOR).map((t) => t.label)).toEqual(["Homes behind schedule", "Missing setup", "Not in Resolve yet", "Closing soon without a PM", "Handoffs in the next 14 days"]);
    expect(tilesFor(PM).map((t) => t.label)).toEqual(["Late on your homes", "Owners waiting on you", "Due this week", "Your next handoff"]);
  });
});

describe("1.3 My homes / All homes", () => {
  it("PM, Designer and Utilities open on My homes; the Director and Admin on All homes", () => {
    expect(defaultScope(PM)).toBe("my");
    expect(defaultScope(DIRECTOR)).toBe("all");
    expect(defaultScope(ADMIN)).toBe("all");
  });
  it("My homes holds the homes the person is on plus the ones they added", () => {
    const rows = [row({ propertyId: "on", onTeam: true }), row({ propertyId: "follow", followed: true }), row({ propertyId: "other" })];
    const mine = visibleRows({ rows, tab: "active", scope: "my", tile: null, q: "", filters: {}, today: TODAY }).map((r) => r.propertyId);
    expect(mine).toEqual(["on", "follow"]);
    expect(visibleRows({ rows, tab: "active", scope: "all", tile: null, q: "", filters: {}, today: TODAY })).toHaveLength(3);
  });
});

describe("1.2 tiles", () => {
  it("a tile with nothing reads All clear", () => {
    const v = tileValue("late_mine", [row()], [], TODAY);
    expect(v.value).toBe("All clear");
    expect(v.count).toBe(0);
  });
  it("Late on your homes counts the person's own late Tasks", () => {
    const v = tileValue("late_mine", [row({ lateMine: 2 }), row({ propertyId: "h2", lateMine: 1 })], [], TODAY);
    expect(v.count).toBe(3);
  });
  it("a tile click switches to Active projects and the Table; the same tile again clears it", () => {
    const on = tileClick({ tab: "all", view: "gantt" }, "behind");
    expect(on).toEqual({ tab: "active", view: "table", tile: "behind" });
    expect(tileClick(on, "behind").tile).toBe(undefined);
  });
  it("Missing setup names the missing team members and a closed home's missing committed date", () => {
    expect(missingSetup(row({ team: { pm: null, designer: null, utilities: null, director: null, stagers: [] } }))).toEqual(["PM", "Designer", "Utilities", "committed handoff date"]);
    expect(missingSetup(row({ committedOn: "2026-12-01" }))).toEqual([]);
  });
});

describe("1.4 walkthrough", () => {
  it("a row opens at the tile's place, anything else at Overview", () => {
    expect(openAtFor("late_mine")).toEqual({ tab: "tasks", show: "late" });
    expect(openAtFor("owners_waiting")).toEqual({ tab: "owner", at: "needs" });
    expect(openAtFor("next_handoff")).toEqual({ tab: "tasks", stage: "6" });
    expect(openAtFor("handoffs_14")).toEqual({ tab: "tasks", stage: "6" });
    expect(openAtFor("behind")).toEqual({});
    expect(openAtFor(null)).toEqual({});
  });
  it("everything lives in the address, and the old All properties link opens past projects", () => {
    expect(parseHomeSearch({ tab: "all", scope: "my", tile: "behind", view: "gantt", q: "fox", sched: "behind" })).toEqual({ tab: "all", scope: "my", tile: "behind", view: "gantt", q: "fox", sched: "behind" });
    expect(parseHomeSearch({ lens: "all" }).tab).toBe("all");
    expect(parseHomeSearch({ tile: "made_up" }).tile).toBe(undefined);
  });
  it("Clear filters keeps the tab, the switch and the view", () => {
    expect(clearAll({ tab: "active", scope: "all", view: "gallery", tile: "behind", q: "x", sched: "behind" })).toEqual({ tab: "active", scope: "all", view: "gallery", showTest: undefined });
  });
  it("a search that also matches a past home says so", () => {
    const rows = [row(), row({ propertyId: "old", name: "1399 Foxtail Ln", lifecycle: "handed_off" })];
    expect(otherTabMatches(rows, "active", "foxtail")).toBe(1);
  });
});

describe("2.5 Upcoming", () => {
  it("Upcoming Property with no plan is Upcoming; Contract Fell Through is past", () => {
    expect(lifecycleFor({ projectStatus: "Upcoming Property", status: "planning", hasPlan: false, handedOff: false })).toBe("upcoming");
    expect(lifecycleFor({ projectStatus: "Contract Fell Through", status: "cancelled", hasPlan: false, handedOff: false })).toBe("fell_through");
    expect(lifecycleFor({ projectStatus: null, status: "active", hasPlan: true, handedOff: false })).toBe("active");
    expect(lifecycleFor({ projectStatus: null, status: "complete", hasPlan: true, handedOff: false })).toBe("handed_off");
  });
});

describe("Download CSV", () => {
  it("has the shown columns and quotes values", () => {
    const csv = homesCsv([row({ name: 'The "Lake" House, A' })], ["market"]);
    const [head, line] = csv.split("\n");
    expect(head?.split(",").at(-1)).toBe("Market");
    expect(line?.startsWith('"The ""Lake"" House, A"')).toBe(true);
  });
});
