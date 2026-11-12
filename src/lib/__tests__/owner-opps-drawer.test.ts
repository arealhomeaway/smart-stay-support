// Owner Opportunities and Task Drawer (approved Nov 11): the pure rules behind the owner's one
// Opportunities page (Part A) and the three kinds of Task in the drawer (Part B).
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  READY_VISIBLE,
  answerChip,
  boardGroup,
  boardView,
  mergeOncePerOwner,
  mostUrgentHome,
  needYouLabel,
  planCardOptional,
  sourceLine,
  type BoardItem,
} from "../owner-opportunity-board";
import { PROOF_HINT, SEND_HINT, WORK_ORDER_HINT, completeHint, drawerKind, dueChip, firstLines, mentionIds, stepsDone } from "../task-drawer";
import { isBreezewayWorkOrderStep } from "../onboarding-breezeway";

const base: BoardItem = {
  key: "k", source: "review", id: "i", title: "T", propertyIds: ["h1"], from: "Onboarding Team", summary: "", cover: "",
  sentAt: null, answerBy: null, deadline: null, needsAnswer: false, newReply: false, optional: false, locked: false, finished: false,
};
const item = (p: Partial<BoardItem>): BoardItem => ({ ...base, key: p.key ?? `${p.id ?? Math.random()}`, ...p });

describe("A1 groups", () => {
  it("puts each item in exactly one group, in the spec's order of precedence", () => {
    expect(boardGroup(item({ needsAnswer: true }))).toBe("answer");
    expect(boardGroup(item({ newReply: true }))).toBe("answer");
    expect(boardGroup(item({ optional: true }))).toBe("optional");
    expect(boardGroup(item({ locked: true, needsAnswer: true }))).toBe("soon");
    expect(boardGroup(item({}))).toBe("ready");
  });
  it("Needs your answer chips: due with days left, new reply, waiting, overdue", () => {
    expect(answerChip({ answerBy: "2026-11-14", newReply: false }, "2026-11-11")).toEqual({ text: "Due Nov 14 · 3 days left", overdue: false });
    expect(answerChip({ answerBy: "2026-11-12", newReply: false }, "2026-11-11").text).toBe("Due Nov 12 · 1 day left");
    expect(answerChip({ answerBy: "2026-11-14", newReply: true }, "2026-11-11").text).toBe("New reply · answer by Nov 14");
    expect(answerChip({ answerBy: null, newReply: false }, "2026-11-11").text).toBe("Waiting on you");
    expect(answerChip({ answerBy: "2026-11-09", newReply: true }, "2026-11-11")).toEqual({ text: "Overdue since Nov 9", overdue: true });
  });
  it("Ready for you is sorted by deadline and shows 4 before Show more", () => {
    const v = boardView(
      ["2026-12-01", "2026-11-20", null, "2026-11-15", "2026-11-30"].map((d, n) => item({ id: `r${n}`, title: `R${n}`, deadline: d })),
      null,
    );
    expect(v.ready.map((r) => r.deadline)).toEqual(["2026-11-15", "2026-11-20", "2026-11-30", "2026-12-01", null]);
    expect(READY_VISIBLE).toBe(4);
  });
});

describe("A2 homes", () => {
  const items = [
    item({ id: "a", propertyIds: ["h1"], needsAnswer: true, answerBy: "2026-11-20" }),
    item({ id: "b", propertyIds: ["h2"], needsAnswer: true, answerBy: "2026-11-05" }),
    item({ id: "c", propertyIds: ["h2"] }),
  ];
  it("All homes shows only Needs your answer, across every home", () => {
    const v = boardView(items, "all");
    expect(v.answer.map((i) => i.id)).toEqual(["b", "a"]);
    expect(v.ready).toEqual([]);
  });
  it("a home tab shows only that home's items", () => {
    expect(boardView(items, "h1").answer.map((i) => i.id)).toEqual(["a"]);
    expect(boardView(items, "h1").ready).toEqual([]);
  });
  it("the page opens on the home with the most urgent item (overdue first)", () => {
    expect(mostUrgentHome(items, ["h1", "h2"], "2026-11-11")).toBe("h2");
  });
  it("tab label reads {n} need you", () => {
    expect(needYouLabel(2)).toBe("2 need you");
  });
});

describe("market cards show once per owner", () => {
  it("copies of a once per owner card become one All your homes item", () => {
    const merged = mergeOncePerOwner([
      { ...item({ id: "p1", propertyIds: ["h1"], optional: true }), cardCode: "N05", oncePerOwner: true },
      { ...item({ id: "p2", propertyIds: ["h2"], optional: true }), cardCode: "N05", oncePerOwner: true },
      { ...item({ id: "p3", propertyIds: ["h1"], optional: true }), cardCode: "N13", oncePerOwner: false },
    ]);
    expect(merged.length).toBe(2);
    expect(merged[0]!.allHomes).toBe(true);
    expect(merged[0]!.propertyIds).toEqual(["h1", "h2"]);
    expect(sourceLine(merged[0]!, () => "x", true)).toBe("All your homes · Onboarding Team");
  });
  it("anytime plan cards are optional; others are Ready for you", () => {
    expect(planCardOptional({ stage_window: "anytime" })).toBe(true);
    expect(planCardOptional({ stage_window: "onboarding_launch" })).toBe(false);
  });
});

describe("Part A screens", () => {
  const owner = readFileSync("src/routes/_authenticated/owner.tsx", "utf8");
  const board = readFileSync("src/components/owner/OwnerOpportunityBoard.tsx", "utf8");
  it("A4: the home page no longer has Your approvals or Your homeowner plan, and links to View all opportunities", () => {
    expect(owner).not.toContain("Your approvals");
    expect(owner).not.toContain("Your homeowner plan</");
    expect(board).toContain("View all opportunities");
  });
  it("A1: the four group headings and their notes, worded as approved", () => {
    for (const t of ["Needs your answer", "Ready for you", "Optional ways to participate", "Opens when ARHA finishes the step before it",
      "Waiting on you.", "Anytime, at your own pace. Market ones show once for all your homes.", "Answer now", "Not open yet", "All homes: just what needs you"])
      expect(board).toContain(t);
  });
  it("A3: the conversation reply button reads Send to ARHA", () => {
    expect(readFileSync("src/components/owner/OwnerItemConversation.tsx", "utf8")).toContain("Send to ARHA");
  });
});

describe("Part B: three kinds of Task", () => {
  it("work order by title (both forms), then homeowner, else ordinary", () => {
    expect(drawerKind({ title: "Draft work order: Install TV mounts" })).toBe("work_order");
    expect(drawerKind({ title: "Work order: Pick up keys", requires_owner_approval: true })).toBe("work_order");
    expect(drawerKind({ title: "Share the design", requires_owner_approval: true })).toBe("homeowner");
    expect(drawerKind({ title: "Collect HOA rules", owner_dependency: "information" })).toBe("homeowner");
    expect(drawerKind({ title: "Owner photos", hasPlanCard: true })).toBe("homeowner");
    expect(drawerKind({ title: "Order linens", owner_dependency: "none" })).toBe("ordinary");
    expect(isBreezewayWorkOrderStep("Draft work order: hang art")).toBe(true);
  });
  it("due chip: Due today, Overdue {n} days, nothing when finished", () => {
    expect(dueChip("2026-11-11", "open", "2026-11-11")).toBe("Due today");
    expect(dueChip("2026-11-08", "open", "2026-11-11")).toBe("Overdue 3 days");
    expect(dueChip("2026-11-10", "open", "2026-11-11")).toBe("Overdue 1 day");
    expect(dueChip("2026-11-08", "complete", "2026-11-11")).toBeNull();
    expect(dueChip("2026-11-20", "open", "2026-11-11")).toBeNull();
  });
  it("What to do keeps instructions exactly as written, logins included", () => {
    const text = "Log in to the portal\nUser: arha@example.com\nPassword: S3cret!\nThen upload the lease";
    const r = firstLines(text);
    expect(r.head).toBe("Log in to the portal\nUser: arha@example.com\nPassword: S3cret!");
    expect(r.more).toBe(true);
    expect(firstLines("Role: Project Manager\n\nInstructions:\n\nCall the city\nBook the inspection").head).toBe("Role: Project Manager\n\nInstructions:\n\nCall the city");
  });
  it("Steps show {done} of {total} done", () => {
    expect(stepsDone([{ status: "complete" }, { status: "open" }, { status: "complete" }])).toBe("2 of 3 done");
  });
  it("the line under a grey Complete", () => {
    const b = { kind: "ordinary" as const, releaseBlocked: false, reason: null, evidenceMissing: true, proofOk: false, awaitingOwner: false };
    expect(completeHint(b)).toBe(PROOF_HINT);
    expect(PROOF_HINT).toBe("Add where the proof is, or attach a file.");
    expect(completeHint({ ...b, proofOk: true })).toBeNull();
    expect(completeHint({ ...b, kind: "work_order", evidenceMissing: false })).toBe(WORK_ORDER_HINT);
    expect(WORK_ORDER_HINT).toBe("Completes by itself when Breezeway marks the job done.");
    expect(completeHint({ ...b, kind: "homeowner", awaitingOwner: true })).toBe(SEND_HINT);
    expect(completeHint({ ...b, releaseBlocked: true, reason: "Waits for Order linens" })).toBe("Waits for Order linens");
  });
  it("@ a role reaches its holder on this home, else its pool", () => {
    expect(mentionIds({ assignee: "u1", pool: [{ id: "u2" }] })).toEqual(["u1"]);
    expect(mentionIds({ assignee: null, pool: [{ id: "u2" }, { id: "u3" }] })).toEqual(["u2", "u3"]);
    expect(mentionIds(undefined)).toEqual([]);
  });
});

describe("Part B screens", () => {
  const drawer = readFileSync("src/components/onboarding/TaskDrawer.tsx", "utf8");
  const send = readFileSync("src/components/onboarding/SendToHomeownerDialog.tsx", "utf8");
  it("B6: the old sections are gone from the drawer", () => {
    for (const gone of ["TaskOwnerCollaboration", "TaskOwnerDependency", "GuidedActionCard", "Write to the homeowner", 'label="Email homeowner"',
      "What proves this is done", "Notes & files", "Authorised exception", "Need something from the homeowner?"])
      expect(drawer).not.toContain(gone);
  });
  it("B1 to B5: the approved wording is on the drawer", () => {
    for (const t of ["Assigned to", "Mark as started", "Home info", "What to do", "Full instructions", "Proof it&apos;s done",
      "Where is the proof?", "Or attach a file", "Details", "What did you find?", "Exception", "History", "Complete", "Close"])
      expect(drawer).toContain(t);
    for (const t of ["Send to the homeowner", "What you&apos;re asking", "Files to share", "Answer by (optional)", "Email instead"])
      expect(send).toContain(t);
    const comments = readFileSync("src/components/onboarding/TaskTeamComments.tsx", "utf8");
    for (const t of ["Team comments", "Add a comment", "Attach", "Post comment"]) expect(comments).toContain(t);
  });
  it("B4 as changed Nov 12 (fix 18, then 18b): a sent homeowner Task shows no main button; Done only closes", () => {
    expect(drawer).toContain('finished || (middle === "send_to_owner" && sentToOwner) || middle === "work_order" ? null');
    expect(drawer).not.toMatch(/>\s*Close\s*</);
    // 18b: the footer Done button calls onClose and nothing else (never saves or sends).
    expect(drawer).toMatch(/<Button type="button" variant="outline" className="[^"]*" onClick=\{onClose\}>\s*Done\s*<\/Button>/);
  });
});
