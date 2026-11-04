import { describe, expect, it } from "bun:test";
import {
  applyCoverageActions,
  cellBlocks,
  centralInstant,
  filterUsers,
  generateRotation,
  needsOwnerAlert,
  nextMonday,
  nightStatus,
  oncallForNight,
  planNewShift,
  planShiftEdit,
  planTimeOff,
  rotationRowsToReplace,
  ROTATION_LABEL,
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
  it("weeks start Sunday; rotation starts next Monday", () => {
    expect(weekStart("2026-11-11")).toBe("2026-11-08");
    expect(nextMonday("2026-11-04")).toBe("2026-11-09");
    expect(nextMonday("2026-11-09")).toBe("2026-11-09");
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
  it("refuses a person with no seat", () => {
    expect(() => planTimeOff({ roles, userId: C, startsAt, endsAt, note: "", coverUserId: null })).toThrow("does not hold a seat");
  });
  it("shows Out on the grid and in Who's out", () => {
    const off = { id: "o1", role_code: "ge_day", kind: "off", user_id: null, starts_at: startsAt, ends_at: endsAt, note: null };
    const b = cellBlocks("ge_day", "2026-11-09", [shift], [off]);
    expect(b[0]!.out).toBe(true);
    expect(cellBlocks("ge_day", "2026-11-16", [shift], [off])[0]!.out).toBe(false);
    expect(whosOut("2026-11-08", roles, [off])).toMatchObject([{ personId: A, coverUserId: null }]);
  });
});

describe("On call", () => {
  it("weekly rotation Monday to Sunday for 8 weeks, cycling the list", () => {
    const rows = generateRotation([A, B], "2026-11-09", 8);
    expect(rows).toHaveLength(8);
    expect(rows[0]).toEqual({ userId: A, startsOn: "2026-11-09", endsOn: "2026-11-15" });
    expect(rows[1]!.userId).toBe(B);
    expect(rows[7]).toEqual({ userId: B, startsOn: "2026-12-28", endsOn: "2027-01-03" });
    expect(() => generateRotation([A], "2026-11-10")).toThrow();
  });
  it("only replaces its own rotation rows", () => {
    const roster = [
      { id: "r1", user_id: A, starts_on: "2026-11-09", ends_on: "2026-11-15", label: ROTATION_LABEL },
      { id: "r2", user_id: B, starts_on: "2026-11-10", ends_on: "2026-11-10", label: "Single night on-call" },
    ];
    expect(rotationRowsToReplace(roster, "2026-11-09").map((r) => r.id)).toEqual(["r1"]);
  });
  it("a single-night entry wins over the weekly rotation", () => {
    const roster = [
      { id: "r1", user_id: A, starts_on: "2026-11-09", ends_on: "2026-11-15", label: ROTATION_LABEL, created_at: "2026-11-05" },
      { id: "r2", user_id: B, starts_on: "2026-11-10", ends_on: "2026-11-10", label: "x", created_at: "2026-11-01" },
    ];
    expect(oncallForNight(roster, "2026-11-10")!.user_id).toBe(B);
    expect(oncallForNight(roster, "2026-11-11")!.user_id).toBe(A);
  });
  it("needs cover when the on-call person is out that night; empty nights are flagged", () => {
    const roster = [{ id: "r1", user_id: A, starts_on: "2026-11-09", ends_on: "2026-11-15", label: ROTATION_LABEL }];
    const off = { id: "o", role_code: "ge_day", kind: "off", user_id: null, starts_at: centralInstant("2026-11-10", 0), ends_at: centralInstant("2026-11-11", 0), note: null };
    expect(nightStatus("2026-11-10", roster, roles, [off]).needsCover).toBe(true);
    expect(nightStatus("2026-11-12", roster, roles, [off]).needsCover).toBe(false);
    expect(nightStatus("2026-11-20", roster, roles, []).empty).toBe(true);
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
