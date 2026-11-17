import { describe, expect, it } from "bun:test";
import {
  STATUS_COPY,
  answeredRows,
  daysWaiting,
  handedOffHomes,
  myHomeownerHomes,
  needsRows,
  taskChip,
  waitingRows,
  type HomeownerStatusData,
  type StatusCard,
  type StatusReview,
} from "@/lib/homeowner-status";

const H = "home-1";
const NOW = new Date("2026-11-17T18:00:00Z"); // Nov 17, 12:00 PM Central

const card = (over: Partial<StatusCard>): StatusCard => ({
  id: "c1", propertyId: H, code: "A27", title: "Authorize the make-ready estimate", opensText: null, stageWindow: "onboarding",
  lane: "owner", joinOutcome: "open", unlockedAt: "2026-11-16T18:38:00Z", deadlineAt: "2026-11-18T23:00:00Z", expiredAt: null,
  ownerCompletedAt: null, createdAt: "2026-11-01T00:00:00Z", ownerReviewId: null, linkedTaskId: "t1", ownerNeeded: true, ...over,
});
const review = (over: Partial<StatusReview>): StatusReview => ({
  id: "r1", title: "Make Ready Estimate", status: "awaiting_owner", sentAt: "2026-11-15T15:00:00Z", sentBy: null, respondedAt: null,
  closedAt: null, decision: null, response: null, lastOwnerMessage: null, files: [], propertyId: H, taskId: "t2", ...over,
});
const data = (over: Partial<HomeownerStatusData>): HomeownerStatusData => ({
  cards: [], reviews: [], cardReviews: {}, approvals: [], planOn: { [H]: true }, homeLabels: { [H]: "3400 N Fern" }, ...over,
});
const homes = new Set([H]);
const open = { id: "t1", done: false, completedAt: null };

describe("homeowner status chips on Task rows", () => {
  it("shows Homeowner overdue in red with the due date for an owner_needed card past due", () => {
    const chip = taskChip(open, data({ cards: [card({ deadlineAt: "2026-11-16T23:00:00Z" })] }), NOW);
    expect(chip).toEqual({ kind: "overdue", text: "Homeowner overdue · due 11/16/2026" });
  });
  it("shows Waiting on homeowner with whole days for an open owner_needed card", () => {
    expect(taskChip(open, data({ cards: [card({})] }), NOW)).toEqual({ kind: "waiting", text: "Waiting on homeowner · 1 day" });
  });
  it("shows Waiting on homeowner for an item sent for an answer from the Task", () => {
    const chip = taskChip({ id: "t2", done: true, completedAt: null }, data({ reviews: [review({})] }), NOW);
    expect(chip).toEqual({ kind: "waiting", text: "Waiting on homeowner · 2 days" });
  });
  it("shows Homeowner answered with the answer date", () => {
    const chip = taskChip({ id: "t2", done: true, completedAt: null }, data({ reviews: [review({ status: "answered", respondedAt: "2026-11-17T00:25:00Z" })] }), NOW);
    expect(chip).toEqual({ kind: "answered", text: "Homeowner answered 11/16/2026" });
  });
  it("shows Owner card opened only for a card the finished Task opened", () => {
    const c = card({ ownerNeeded: false, deadlineAt: null, unlockedAt: "2026-11-16T18:40:00Z" });
    expect(taskChip({ id: "t1", done: true, completedAt: "2026-11-16T18:39:00Z" }, data({ cards: [c] }), NOW)).toEqual({
      kind: "opened",
      text: "Owner card opened 11/16/2026",
    });
    expect(taskChip({ id: "t1", done: false, completedAt: null }, data({ cards: [c] }), NOW)).toBeNull();
  });
  it("shows nothing when the home's homeowner plan is off (the homeowner does not see it)", () => {
    expect(taskChip(open, data({ cards: [card({})], planOn: { [H]: false } }), NOW)).toBeNull();
  });
  it("never counts the internal workspace setup card as overdue", () => {
    const c = card({ title: "Activate your homeowner workspace", deadlineAt: "2026-11-16T23:00:00Z" });
    expect(taskChip(open, data({ cards: [c] }), NOW)).toBeNull();
  });
});

describe("My homeowners lists", () => {
  it("puts overdue first, then newest first, with days waiting and due date", () => {
    const rows = waitingRows(
      data({
        cards: [card({}), card({ id: "c2", title: "Older due", deadlineAt: "2026-11-16T23:00:00Z", unlockedAt: "2026-11-10T15:00:00Z" })],
        reviews: [review({ sentAt: "2026-11-17T15:00:00Z" })],
      }),
      homes,
      NOW,
    );
    expect(rows.map((r) => r.title)).toEqual(["Older due", "Make Ready Estimate", "Authorize the make-ready estimate"]);
    expect(rows[0]!.overdue).toBe(true);
    expect(rows[2]!.line).toBe("Waiting 1 day · due 11/18/2026, 5:00 PM Central");
  });
  it("lists answers and owner-finished cards from the last 7 days only", () => {
    const rows = answeredRows(
      data({
        cards: [card({ ownerCompletedAt: "2026-11-15T15:00:00Z" }), card({ id: "old", ownerCompletedAt: "2026-11-01T15:00:00Z" })],
        reviews: [review({ status: "answered", respondedAt: "2026-11-17T00:25:00Z", response: "Approved" })],
      }),
      homes,
      NOW,
    );
    expect(rows.map((r) => r.key)).toEqual(["review:r1", "card:c1"]);
  });
  it("uses the exact empty text", () => {
    expect(STATUS_COPY.empty).toBe("Nothing waiting on a homeowner.");
  });
  it("Needs you now carries only overdue and answered items", () => {
    const rows = needsRows(data({ cards: [card({})], reviews: [review({ status: "answered", respondedAt: "2026-11-17T00:25:00Z" })] }), homes, NOW);
    expect(rows.map((r) => r.kind)).toEqual(["answered"]);
  });
});

describe("whose homes", () => {
  const projects = [
    { property_id: "a", project_manager: "pm", status: "active" },
    { property_id: "b", project_manager: "other", status: "active" },
    { property_id: "c", project_manager: "other", status: "cancelled" },
  ];
  const tasks = [
    { property_id: "b", assigned_to: "pm", status: "not_started" },
    { property_id: "c", assigned_to: "pm", status: "complete" },
  ];
  it("covers homes the person manages or has an open Task on", () => {
    expect([...myHomeownerHomes({ person: "pm", allHomes: false, projects, tasks })].sort()).toEqual(["a", "b"]);
  });
  it("covers every live home for the Director of Onboarding and Admin", () => {
    expect([...myHomeownerHomes({ person: "x", allHomes: true, projects, tasks })].sort()).toEqual(["a", "b"]);
  });
  it("counts a home handed off only from its latest project", () => {
    const set = handedOffHomes([
      { property_id: "a", status: "completed", ops_accepted_at: null, created_at: "2026-01-01" },
      { property_id: "a", status: "active", ops_accepted_at: null, created_at: "2026-06-01" },
      { property_id: "b", status: "active", ops_accepted_at: "2026-10-01", created_at: "2026-02-01" },
    ]);
    expect([...set]).toEqual(["b"]);
  });
  it("counts waiting days by Central calendar day", () => {
    expect(daysWaiting("2026-11-17T05:30:00Z", NOW)).toBe(1); // 11:30 PM Nov 16 Central
    expect(daysWaiting("2026-11-17T06:30:00Z", NOW)).toBe(0); // 12:30 AM Nov 17 Central
  });
});
