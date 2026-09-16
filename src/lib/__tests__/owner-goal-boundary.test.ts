import { expect, it } from "bun:test";
import { hoursFromMinutes, ownerGoalMet, progressSnapshot } from "../owner-participation";
import { loadProgramAggregate } from "../owner-participation.server";
import { earnedBadges } from "../owner-badges.server";
import { candidateAlerts } from "../owner-progress-alerts.server";
import { completionChecklist } from "../owner-program.server";
import { loadOwnerAnalytics } from "../owner-analytics.server";

const startedOn = "2020-01-01";

/** The last entry corrects an earlier amount; each activity covers two properties. */
function fixture(countedMinutes: number) {
  const entry = (
    id: string,
    minutes: number,
    amendsEntryId: string | null = null,
    status = "approved",
  ) => ({
    id,
    program_id: "program",
    minutes,
    amends_entry_id: amendsEntryId,
    review_status: status,
    activity: "Reviewed property work and recorded findings",
    phase: "ongoing",
    entry_date: "2020-01-02",
    created_at: "2020-01-02T12:00:00Z",
    flagged: false,
  });
  const entries = [
    ...Array.from({ length: 4 }, (_, i) => entry(`base-${i}`, 1200)),
    entry("original", 1400),
    entry("correction", countedMinutes - 4800, "original"),
    entry("returned", 80, null, "returned"),
  ];
  const sources: Record<string, Record<string, unknown>[]> = {
    owner_programs: [
      {
        id: "program",
        status: "active",
        started_on: startedOn,
        owner_name: "Test Owner",
        archived_at: null,
        is_demo: false,
      },
    ],
    owner_program_properties: ["home-a", "home-b"].map((id) => ({
      id: `enrollment-${id}`,
      program_id: "program",
      property_id: id,
      inclusion_status: "included",
      properties: { name: id },
    })),
    owner_reviews: [],
    owner_review_properties: [],
    owner_time_entries: entries,
    owner_time_entry_properties: entries.flatMap((e) =>
      ["home-a", "home-b"].map((propertyId) => ({
        entry_id: e.id,
        property_id: propertyId,
        owner_time_entries: { program_id: "program" },
      })),
    ),
    owner_badges: [],
  };
  return {
    from: (table: string) => {
      let rows = [...(sources[table] ?? [])];
      const valueAt = (row: Record<string, unknown>, key: string) =>
        key
          .split(".")
          .reduce<unknown>(
            (value, part) => (value as Record<string, unknown> | undefined)?.[part],
            row,
          );
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          rows = rows.filter((row) => valueAt(row, key) === value);
          return query;
        },
        is: (key: string, value: unknown) => {
          rows = rows.filter((row) => (valueAt(row, key) ?? null) === value);
          return query;
        },
        in: (key: string, values: unknown[]) => {
          rows = rows.filter((row) => values.includes(valueAt(row, key)));
          return query;
        },
        or: () => query,
        order: () => query,
        single: async () => ({ data: rows[0] ?? null, error: null }),
        range: async (from: number, to: number) => ({
          data: rows.slice(from, to + 1),
          count: rows.length,
          error: null,
        }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: rows, error: null }).then(resolve),
      };
      return query;
    },
  };
}

it("meets the goal at exactly 6000 counted minutes, never by rounding a smaller total", () => {
  for (const [minutes, expected] of [
    [5999, false],
    [5999.99, false],
    [6000, true],
    [6001, true],
  ] as const) {
    expect(ownerGoalMet(minutes)).toBe(expected);
    const snapshot = progressSnapshot({ status: "active", startedOn, reportedMinutes: minutes });
    expect(snapshot.state === "target_reached").toBe(expected);
    expect(snapshot.hoursToGoal === 0).toBe(expected);
  }
  expect(hoursFromMinutes(5999.99)).toBe(100);
});

it("does not satisfy the goal with missing or non-finite minute totals", () => {
  for (const minutes of [NaN, Infinity, -Infinity, -1, 0]) {
    expect(ownerGoalMet(minutes)).toBe(false);
    expect(
      progressSnapshot({ status: "active", startedOn, reportedMinutes: minutes }).state ===
        "target_reached",
    ).toBe(false);
  }
});

it("uses corrected distinct-entry minutes consistently for the aggregate and closeout checklist", async () => {
  for (const [minutes, expected] of [
    [5999, false],
    [6000, true],
    [6001, true],
  ] as const) {
    const agg = await loadProgramAggregate(fixture(minutes) as never, "program");
    expect(agg.reportedMinutes).toBe(minutes);
    expect(agg.returnedMinutes).toBe(80);
    expect(agg.entries.find((entry) => entry.id === "original")?.superseded).toBe(true);
    expect(agg.properties.every((property) => property.sharedMinutes === minutes)).toBe(true);
    expect(agg.goalMet).toBe(expected);
    expect(completionChecklist(agg).hoursExceeded).toBe(expected);
    expect(completionChecklist(agg).allClear).toBe(expected);
  }
});

it("awards the 100-hour badge and celebration at the same unrounded counted boundary", async () => {
  for (const [minutes, expected] of [
    [5999, false],
    [5999.99, false],
    [6000, true],
    [6001, true],
  ] as const) {
    const agg = await loadProgramAggregate(fixture(minutes) as never, "program");
    expect(earnedBadges(agg).some((badge) => badge.code === "hundred_plus")).toBe(expected);
    expect(candidateAlerts(agg).some((alert) => alert.kind === "goal_exceeded")).toBe(expected);
  }
});

it("keeps staff analytics aligned after corrections even when displayed hours round to 100", async () => {
  for (const [minutes, expected] of [
    [5999, false],
    [5999.99, false],
    [6000, true],
    [6001, true],
  ] as const) {
    const analytics = await loadOwnerAnalytics(fixture(minutes) as never);
    expect(analytics.programs.length).toBe(1);
    expect(analytics.programs[0]?.goalMet).toBe(expected);
    expect(analytics.programs[0]?.entries).toBe(5);
    expect(analytics.totals.goalMet).toBe(expected ? 1 : 0);
    if (minutes === 5999.99) expect(analytics.programs[0]?.reportedHours).toBe(100);
  }
});
