import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  CHECKS,
  PANEL_COPY,
  PANEL_OUTCOME_LABELS,
  POST_PLACES,
  REPEAT_OPTIONS,
  answersSummary,
  byHandChecks,
  checkAnswersProblem,
  checkBadge,
  panelChecks,
  reviewCheckKey,
  reviewNeedsCheck,
  sortReviews,
  teamAllDone,
  workOrderDueBy,
  workOrderNeedsCheck,
  type CheckAnswers,
} from "@/lib/record-routine";
import { MANUAL_ROUTINE_KINDS, RETIRED_ROUTINE_KINDS } from "@/lib/routine-controls";
import { FLAG_KEYS } from "@/lib/feature-flags";

const NOW = Date.parse("2026-11-09T15:00:00Z");
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

describe("which checks each team sees", () => {
  it("Team A (guest experience) sees its own checks first, marked as theirs", () => {
    expect(panelChecks("guest_experience", false)).toEqual([
      { kind: "guest_touch_base", mine: true },
      { kind: "guest_review", mine: true },
      { kind: "maintenance_review", mine: false },
    ]);
  });

  it("Team B (property operations) sees the work order review first", () => {
    expect(panelChecks("property_operations", false)).toEqual([
      { kind: "maintenance_review", mine: true },
      { kind: "guest_touch_base", mine: false },
      { kind: "guest_review", mine: false },
    ]);
  });

  it("people without a home team see every check as theirs", () => {
    expect(panelChecks(null, false).every((c) => c.mine)).toBe(true);
  });

  it("own checks with work show Due now; others can still be opened", () => {
    expect(checkBadge(true, 3)).toBe("Due now · 3");
    expect(checkBadge(false, 2)).toBe("2 open");
    expect(checkBadge(true, 0)).toBe("All caught up");
  });

  it("all done only when every check for the team is empty", () => {
    const a = panelChecks("guest_experience", false);
    expect(teamAllDone(a, { guest_touch_base: 0, guest_review: 0, maintenance_review: 5 })).toBe(true);
    expect(teamAllDone(a, { guest_touch_base: 1, guest_review: 0 })).toBe(false);
  });
});

describe("retired checks", () => {
  it("Checkout and Cleaning Review never appear in the panel or by hand", () => {
    for (const on of [true, false]) {
      const kinds = [...panelChecks(null, on).map((c) => c.kind), ...byHandChecks(on)] as string[];
      expect(kinds).not.toContain("checkout");
      expect(kinds).not.toContain("cleaning_review");
    }
  });

  it("are retired everywhere else too, so the Routine Work page cannot start them", () => {
    expect(RETIRED_ROUTINE_KINDS.has("checkout")).toBe(true);
    expect(RETIRED_ROUTINE_KINDS.has("cleaning_review")).toBe(true);
    expect(MANUAL_ROUTINE_KINDS).not.toContain("cleaning_review");
    expect(MANUAL_ROUTINE_KINDS).not.toContain("checkout");
  });
});

describe("survey reviews stay hidden until surveys go live", () => {
  it("off by default: not in the list and not startable by hand", () => {
    expect(panelChecks(null, false).map((c) => c.kind)).not.toContain("survey_review");
    expect(byHandChecks(false)).not.toContain("survey_review");
    expect(FLAG_KEYS).toContain("survey_review_check");
  });

  it("switching it on shows it for Team A", () => {
    expect(panelChecks("guest_experience", true)).toContainEqual({ kind: "survey_review", mine: true });
  });
});

describe("the three live checks", () => {
  it("guest touch base steps", () => {
    expect(CHECKS.guest_touch_base.steps.map((s) => s.prompt)).toEqual([
      "Called or messaged the guest",
      "Guest is settled and has what they need",
      "Asked directly whether anything needs attention",
    ]);
    expect(CHECKS.guest_touch_base.team).toBe("guest_experience");
  });

  it("work order review steps, notice and Check each one", () => {
    const d = CHECKS.maintenance_review;
    expect(d.team).toBe("property_operations");
    expect(d.stepsHeading).toBe("Check each one");
    expect(d.notice).toBe("A vendor marking a job Finished is not our review. Approve it only after you have checked it.");
    expect(d.steps.map((s) => s.prompt)).toEqual([
      "Read the work order and the vendor notes",
      "Completion photos show the work is done",
      "Nothing is still pending at the home",
    ]);
  });

  it("guest review steps", () => {
    expect(CHECKS.guest_review.steps.map((s) => s.prompt)).toEqual([
      "Read the full review and the stay history",
      "Reply to the guest publicly or privately",
      "Check whether this is a repeat issue at the home",
      "Decide what the home or the team needs to fix",
    ]);
  });
});

describe("guest review reply fields", () => {
  const base: CheckAnswers = { steps: {}, outcome: "looks_good" };

  it("offers exactly these places and repeat answers", () => {
    expect(POST_PLACES.map((p) => p.label)).toEqual(["Airbnb", "OwnerRez", "VRBO", "Booking.com", "Somewhere else"]);
    expect(REPEAT_OPTIONS.map((r) => r.label)).toEqual(["No, first time", "Yes, it has come up before"]);
    expect(PANEL_COPY.postedHelp).toBe(
      "Post your reply on Airbnb or in OwnerRez first, then paste it here so we have a record.",
    );
  });

  it("needs the reply, where it was posted and the repeat answer", () => {
    expect(checkAnswersProblem("guest_review", base)).toBe("Paste what we replied.");
    expect(checkAnswersProblem("guest_review", { ...base, replyText: "Thank you" })).toBe("Choose where you posted it.");
    expect(checkAnswersProblem("guest_review", { ...base, replyText: "Thank you", postedOn: "airbnb" })).toBe(
      "Answer whether this is a repeat issue at this home.",
    );
    expect(
      checkAnswersProblem("guest_review", { ...base, replyText: "Thank you", postedOn: "airbnb", repeatIssue: "no" }),
    ).toBeNull();
  });

  it("other checks never ask for a reply", () => {
    expect(checkAnswersProblem("guest_touch_base", base)).toBeNull();
  });

  it("a found issue needs what to fix and which team", () => {
    const a: CheckAnswers = { steps: {}, outcome: "needs_follow_up" };
    expect(checkAnswersProblem("guest_touch_base", a)).toBe("Say what needs fixing.");
    expect(checkAnswersProblem("guest_touch_base", { ...a, issue: "AC is loud" })).toBe("Choose which team should fix it.");
    expect(checkAnswersProblem("guest_touch_base", { ...a, issue: "AC is loud", fixTeam: "property_operations" })).toBeNull();
  });

  it("No answer is only a choice on a touch base", () => {
    expect(checkAnswersProblem("maintenance_review", { steps: {}, outcome: "no_answer" })).toBe("Choose how it went.");
  });

  it("the saved notes read on their own", () => {
    const text = answersSummary("guest_review", {
      steps: { read: true },
      outcome: "looks_good",
      replyText: "Thanks for staying",
      postedOn: "booking_com",
      repeatIssue: "yes",
      notes: "Mention the hot tub",
    });
    expect(text).toContain("What we replied: Thanks for staying");
    expect(text).toContain("Posted on: Booking.com");
    expect(text).toContain("Repeat issue at this home: Yes, it has come up before");
    expect(text).toContain("Notes: Mention the hot tub");
  });
});

describe("what is waiting", () => {
  it("synced reviews from the past 14 days that nobody checked, under 5 stars first", () => {
    const rows = [
      { id: "a", rating: 5, submitted_at: daysAgo(1) },
      { id: "b", rating: 3, submitted_at: daysAgo(5) },
      { id: "c", rating: 4, submitted_at: daysAgo(20) },
      { id: "d", rating: 2, submitted_at: daysAgo(2) },
    ];
    const done = new Set([reviewCheckKey("d")]);
    const waiting = sortReviews(rows.filter((r) => reviewNeedsCheck(r, done, NOW)));
    expect(waiting.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("finished maintenance, lawn care included, is due 24 hours after Finished", () => {
    const w = { id: "w1", department: "maintenance", status: "Finished", breezeway_updated_at: daysAgo(1) };
    expect(workOrderNeedsCheck(w, new Set(), NOW)).toBe(true);
    expect(workOrderNeedsCheck(w, new Set(["w1"]), NOW)).toBe(false);
    expect(workOrderNeedsCheck({ ...w, status: "Created" }, new Set(), NOW)).toBe(false);
    expect(workOrderNeedsCheck({ ...w, breezeway_updated_at: daysAgo(30) }, new Set(), NOW)).toBe(false);
    expect(workOrderDueBy(w)).toBe(new Date(NOW).toISOString());
  });
});

describe("word check", () => {
  const BANNED = [/\bseat\b/i, /\bHit\b/, /\bmedian\b/i, /Checkouts?\b/, /Cleaning Review/];

  it("panel words", () => {
    const words = [
      ...Object.values(PANEL_COPY),
      ...Object.values(PANEL_OUTCOME_LABELS),
      ...Object.values(CHECKS).flatMap((c) => [c.label, c.purpose, c.teamLine, c.notice ?? "", ...c.steps.flatMap((s) => [s.prompt, s.hint ?? ""])]),
    ].join("\n");
    for (const re of BANNED) expect(words).not.toMatch(re);
    expect(words).not.toMatch(/\u2014/);
    expect(PANEL_COPY.title).toBe("Record routine work");
    expect(PANEL_COPY.intro).toBe("The daily checks that keep our guests happy and our homes in great shape.");
    expect(PANEL_COPY.emptyCheck).toBe("All caught up on this one. Nice work.");
    expect(PANEL_COPY.allDone).toBe("Every routine check for your team is done. Nice work.");
    expect(PANEL_COPY.byHand).toBe("Not on the list? Start one by hand");
    expect(PANEL_COPY.saved).toBe("Saved. Thank you for taking care of it.");
  });

  it("no banned word in the panel's visible text", () => {
    const visible = readFileSync("src/components/routines/RecordRoutinePanel.tsx", "utf8")
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l) && !/^\s*import /.test(l))
      .join("\n");
    const text = [...visible.matchAll(/"([^"\n]*)"|`([^`\n]*)`|>([^<>{}\n]+)</g)]
      .map((m) => m[1] ?? m[2] ?? m[3] ?? "")
      .join("\n");
    for (const re of BANNED.slice(0, 3)) expect(text).not.toMatch(re);
  });
});
