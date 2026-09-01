import { describe, expect, it } from "bun:test";
import {
  SEAT_TEAMS,
  TEAM_A,
  TEAM_B,
  decideRoute,
  isTeamA,
  isTeamB,
  isWithinWindow,
  localWeekdayMinutes,
  pickLightestCandidate,
  triageRoleFor,
  weightOf,
  type TriageWindow,
} from "../coverage-model";

/** The six approved cross-team triage windows, as seeded. */
const TRIAGE: TriageWindow[] = [
  { weekday: 1, start_minute: 1020, end_minute: 1320, covers_team: TEAM_B, role_code: "ge_evening" },
  { weekday: 2, start_minute: 480, end_minute: 780, covers_team: TEAM_B, role_code: "po_day" },
  { weekday: 2, start_minute: 1020, end_minute: 1320, covers_team: TEAM_B, role_code: "ge_evening" },
  { weekday: 3, start_minute: 1020, end_minute: 1320, covers_team: TEAM_B, role_code: "ge_evening" },
  { weekday: 6, start_minute: 480, end_minute: 780, covers_team: TEAM_B, role_code: "ge_day" },
  { weekday: 0, start_minute: 480, end_minute: 780, covers_team: TEAM_B, role_code: "ge_day" },
];

const base = {
  afterHours: false,
  onCallUserId: null,
  teamB: [] as { userId: string; roleCode: string; weight: number }[],
  lastRouted: new Map<string, string>(),
  triage: null,
  supervisorOnDuty: null,
};

describe("seat classification", () => {
  it("puts Avy's and Mike's seats on Team A", () => {
    expect(isTeamA("ge_day")).toBe(true); // Avy Vergara — Day/Weekend
    expect(isTeamB("ge_day")).toBe(false);
    expect(isTeamA("ge_evening")).toBe(true); // Mike Cacatain — Evening
  });

  it("puts Roms's and Christine's seats on Team B", () => {
    expect(isTeamB("po_day")).toBe(true); // Romeo Canales — Weekday Day
    expect(isTeamB("po_evening")).toBe(true); // Christine Sendico — Evening/Weekend
    expect(SEAT_TEAMS["po_day"]).toBe(TEAM_B);
    expect(SEAT_TEAMS["ge_day"]).toBe(TEAM_A);
  });
});

describe("cross-team triage windows", () => {
  const cases: [string, number, number, string][] = [
    ["Monday evening", 1, 18 * 60, "ge_evening"],
    ["Tuesday morning", 2, 9 * 60, "po_day"],
    ["Tuesday evening", 2, 19 * 60, "ge_evening"],
    ["Wednesday evening", 3, 20 * 60, "ge_evening"],
    ["Saturday morning", 6, 9 * 60, "ge_day"],
    ["Sunday morning", 0, 10 * 60, "ge_day"],
  ];
  for (const [label, weekday, minutes, expected] of cases) {
    it(`${label} routes to ${expected}`, () => {
      expect(triageRoleFor(TRIAGE, weekday, minutes, TEAM_B)).toBe(expected);
    });
  }

  it("is silent outside the approved windows", () => {
    expect(triageRoleFor(TRIAGE, 1, 10 * 60, TEAM_B)).toBeNull();
    expect(triageRoleFor(TRIAGE, 4, 19 * 60, TEAM_B)).toBeNull();
  });
});

describe("routing precedence", () => {
  it("prefers Team B's lightest weighted queue during normal coverage", () => {
    const d = decideRoute({
      ...base,
      teamB: [
        { userId: "roms", roleCode: "po_day", weight: 8 },
        { userId: "chris", roleCode: "po_evening", weight: 3 },
      ],
    });
    expect(d.userId).toBe("chris");
    expect(d.fallback).toBe(false);
  });

  it("keeps P1=5 / P2=3 / P3=1 weighting", () => {
    expect(weightOf("p1")).toBe(5);
    expect(weightOf("p2")).toBe(3);
    expect(weightOf("p3")).toBe(1);
    expect(weightOf(null)).toBe(1);
  });

  it("breaks ties by least recently routed, then user id", () => {
    const last = new Map([
      ["a", "2026-01-02T00:00:00Z"],
      ["b", "2026-01-01T00:00:00Z"],
    ]);
    const pool = [
      { userId: "a", roleCode: "po_day", weight: 3 },
      { userId: "b", roleCode: "po_evening", weight: 3 },
      { userId: "c", roleCode: "po_day", weight: 3 },
    ];
    expect(pickLightestCandidate(pool, last)!.userId).toBe("c"); // never routed
    expect(pickLightestCandidate(pool.slice(0, 2), last)!.userId).toBe("b");
  });

  it("lets the overnight on-call person win over Team B", () => {
    const d = decideRoute({
      ...base,
      afterHours: true,
      onCallUserId: "oncall",
      teamB: [{ userId: "chris", roleCode: "po_evening", weight: 0 }],
    });
    expect(d.userId).toBe("oncall");
    expect(d.reason).toContain("Priority is unchanged");
  });

  it("uses the cross-team role when Team B is off duty", () => {
    const d = decideRoute({ ...base, triage: { userId: "mike", roleCode: "ge_evening" } });
    expect(d.userId).toBe("mike");
    expect(d.fallback).toBe(false);
    expect(d.reason).toContain("covered, not a gap");
  });

  it("uses the Supervisor only when the Supervisor is on duty", () => {
    const d = decideRoute({ ...base, supervisorOnDuty: { userId: "james", roleCode: "ops_supervisor" } });
    expect(d.userId).toBe("james");
    expect(d.fallback).toBe(true);
  });

  it("never silently assigns an off-duty Supervisor — it leaves the ticket for Oversight", () => {
    const d = decideRoute({ ...base });
    expect(d.userId).toBeNull();
    expect(d.roleCode).toBeNull();
    expect(d.fallback).toBe(true);
    expect(d.reason).toContain("Oversight");
  });

  it("cannot seat an unredeemed invitee: an empty Team B pool is simply no candidate", () => {
    // A pending seat has current_seat_holder = null, so it never reaches the
    // candidate list — there is no phantom holder to route to.
    const d = decideRoute({ ...base, teamB: [] });
    expect(d.userId).toBeNull();
  });
});

describe("Central-time windows", () => {
  it("handles overnight windows", () => {
    expect(isWithinWindow(23 * 60, 22 * 60, 8 * 60)).toBe(true);
    expect(isWithinWindow(3 * 60, 22 * 60, 8 * 60)).toBe(true);
    expect(isWithinWindow(12 * 60, 22 * 60, 8 * 60)).toBe(false);
  });

  it("reads weekday and minute in Central regardless of server time", () => {
    // 2026-03-09T02:30:00Z is Sunday 8:30 p.m. Central on 2026-03-08.
    const { weekday, minutes } = localWeekdayMinutes(new Date("2026-03-09T02:30:00Z"), "America/Chicago");
    expect(weekday).toBe(0);
    expect(minutes).toBe(20 * 60 + 30);
  });

  it("treats midnight Central as minute 0, not 1440", () => {
    const { minutes } = localWeekdayMinutes(new Date("2026-07-04T05:00:00Z"), "America/Chicago");
    expect(minutes).toBe(0);
  });
});
