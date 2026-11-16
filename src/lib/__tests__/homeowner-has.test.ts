/**
 * What the homeowner has (approved by the Admin, Nov 16): staff see the same groups the
 * homeowner portal shows, and what the team sent for the homeowner's answer.
 */
import { describe, expect, it } from "bun:test";
import {
  cardPlacement,
  homeownerCardGroups,
  openedCardLine,
  sentForAnswer,
  senderRole,
  taskSentLine,
  type HasPlanCard,
  type HasReview,
} from "@/lib/homeowner-has";

const base: HasPlanCard = {
  id: "c1", propertyId: "h1", code: "A27", title: "Authorize the make-ready estimate", opensText: "Locked until ARHA uploads the estimate",
  stageWindow: "onboarding", lane: null, joinOutcome: "locked", unlockedAt: null, deadlineAt: null, expiredAt: null,
  ownerCompletedAt: null, createdAt: "2026-11-13T00:13:31Z", ownerReviewId: null,
};
const on = { planOn: true, minutes: 0 };

describe("homeowner card groups", () => {
  it("an open card with a due date needs the homeowner's answer, due in Central time", () => {
    const p = cardPlacement({ ...base, unlockedAt: "2026-11-16T18:38:39Z", deadlineAt: "2026-11-18T23:00:00Z" }, on);
    expect(p).toEqual({ group: "answer", line: "Due 11/18/2026, 5:00 PM Central" });
  });
  it("an open card without a due date is open since the day it opened", () => {
    expect(cardPlacement({ ...base, unlockedAt: "2026-11-13T00:13:31Z" }, on)).toEqual({ group: "open", line: "Open since 11/12/2026" });
  });
  it("an anytime card with a due date is open, not waiting on an answer", () => {
    expect(cardPlacement({ ...base, stageWindow: "anytime", unlockedAt: "2026-11-16T18:00:00Z", deadlineAt: "2026-11-18T23:00:00Z" }, on).group).toBe("open");
  });
  it("a locked card waits on our team with the opens when text", () => {
    expect(cardPlacement(base, on)).toEqual({ group: "waiting", line: "Opens when ARHA uploads the estimate" });
  });
  it("a done card shows its day and the hours logged for it", () => {
    expect(cardPlacement({ ...base, unlockedAt: "2026-11-13T00:00:00Z", ownerCompletedAt: "2026-11-15T15:00:00Z" }, { planOn: true, minutes: 150 }))
      .toEqual({ group: "done", line: "Done 11/15/2026 · 2.5 hrs logged" });
    expect(cardPlacement({ ...base, unlockedAt: "2026-11-13T00:00:00Z", ownerCompletedAt: "2026-11-15T15:00:00Z" }, on).line).toBe("Done 11/15/2026");
  });
  it("covered, past stage, setup and plan off cards are not shown to the homeowner, with the reason", () => {
    expect(cardPlacement({ ...base, joinOutcome: "already_covered" }, on)).toEqual({ group: "hidden", line: "Already covered" });
    expect(cardPlacement({ ...base, joinOutcome: "skipped_passed" }, on)).toEqual({ group: "hidden", line: "Past its stage" });
    expect(cardPlacement({ ...base, title: "Activate your homeowner workspace", joinOutcome: "open", unlockedAt: "2026-11-13T00:00:00Z" }, on).group).toBe("hidden");
    expect(cardPlacement({ ...base, joinOutcome: "open", unlockedAt: "2026-11-13T00:00:00Z" }, { planOn: false, minutes: 0 }))
      .toEqual({ group: "hidden", line: "Homeowner plan is off for this home" });
  });
  it("groups put the newest change first", () => {
    const g = homeownerCardGroups(
      [
        { ...base, id: "old", title: "Old", unlockedAt: "2026-11-10T00:00:00Z" },
        { ...base, id: "new", title: "New", unlockedAt: "2026-11-15T00:00:00Z" },
      ],
      { planOn: () => true, hourEntries: [] },
    );
    expect(g.open.map((i) => i.id)).toEqual(["new", "old"]);
  });
  it("hours come from the card's own owner item or its title on the same home, never superseded entries", () => {
    const done = { ...base, unlockedAt: "2026-11-13T00:00:00Z", ownerCompletedAt: "2026-11-15T15:00:00Z", ownerReviewId: "r1" };
    const g = homeownerCardGroups([done], {
      planOn: () => true,
      hourEntries: [
        { minutes: 60, activity: "x", review_id: "r1", propertyIds: ["h1"] },
        { minutes: 30, activity: "Authorize the make-ready estimate", propertyIds: ["h1"] },
        { minutes: 90, activity: "x", review_id: "r1", superseded: true, propertyIds: ["h1"] },
      ],
    });
    expect(g.done[0]?.line).toBe("Done 11/15/2026 · 1.5 hrs logged");
  });
});

describe("sent for the homeowner's answer", () => {
  const review: HasReview = {
    id: "r", title: "Share the Make Ready Estimate with the owner", status: "awaiting_owner", sentAt: "2026-11-16T18:38:39Z", sentBy: "u1",
    respondedAt: null, closedAt: null, decision: null, response: null, lastOwnerMessage: null, files: [{ id: "d", name: "Estimate.pdf" }],
  };
  it("waiting items say since when and who sent them, by role", () => {
    const [i] = sentForAnswer([review], [], () => "Project Manager");
    expect(i?.sentLine).toBe("Sent 11/16/2026 by Project Manager");
    expect(i?.statusLine).toBe("Waiting on the homeowner since 11/16/2026");
    expect(i?.files).toEqual([{ id: "d", name: "Estimate.pdf" }]);
  });
  it("answered items show the day and the answer", () => {
    const [i] = sentForAnswer([{ ...review, status: "answered", respondedAt: "2026-11-17T15:00:00Z", decision: "approved", response: "Go ahead" }], [], () => "Admin");
    expect(i?.statusLine).toBe("Answered 11/17/2026: Approved. Go ahead");
  });
  it("items never sent and withdrawn approvals are left out; newest first", () => {
    const list = sentForAnswer(
      [{ ...review, id: "p", status: "prepared" }, { ...review, id: "older", sentAt: "2026-11-10T00:00:00Z" }, review],
      [{ id: "a", title: "Approve", status: "withdrawn", createdAt: "2026-11-16T00:00:00Z", requestedBy: null, decidedAt: null, decisionNote: null, files: [] }],
      () => "Admin",
    );
    expect(list.map((i) => i.key)).toEqual(["review:r", "review:older"]);
  });
  it("approvals read as waiting or answered", () => {
    const [w] = sentForAnswer([], [{ id: "a", title: "Approve", status: "pending", createdAt: "2026-11-16T18:00:00Z", requestedBy: null, decidedAt: null, decisionNote: null, files: [] }], () => "Our team");
    expect(w?.statusLine).toBe("Waiting on the homeowner since 11/16/2026");
    const [d] = sentForAnswer([], [{ id: "a", title: "Approve", status: "approved", createdAt: "2026-11-16T18:00:00Z", requestedBy: null, decidedAt: "2026-11-17T18:00:00Z", decisionNote: null, files: [] }], () => "Our team");
    expect(d?.statusLine).toBe("Answered 11/17/2026: Approved");
  });
  it("the sender is a role, never a name", () => {
    expect(senderRole({ appRoles: ["onboarding"], roleCodes: ["onboarding_project_manager", "utilities"] })).toBe("Project Manager");
    expect(senderRole({ appRoles: ["admin"], roleCodes: ["director_onboarding"] })).toBe("Director of Onboarding");
    expect(senderRole({ appRoles: ["tech"], roleCodes: [] })).toBe("Property Coordinator");
    expect(senderRole({ appRoles: ["admin"], roleCodes: [] })).toBe("Admin");
  });
});

describe("Task drawer lines", () => {
  it("names the card finishing the Task opened, with the day", () => {
    expect(openedCardLine({ title: "Authorize the make-ready estimate", unlockedAt: "2026-11-16T18:38:39Z" }, { done: true, completedAt: "2026-11-16T18:38:39Z" }))
      .toBe("This opened the homeowner's card: Authorize the make-ready estimate · 11/16/2026");
  });
  it("says nothing when the Task is open or the card opened well before (Unlock now)", () => {
    expect(openedCardLine({ title: "x", unlockedAt: "2026-11-16T18:00:00Z" }, { done: false, completedAt: null })).toBeNull();
    expect(openedCardLine({ title: "x", unlockedAt: "2026-11-10T18:00:00Z" }, { done: true, completedAt: "2026-11-16T18:00:00Z" })).toBeNull();
    expect(openedCardLine({ title: "x", unlockedAt: null }, { done: true, completedAt: "2026-11-16T18:00:00Z" })).toBeNull();
  });
  it("sent lines read waiting or answered", () => {
    expect(taskSentLine({ sentAt: "2026-11-16T18:38:39Z", answered: false, answeredAt: null, answer: "" })).toBe("Sent to the homeowner 11/16/2026 · Waiting on their answer");
    expect(taskSentLine({ sentAt: "2026-11-16T18:38:39Z", answered: true, answeredAt: "2026-11-17T15:00:00Z", answer: "Approved" })).toBe("Answered 11/17/2026: Approved");
  });
});
