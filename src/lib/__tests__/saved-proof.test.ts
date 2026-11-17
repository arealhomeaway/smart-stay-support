/**
 * Proof that work saved (Admin, Nov 17): "Done by [role] on [date]", Saved messages that name what
 * saved, My Tasks "Done recently" (own Tasks, last 7 days), her answer text for the team, and her
 * hours split into Reviewed and Waiting for review.
 */
import { describe, expect, it } from "bun:test";
import { doneByLine, doneRecently, filesLine, filesSavedMessage, taskSavedMessage } from "@/lib/task-proof";
import { submissionLines, submissionSummary } from "@/lib/homeowner-has";
import { answerReviewLine, entryStatusLine, hoursByReview } from "@/lib/owner-portal-look";

describe("Done by [role] on [date]", () => {
  it("names the role and the Central date", () => {
    expect(doneByLine("Project Manager", "2026-11-17T03:00:00Z")).toBe("Done by Project Manager on 11/16/2026");
  });
  it("never shows a blank role", () => {
    expect(doneByLine(null, null)).toBe("Done by our team");
  });
});

describe("Saved messages name what saved", () => {
  it("says the Task is marked done the first time", () => {
    expect(taskSavedMessage({ title: "Order linens", status: "complete", wasDone: false })).toBe('Saved. "Order linens" is marked done.');
  });
  it("says updated when it was already done", () => {
    expect(taskSavedMessage({ title: "Order linens", status: "complete", wasDone: true })).toBe('Saved. "Order linens" is updated.');
  });
  it("counts files added", () => {
    expect(filesSavedMessage(2, "Files")).toBe("Saved. 2 files added to Files.");
    expect(filesSavedMessage(0, "Files")).toBe("");
    expect(filesLine(["a.pdf", "b.jpg"])).toBe("Files: a.pdf, b.jpg");
  });
});

describe("Done recently", () => {
  const now = new Date("2026-11-17T18:00:00Z");
  const t = (id: string, completed_at: string | null, completed_by: string | null, extra: Record<string, unknown> = {}) => ({
    id, title: id, property_id: "h1", status: "complete", completed_at, completed_by, ...extra,
  });
  it("keeps only my own Tasks finished in the last 7 days, newest first", () => {
    const rows = doneRecently([
      t("old", "2026-11-09T18:00:00Z", "me"),
      t("mine1", "2026-11-12T18:00:00Z", "me"),
      t("mine2", "2026-11-16T18:00:00Z", "me"),
      t("theirs", "2026-11-16T18:00:00Z", "other"),
      t("archived", "2026-11-16T18:00:00Z", "me", { archived_at: "2026-11-16T19:00:00Z" }),
      t("open", null, "me", { status: "open" }),
    ], "me", now);
    expect(rows.map((r) => r.id)).toEqual(["mine2", "mine1"]);
  });
  it("is empty with no person", () => {
    expect(doneRecently([t("a", "2026-11-16T18:00:00Z", "me")], null, now)).toEqual([]);
  });
});

describe("what the homeowner sent, for the team", () => {
  const fields = [{ key: "provider", label: "Provider", type: "text" }, { key: "fiber", label: "Fiber", type: "yes_no" }];
  it("lists each answered field in card order", () => {
    const sub = { values: { fiber: true, provider: "AT&T" }, files: [], submittedAt: "2026-11-16T22:00:00Z" };
    expect(submissionLines(fields, sub)).toEqual(["Provider: AT&T", "Fiber: Yes"]);
    expect(submissionSummary(fields, sub)).toBe("Provider: AT&T · Fiber: Yes");
  });
  it("is empty when the reader cannot see the answer", () => {
    expect(submissionLines(fields, null)).toEqual([]);
  });
});

describe("her hours: Reviewed vs Waiting for review", () => {
  it("splits totals and skips superseded entries", () => {
    expect(hoursByReview([
      { minutes: 120, activity: "a", propertyIds: [], reviewed_at: "2026-11-15T00:00:00Z" },
      { minutes: 160, activity: "b", propertyIds: [] },
      { minutes: 60, activity: "c", propertyIds: [], superseded: true },
    ])).toEqual({ reviewedMinutes: 120, waitingMinutes: 160 });
  });
  it("labels each entry", () => {
    expect(entryStatusLine({ review_status: "submitted" })).toBe("Waiting for review");
    expect(entryStatusLine({ reviewed_at: "2026-11-15T18:00:00Z" })).toBe("Reviewed by your team Nov 15");
  });
  it("never says an answer was reviewed, since answers have no review step", () => {
    expect(answerReviewLine(null)).toBe("Sent to your team");
  });
});

import { deadlineState } from "@/lib/owner-deadline";

describe("a finished homeowner item never reads as overdue", () => {
  const now = new Date("2026-11-16T18:00:00Z");
  it("an open item past its date is overdue", () => {
    expect(deadlineState("2026-11-13", now)?.note).toBe("Overdue by 3 days");
  });
  it("the same item, finished, keeps only its date", () => {
    expect(deadlineState("2026-11-13", now, true)).toEqual({ label: "Needed by 11/13/2026 (CT)", overdue: false, dueToday: false, note: null });
  });
});
