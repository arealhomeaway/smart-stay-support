import { describe, expect, it } from "bun:test";
import {
  applyCoverageActions,
  cellBlocks,
  centralInstant,
  applyNightChanges,
  filterUsers,
  gridRows,
  gridSeatCodes,
  isTestAccount,
  oncallPickerPeople,
  patternFromRoster,
  planRangeAssign,
  planRemoveOverride,
  planSwap,
  staffPickerPeople,
  type SRoster,
  type StaffPerson,
  needsOwnerAlert,
  nightStatus,
  oncallForNight,
  planNewShift,
  planShiftEdit,
  planTimeOff,
  userRows,
  weekStart,
  whosOut,
  type SRole,
  type SShift,
} from "../team-schedule";

const A = "a0000000-0000-4000-8000-000000000001";
const B = "a0000000-0000-4000-8000-000000000002";
const C = "a0000000-0000-4000-8000-000000000003";
const roles: SRole[] = [
  { code: "ge_day", name: "GE day", current_seat_holder: A, current_seat_name: "Ann" },
  { code: "po_day", name: "PO day", current_seat_holder: B, current_seat_name: "Bo" },
];
// 2026-11-09 is a Monday.
const shift: SShift = { id: "s1", role_code: "ge_day", weekday: 1, start_minute: 8 * 60, end_minute: 17 * 60 };
const base = { roleCode: "ge_day", date: "2026-11-09", shift, seatHolder: A, start: 480, end: 1020, personId: A, markOut: false };

describe("Central time helpers", () => {
  it("converts Central wall clock to UTC across daylight saving", () => {
    expect(centralInstant("2026-11-09", 480)).toBe("2026-11-09T14:00:00.000Z"); // CST
    expect(centralInstant("2026-07-06", 480)).toBe("2026-07-06T13:00:00.000Z"); // CDT
  });
  it("weeks start Sunday", () => {
    expect(weekStart("2026-11-11")).toBe("2026-11-08");
  });
});

describe("Grid edits write the right table", () => {
  it("this week only, person changed: a cover override with exact timestamps, no seat change", () => {
    const a = planShiftEdit({ ...base, scope: "week", personId: C });
    expect(a).toEqual([{ type: "override", roleCode: "ge_day", kind: "cover", userId: C, startsAt: "2026-11-09T14:00:00.000Z", endsAt: "2026-11-09T23:00:00.000Z", note: "" }]);
  });
  it("this week only, mark out: an off override for that date", () => {
    const a = planShiftEdit({ ...base, scope: "week", markOut: true });
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ type: "override", kind: "off", startsAt: "2026-11-09T14:00:00.000Z" });
  });
  it("every week, hours changed: edits the recurring shift row", () => {
    expect(planShiftEdit({ ...base, scope: "every", start: 540 })).toEqual([
      { type: "shift", id: "s1", roleCode: "ge_day", weekday: 1, startMinute: 540, endMinute: 1020 },
    ]);
  });
  it("every week, person changed: goes through setSeatHolder", async () => {
    const a = planShiftEdit({ ...base, scope: "every", personId: C });
    expect(a).toEqual([{ type: "seatHolder", roleCode: "ge_day", userId: C }]);
    const calls: string[] = [];
    await applyCoverageActions(a, {
      saveOverride: async () => calls.push("override"),
      saveShift: async () => calls.push("shift"),
      deleteShift: async () => calls.push("delete"),
      setSeatHolder: async () => calls.push("seatHolder"),
    });
    expect(calls).toEqual(["seatHolder"]);
  });
  it("empty cell: this week = cover override, every week = new shift row", () => {
    const e = { roleCode: "ge_day", date: "2026-11-10", start: 480, end: 720, personId: null, seatHolder: A };
    expect(planNewShift({ ...e, scope: "week" })[0]).toMatchObject({ type: "override", kind: "cover", userId: A });
    expect(planNewShift({ ...e, scope: "every" })).toEqual([{ type: "shift", id: null, roleCode: "ge_day", weekday: 2, startMinute: 480, endMinute: 720 }]);
  });
});

describe("Time off", () => {
  const startsAt = centralInstant("2026-11-09", 0), endsAt = centralInstant("2026-11-10", 0);
  it("creates an off override on each seat held, then cover", () => {
    const a = planTimeOff({ roles, userId: A, startsAt, endsAt, note: "Doctor", coverUserId: C });
    expect(a.map((x) => x.type === "override" && x.kind)).toEqual(["off", "cover"]);
  });
  it("refuses a person who is not on the schedule", () => {
    expect(() => planTimeOff({ roles, userId: C, startsAt, endsAt, note: "", coverUserId: null })).toThrow("is not on the schedule yet");
  });
  it("shows Out on the grid and in Who's out", () => {
    const off = { id: "o1", role_code: "ge_day", kind: "off", user_id: null, starts_at: startsAt, ends_at: endsAt, note: null };
    const b = cellBlocks("ge_day", "2026-11-09", [shift], [off]);
    expect(b[0]!.out).toBe(true);
    expect(cellBlocks("ge_day", "2026-11-16", [shift], [off])[0]!.out).toBe(false);
    expect(whosOut("2026-11-08", roles, [off])).toMatchObject([{ personId: A, coverUserId: null }]);
  });
});

describe("On call: weekday pattern with date changes", () => {
  // Live pattern on Nov 1 to 7, 2026 (Sun to Sat): Micah, Micah, Emily, James, Micah, Emily, James.
  const M = "m", E = "e", J = "j";
  const live: SRoster[] = ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"].map((d, i) => ({
    id: `r${i}`, user_id: [M, M, E, J, M, E, J][i]!, starts_on: d, ends_on: d, label: "Single night on-call", created_at: "2026-11-01",
  }));
  const older: SRoster = { id: "old", user_id: J, starts_on: "2026-10-25", ends_on: "2026-10-25", label: "x", created_at: "2026-10-01" };
  const pattern = patternFromRoster([older, ...live]);
  it("pre-fills the pattern from the latest roster night of each weekday", () => {
    expect(pattern).toEqual([M, M, E, J, M, E, J]);
  });
  it("the pattern keeps extending: no night runs out after the last roster row", () => {
    for (let i = 0; i < 400; i++) {
      const d = new Date(Date.UTC(2026, 10, 8 + i)).toISOString().slice(0, 10);
      expect(oncallForNight(live, d, pattern).userId).not.toBeNull();
    }
    expect(oncallForNight(live, "2026-11-08", pattern)).toMatchObject({ userId: M, source: "pattern" });
    expect(oncallForNight(live, "2026-11-20", null).userId).toBeNull();
  });
  it("a date change always wins over the pattern", () => {
    const r = applyNightChanges(live, [{ date: "2026-11-10", userId: J, note: "trade" }]);
    expect(oncallForNight(r, "2026-11-10", pattern)).toMatchObject({ userId: J, source: "date" });
    expect(nightStatus("2026-11-10", r, roles, [], pattern)).toMatchObject({ isOverride: true, note: "trade" });
  });
  it("changing the pattern keeps date changes", () => {
    const r = applyNightChanges(live, [{ date: "2026-11-10", userId: J, note: "" }]);
    const newPattern = [E, E, E, E, E, E, E];
    expect(oncallForNight(r, "2026-11-10", newPattern).userId).toBe(J);
    expect(oncallForNight(r, "2026-11-11", newPattern).userId).toBe(E);
  });
  it("assigns one person to a date range", () => {
    const c = planRangeAssign("2026-11-20", "2026-11-23", E, "vacation");
    expect(c.map((x) => x.date)).toEqual(["2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23"]);
    const r = applyNightChanges(live, c);
    expect(["2026-11-20", "2026-11-23"].map((d) => oncallForNight(r, d, pattern).userId)).toEqual([E, E]);
    expect(() => planRangeAssign("2026-11-23", "2026-11-20", E)).toThrow();
  });
  it("swaps two nights in one step", () => {
    // Tue Nov 10 = Emily, Wed Nov 11 = James by pattern.
    const c = planSwap("2026-11-10", "2026-11-11", live, pattern);
    expect(c).toEqual([{ date: "2026-11-10", userId: J, note: "" }, { date: "2026-11-11", userId: E, note: "" }]);
    const r = applyNightChanges(live, c);
    expect([oncallForNight(r, "2026-11-10", pattern).userId, oncallForNight(r, "2026-11-11", pattern).userId]).toEqual([J, E]);
  });
  it("removing a date change falls back to the pattern", () => {
    const r = applyNightChanges(applyNightChanges(live, [{ date: "2026-11-10", userId: J, note: "" }]), planRemoveOverride("2026-11-10"));
    expect(oncallForNight(r, "2026-11-10", pattern)).toMatchObject({ userId: E, source: "pattern" });
  });
  it("a shorter entry still wins over a longer one", () => {
    const roster = [
      { id: "w", user_id: A, starts_on: "2026-11-09", ends_on: "2026-11-15", label: "week", created_at: "2026-11-05" },
      { id: "n", user_id: B, starts_on: "2026-11-10", ends_on: "2026-11-10", label: "x", created_at: "2026-11-01" },
    ];
    expect(oncallForNight(roster, "2026-11-10").userId).toBe(B);
    expect(oncallForNight(roster, "2026-11-11").userId).toBe(A);
  });
  it("flags a night red when the on-call person has time off, or no one is on call", () => {
    const p = [A, A, A, A, A, A, A];
    const off = { id: "o", role_code: "ge_day", kind: "off", user_id: null, starts_at: centralInstant("2026-11-10", 0), ends_at: centralInstant("2026-11-11", 0), note: null };
    expect(nightStatus("2026-11-10", [], roles, [off], p).needsCover).toBe(true);
    expect(nightStatus("2026-11-12", [], roles, [off], p).needsCover).toBe(false);
    expect(nightStatus("2026-11-20", [], roles, [], null).empty).toBe(true);
  });
});

describe("Who appears in lists and pickers", () => {
  const people: StaffPerson[] = [
    { id: A, full_name: "Ann", email: "ann@arealhomeaway.com", roles: ["tech"], active: true },
    { id: B, full_name: "Bo", email: "bo@arealhomeaway.com", roles: ["tech"], active: false },
    { id: C, full_name: "Cy", email: "cy@arealhomeaway.com", roles: ["manager"], active: true },
    { id: "own", full_name: "Owner", email: "o@gmail.com", roles: ["owner"], active: true },
    { id: "ven", full_name: "Vendor", email: "v@x.com", roles: ["vendor"], active: true },
    { id: "qa", full_name: "QA Micah", email: "qa.micah@resolve-test.invalid", roles: ["manager"], active: true },
    { id: "ex", full_name: "Emily", email: "emily.test@example.com", roles: ["tech"], active: true },
    { id: "emma", full_name: "Emma Renee", email: "emily.r.jimenez4@gmail.com", roles: ["onboarding"], active: true },
  ];
  const seated: SRole[] = [...roles, { code: "x", name: "x", current_seat_holder: "qa", current_seat_name: null }, { code: "y", name: "y", current_seat_holder: "own", current_seat_name: null }];
  it("test accounts: flagged list, test email domains, names starting QA", () => {
    expect(isTestAccount(people[5]!)).toBe(true);
    expect(isTestAccount(people[6]!)).toBe(true);
    expect(isTestAccount({ id: "z", full_name: "Z", email: "z@example.invalid" })).toBe(true);
    expect(isTestAccount(people[7]!)).toBe(false);
    expect(isTestAccount(people[7]!, ["emma"])).toBe(true);
    expect(isTestAccount(people[0]!)).toBe(false);
  });
  it("shift and time-off pickers: active staff holding a seat, never owners, vendors or test accounts", () => {
    expect(staffPickerPeople(people, seated, []).map((p) => p.id)).toEqual([A]);
  });
  it("on-call pickers show only the eligible list", () => {
    expect(oncallPickerPeople(people, [C, "qa", "own"], []).map((p) => p.id)).toEqual([C]);
  });
  it("grid rows come from the setting; hidden seats keep their data", () => {
    const all: SRole[] = [...roles, { code: "ops_supervisor", name: "Sup", current_seat_holder: C, current_seat_name: null }];
    const def = gridSeatCodes(null, all, (c) => c.startsWith("ge_") || c.startsWith("po_"));
    expect(def).toEqual(["ge_day", "po_day"]);
    expect(gridRows(all, gridSeatCodes(["po_day"], all, () => true)).map((r) => r.code)).toEqual(["po_day"]);
    expect(all.find((r) => r.code === "ops_supervisor")!.current_seat_holder).toBe(C);
  });
  it("the Users tab is staff only with an Admin test-account toggle", () => {
    const ui = require("node:fs").readFileSync("src/components/team/UsersTab.tsx", "utf8") as string;
    expect(ui).toContain("isStaff(p) && (showTest || !isTestAccount(p, testIds))");
    expect(ui).toContain("Show test accounts");
    expect(ui).toContain("if (!isAdmin) return");
  });
  it("routing does not read the grid rows setting", () => {
    const sql = require("node:fs").readFileSync("docs/pending/team-coverage-pass-a2/01_oncall_weekday_pattern.sql", "utf8") as string;
    expect(sql).not.toContain("schedule_grid_seats");
  });
});

describe("Users table", () => {
  const rows = userRows(
    [
      { id: A, full_name: "Ann", email: "ann@x.com", roles: ["tech"], state: "active", lastSignIn: "2026-11-01" },
      { id: C, full_name: "Cy", email: "cy@x.com", roles: ["manager"], state: "invited" },
      { id: "d", full_name: "Di", email: "di@x.com", roles: ["tech"], state: "disabled" },
    ],
    roles,
    (r) => (r.includes("manager") ? "Supervisor" : "Property Coordinator"),
    (c) => (c.startsWith("ge_") ? "Team A" : "Team B"),
    (c) => c.toUpperCase(),
  );
  it("derives seat, team and status", () => {
    expect(rows[0]).toMatchObject({ seat: "GE_DAY", team: "Team A", status: "Active" });
    expect(rows[1]).toMatchObject({ seat: "None", status: "Invite pending" });
    expect(rows[2]!.status).toBe("Off");
  });
  it("filters by search, role and status", () => {
    expect(filterUsers(rows, { q: "cy", role: "all", status: "all" }).map((r) => r.id)).toEqual([C]);
    expect(filterUsers(rows, { q: "", role: "Property Coordinator", status: "Off" }).map((r) => r.id)).toEqual(["d"]);
  });
});

describe("Needs an owner alert", () => {
  it("is hidden at zero", () => {
    expect(needsOwnerAlert(0)).toBeNull();
    expect(needsOwnerAlert(3)).toBe("3 tickets need an owner");
  });
});

describe("Read only for non-supervisors", () => {
  const src = require("node:fs").readFileSync("src/lib/coverage-admin.functions.ts", "utf8") as string;
  it("every schedule write checks the existing supervisor rule on the server", () => {
    for (const fn of ["setSeatHolder", "saveShift", "deleteShift", "saveOverride", "deleteOverride", "saveOnCall", "deleteOnCall", "saveOnCallPattern", "saveOnCallNights"]) {
      const body = src.split(`export const ${fn} =`)[1]!.split("export const ")[0]!;
      expect(body).toContain("assertCanEditCoverage(context)");
    }
  });
  it("the grid shows edit controls only when the server says the viewer can edit", () => {
    const ui = require("node:fs").readFileSync("src/components/team/ScheduleTab.tsx", "utf8") as string;
    expect(ui).toContain("canEdit: data.canEdit === true");
    expect((ui.match(/!m\.canEdit/g) ?? []).length).toBe(2);
    expect(ui).not.toContain("Weekly rotation");
    expect((ui.match(/m\.canEdit \?/g) ?? []).length).toBe(3);
  });
});

import { USER_REMOVAL_ENABLED } from "@/lib/user-removal";
import { isTestAccount as _isTest } from "@/lib/team-schedule";
describe("Emily's confirmed test account list stays hidden by default", () => {
  it("each listed account is classified as a test account", () => {
    const flagged = ["emma"];
    const list = [
      { id: "1", full_name: "QA James", email: "qa.james@resolve-test.invalid" },
      { id: "2", full_name: "qa.um.admin", email: "qa.um.admin@resolve-test.invalid" },
      { id: "3", full_name: "Emily Jimenez", email: "emily.test@example.com" },
      { id: "4", full_name: "pr10-owner-a-20260917@example.invalid", email: "pr10-owner-a-20260917@example.invalid" },
      { id: "5", full_name: "pr10-owner-b-20260917@example.invalid", email: "pr10-owner-b-20260917@example.invalid" },
      { id: "6", full_name: "Avery Lindqvist (demo owner)", email: "qa.owner@resolve-test.invalid" },
      { id: "7", full_name: "Riley Alder (DEMO)", email: "riley.alder@demo.arha.test" },
      { id: "emma", full_name: "Emma Renee", email: "emily.r.jimenez4@gmail.com" },
    ];
    for (const p of list) expect(_isTest(p, flagged)).toBe(true);
    expect(_isTest({ id: "x", full_name: "James Almario", email: "james@arha.com" }, flagged)).toBe(false);
  });
  it("Delete user and Archive are on now that their database file is applied", () => {
    expect(USER_REMOVAL_ENABLED).toBe(true);
  });
});
