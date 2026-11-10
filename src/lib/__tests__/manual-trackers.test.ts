import { describe, expect, it } from "bun:test";
import { CHECKLIST, centralToday, countText, mondayOf, reviewProblem, TRACKER_COPY } from "@/lib/manual-trackers";

const ALL = Object.fromEntries(CHECKLIST.map((c) => [c.key, true]));

describe("manual trackers (Build 14) helpers", () => {
  it("a record is clean only when every item is there, proof included", () => {
    expect(reviewProblem(true, ALL, "", "")).toBeNull();
    expect(reviewProblem(true, { ...ALL, proof_attached: false }, "", "")).toContain("proof included");
  });
  it("Not clean needs a note and a link to the evidence", () => {
    expect(reviewProblem(false, ALL, "", "https://x.example/a")).toContain("note");
    expect(reviewProblem(false, ALL, "Missing photo", "not a link")).toContain("link");
    expect(reviewProblem(false, ALL, "Missing photo", "https://x.example/a")).toBeNull();
  });
  it("weeks start on Monday and Central dates are used", () => {
    expect(mondayOf("2026-11-19")).toBe("2026-11-16");
    expect(mondayOf("2026-11-16")).toBe("2026-11-16");
    expect(centralToday(new Date("2026-11-17T04:30:00Z"))).toBe("2026-11-16");
  });
  it("counts read as plain words", () => {
    expect(countText({ met: 4, total: 5 })).toBe("4 of 5 (80%)");
    expect(countText({ met: 0, total: 0 })).toBe("None");
  });
  it("screen words follow the word rules", () => {
    const words = JSON.stringify(TRACKER_COPY) + JSON.stringify(CHECKLIST);
    expect(words).not.toMatch(/[\u2013\u2014]/);
    expect(words).not.toMatch(/\bseat\b|Median|\bP[1-4]\b/i);
  });
});

import { readFileSync } from "node:fs";
import { can } from "@/lib/permissions";
import { canOpenPath } from "@/lib/route-access";

describe("manual trackers (Build 14) access", () => {
  const PAGES = ["team_records", "coaching_log", "weekly_scorecard"] as const;
  const who = (roles: Parameters<typeof can>[0], seats: Parameters<typeof can>[2] = {}) =>
    PAGES.filter((p) => can(roles, p, seats));

  it("the Supervisor, the Director of Operations and Admin open all three pages", () => {
    expect(who(["manager"], { opsSupervisor: true })).toEqual([...PAGES]);
    expect(who(["manager"], { opsDirector: true })).toEqual([...PAGES]);
    expect(who(["admin"])).toEqual([...PAGES]);
  });
  it("Finance opens Team records and the Weekly scorecard only, never Coaching", () => {
    expect(who(["manager"], { finance: true })).toEqual(["team_records", "weekly_scorecard"]);
  });
  it("a coordinator opens their own Team records and Coaching, never the Weekly scorecard", () => {
    expect(who(["tech"])).toEqual(["team_records", "coaching_log"]);
  });
  it("onboarding roles, vendors and homeowners open none", () => {
    expect(who(["onboarding"], { onboardingDirector: true, projectManager: true })).toEqual([]);
    expect(who(["vendor"])).toEqual([]);
    expect(who(["owner"])).toEqual([]);
  });
  it("the page addresses follow the same rule", () => {
    expect(canOpenPath("/weekly-scorecard", { roles: ["tech"], seats: {} })).toBe(false);
    expect(canOpenPath("/coaching", { roles: ["manager"], seats: { finance: true } })).toBe(false);
    expect(canOpenPath("/team-records", { roles: ["onboarding"], seats: { projectManager: true } })).toBe(false);
  });
  it("the new screens carry no banned word, tracking code or long dash", () => {
    for (const f of [
      "src/routes/_authenticated/team-records.tsx",
      "src/routes/_authenticated/coaching.tsx",
      "src/routes/_authenticated/weekly-scorecard.tsx",
      "src/components/home/TrackersWaiting.tsx",
      "src/components/trackers/parts.tsx",
      "src/lib/manual-trackers.ts",
    ]) {
      const text = readFileSync(f, "utf8");
      for (const re of [/\bseats?\b/i, /\bmedian\b/i, /\bPC\d\b/, /[\u2013\u2014]/]) {
        expect({ f, re: String(re), hit: re.test(text) }).toEqual({ f, re: String(re), hit: false });
      }
    }
  });
});
