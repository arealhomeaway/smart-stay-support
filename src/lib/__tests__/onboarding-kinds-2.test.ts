// Nov 12 completion build, items 1 to 9: the shared rules the drawer, the owner portal and the
// server read. Values come from the approved request.
import { describe, expect, it } from "bun:test";
import {
  DEFAULT_CLEANER_TRADE,
  approvalMode,
  bracketSegments,
  canReopenCompletedTask,
  completionRowOpens,
  emptyBrackets,
  fillBrackets,
  followUpLinks,
  liveDefaultCleaner,
  outsideOwnerLine,
  taskEmailHistory,
  vendorMergeValues,
} from "../onboarding-task-kinds";

describe("item 1: default cleaner is the home's live primary Turnover Cleaning coverage", () => {
  const today = "2026-11-12";
  const row = (o: Partial<{ org_id: string; service_category: string; coverage_priority: string; effective_from: string | null; effective_to: string | null; excluded: boolean }>) => ({
    org_id: "a", service_category: DEFAULT_CLEANER_TRADE, coverage_priority: "primary", effective_from: null, effective_to: null, excluded: false, ...o,
  });
  it("picks the live primary cleaner", () => {
    expect(liveDefaultCleaner([row({ org_id: "old", effective_to: "2026-11-11" }), row({ org_id: "now" })], today)?.org_id).toBe("now");
  });
  it("ignores backups, other trades, excluded and future rows", () => {
    expect(liveDefaultCleaner([
      row({ coverage_priority: "backup" }),
      row({ service_category: "Plumbing" }),
      row({ excluded: true }),
      row({ effective_from: "2026-12-01" }),
    ], today)).toBeNull();
  });
});

describe("item 2: Done outside Resolve owner line", () => {
  it("names DocuSign, Houzz Pro and QuickBooks", () => {
    expect(outsideOwnerLine("docusign")).toBe("Check your email for the DocuSign from ARHA");
    expect(outsideOwnerLine("houzz")).toBe("Check your email for the Houzz Pro from ARHA");
    expect(outsideOwnerLine("quickbooks")).toBe("Check your email for the QuickBooks from ARHA");
  });
  it("says document for email, text or other", () => {
    for (const w of ["email", "text", "other", null]) expect(outsideOwnerLine(w)).toBe("Check your email for the document from ARHA");
  });
});

describe("item 3: empty [bracketed] fill-ins are marked where they sit", () => {
  it("cuts the text into plain runs and empty fill-ins", () => {
    expect(bracketSegments("Hi [owner first name], see [link].")).toEqual([
      { text: "Hi ", empty: false },
      { text: "[owner first name]", empty: true },
      { text: ", see ", empty: false },
      { text: "[link]", empty: true },
      { text: ".", empty: false },
    ]);
  });
  it("a filled message has nothing marked and nothing blocking Send", () => {
    expect(bracketSegments("All set.").some((p) => p.empty)).toBe(false);
    expect(emptyBrackets("All set.")).toEqual([]);
    expect(emptyBrackets("Due [date]")).toEqual(["[date]"]);
  });
});

describe("item 4: vendor request", () => {
  it("fills [vendor name] and [market] from the vendor and the home", () => {
    const v = vendorMergeValues("Sparkle Clean", "Tulsa");
    expect(fillBrackets("Hello [vendor name], a home in [market] needs [what we need].", v)).toBe(
      "Hello Sparkle Clean, a home in Tulsa needs [what we need].",
    );
  });
  it("is logged as a vendor request, never as a homeowner email", () => {
    const h = taskEmailHistory({ subject: "Quote for a deep clean", vendorName: "Sparkle Clean" });
    expect(h.kind).toBe("vendor_requested");
    expect(h.category).toBe("vendor");
    expect(h.summary).toBe("Vendor request sent to Sparkle Clean: Quote for a deep clean");
    expect(taskEmailHistory({ subject: "Welcome" }).kind).toBe("homeowner_emailed");
  });
});

describe("item 6: Owner Completions row", () => {
  it("a row with a Task opens the Task; any other row opens the evidence view", () => {
    expect(completionRowOpens({ source_task_id: "t1" })).toBe("task");
    expect(completionRowOpens({ source_task_id: null })).toBe("evidence");
  });
});

describe("item 7: Reopen", () => {
  const who = (o: Partial<{ userId: string; isAdmin: boolean; isOnboardingDirector: boolean }>) => ({ userId: "me", isAdmin: false, isOnboardingDirector: false, ...o });
  it("Admin, the Director of Onboarding and the person who completed it may reopen", () => {
    expect(canReopenCompletedTask(who({ isAdmin: true }), "someone")).toBe(true);
    expect(canReopenCompletedTask(who({ isOnboardingDirector: true }), "someone")).toBe(true);
    expect(canReopenCompletedTask(who({}), "me")).toBe(true);
  });
  it("nobody else may, including a project manager who did not complete it", () => {
    expect(canReopenCompletedTask(who({}), "someone")).toBe(false);
    expect(canReopenCompletedTask(who({}), null)).toBe(false);
    expect(canReopenCompletedTask(who({ userId: null as never }), null)).toBe(false);
  });
});

describe("item 8: follow-ups by the stored link", () => {
  const tasks = [
    { id: "a", title: "Paint the fence" },
    { id: "b", title: "Touch up the gate", follow_up_of: "a" },
    { id: "c", title: "Seal the deck", follow_up_of: "a" },
    { id: "d", title: "Follow-up from: Paint the fence" },
  ];
  it("the source lists its follow-ups; each follow-up names its source", () => {
    expect(followUpLinks(tasks[0]!, tasks).followUps.map((t) => t.id)).toEqual(["b", "c"]);
    expect(followUpLinks(tasks[1]!, tasks).from?.title).toBe("Paint the fence");
  });
  it("a text line alone is not a link", () => {
    expect(followUpLinks(tasks[3]!, tasks).from).toBeNull();
  });
});

describe("item 9: Approval kind", () => {
  it("a configured step review keeps today's behavior", () => {
    expect(approvalMode({ reviewConfigured: true, reviewerId: "me", userId: "me" })).toBe("step_review");
  });
  it("without one, the assigned person decides and everyone else waits", () => {
    expect(approvalMode({ reviewConfigured: false, reviewerId: "me", userId: "me" })).toBe("decide");
    expect(approvalMode({ reviewConfigured: false, reviewerId: "me", userId: "you" })).toBe("waiting");
    expect(approvalMode({ reviewConfigured: false, reviewerId: null, userId: "me" })).toBe("no_reviewer");
  });
});
