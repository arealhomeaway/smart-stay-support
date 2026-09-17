import { expect, it } from "bun:test";
import { earnedBadges, syncProgramBadges } from "../owner-badges.server";
import {
  countableParticipationEntries,
  inParticipationWindow,
  participationWindowEnd,
} from "../owner-participation";
import type { ProgramAggregate } from "../owner-participation.server";

const entry = (
  id: string,
  date: string,
  minutes = 60,
  amends: string | null = null,
  status = "approved",
) => ({
  id,
  entry_date: date,
  minutes,
  amends_entry_id: amends,
  review_status: status,
  propertyIds: ["home"],
});
function aggregate(entries: ReturnType<typeof entry>[], extra: Record<string, unknown> = {}) {
  return {
    program: { id: "program", startedOn: "2020-01-01", endsOn: "2020-03-30", status: "active" },
    entries,
    includedProperties: [],
    reviews: [],
    badges: [],
    reportedMinutes: 99999,
    snapshot: { day: 90 },
    ...extra,
  } as unknown as ProgramAggregate;
}
it("uses one inclusive90day window and excludes future/unstarted history without deleting it", () => {
  expect(participationWindowEnd("2020-01-01", "2020-12-31")).toBe("2020-03-30");
  expect(inParticipationWindow("2020-03-30", "2020-01-01", null, "2020-03-30")).toBe(true);
  expect(inParticipationWindow("2020-03-31", "2020-01-01", null, "2020-04-01")).toBe(false);
  expect(inParticipationWindow("2019-12-31", "2020-01-01", null, "2020-04-01")).toBe(false);
  expect(inParticipationWindow("2020-01-08", "2020-01-01", null, "2020-01-07")).toBe(false);
  expect(inParticipationWindow("2020-01-01", null)).toBe(false);
});
it("firststep and weekly badges ignore returned, superseded and outside-period rows", () => {
  const rows = [
    entry("old", "2020-01-01"),
    entry("returned", "2020-01-08", 60, "old", "returned"),
    entry("before", "2019-12-31"),
    entry("after", "2020-03-31"),
  ];
  expect(earnedBadges(aggregate(rows))).toEqual([]);
  expect(rows).toHaveLength(4);
  const valid = [
    ...rows,
    entry("fixed", "2020-01-08", 60, "returned"),
    entry("week3", "2020-01-15"),
    entry("week4", "2020-01-22"),
  ];
  expect(earnedBadges(aggregate(valid)).map((b) => b.code)).toContain("consistent_participation");
  expect(
    countableParticipationEntries(valid).filter((e) =>
      inParticipationWindow(e.entry_date, "2020-01-01"),
    ),
  ).toHaveLength(3);
});
it("uses exact counted minutes and distinct entries at every hour boundary", () => {
  for (const [minutes, met] of [
    [5999, false],
    [5999.99, false],
    [6000, true],
  ] as const) {
    const e = entry("shared", "2020-01-02", minutes);
    expect(earnedBadges(aggregate([e, e])).some((b) => b.code === "hundred_plus")).toBe(met);
  }
});
it("does not award decisions for unresponded drafts or removed Property context", () => {
  const review = {
    id: "review",
    phase: "onboarding",
    status: "draft",
    owner_decision: "approve",
    responded_at: "2020-01-08T12:00:00Z",
    respond_by: "2020-01-09",
    available_from: null,
    propertyIds: ["removed"],
  };
  expect(earnedBadges(aggregate([], { reviews: [review] }))).toEqual([]);
  expect(
    earnedBadges(
      aggregate([], { reviews: [{ ...review, status: "answered", propertyIds: [] }] }),
    ).map((b) => b.code),
  ).toContain("decision_maker");
  expect(
    earnedBadges(
      aggregate([], {
        reviews: [{ ...review, status: "answered", propertyIds: [], responded_at: null }],
      }),
    ),
  ).toEqual([]);
});
it("hands only verified actor/program/version to the atomic refresher, without table writes", async () => {
  const calls: unknown[] = [];
  const client = {
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return {
        data:
          name === "owner_badge_refresh_version"
            ? "version"
            : {
                awarded: ["first_step"],
                flagged: [],
                recovered: [],
                reportVersion: "next-version",
                ignored: "private-extra",
              },
        error: null,
      };
    },
  };
  expect(await syncProgramBadges(client as never, "actor", "program")).toEqual({
    awarded: ["first_step"],
    flagged: [],
    recovered: [],
    reportVersion: "next-version",
  });
  expect(calls).toEqual([
    { name: "owner_badge_refresh_version", args: { _program_id: "program", _actor_id: "actor" } },
    {
      name: "refresh_owner_badges",
      args: { _program_id: "program", _expected_version: "version", _actor_id: "actor" },
    },
  ]);
});
it("rejects incomplete or malformed refresh receipts rather than claiming fresh achievements", async () => {
  const valid = { awarded: [], flagged: [], recovered: [], reportVersion: "next-version" };
  const malformed = [
    null,
    [],
    "next-version",
    {},
    { ...valid, reportVersion: undefined },
    { ...valid, reportVersion: 1 },
    { ...valid, reportVersion: " " },
    ...["awarded", "flagged", "recovered"].flatMap((key) => [
      { ...valid, [key]: undefined },
      { ...valid, [key]: "first_step" },
      { ...valid, [key]: [1] },
      { ...valid, [key]: ["unrecognized_badge"] },
      { ...valid, [key]: ["toString"] },
    ]),
  ];
  for (const receipt of malformed) {
    const client = {
      rpc: async (name: string) => ({
        data: name === "owner_badge_refresh_version" ? "version" : receipt,
        error: null,
      }),
    };
    await expect(syncProgramBadges(client as never, "actor", "program")).rejects.toThrow(
      "Could not confirm",
    );
  }
});
it("surfaces stale/history failures without treating an uncommitted award as success", async () => {
  for (const failed of ["owner_badge_refresh_version", "refresh_owner_badges"]) {
    const client = {
      rpc: async (name: string) =>
        name === failed
          ? { data: null, error: { message: "changed" } }
          : { data: "version", error: null },
    };
    await expect(syncProgramBadges(client as never, "actor", "program")).rejects.toMatchObject({
      message: "changed",
    });
  }
});
