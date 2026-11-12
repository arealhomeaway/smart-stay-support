/**
 * Plan catch-up screen rules (Admin approval Nov 12): selection, the pinned bar, the Mark done
 * form limits, the result line, the 10 minute Undo and who may act. The database rules are
 * covered by plan-catch-up-sql.test.ts.
 */
import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  barActions,
  canActOnTask,
  canUseCatchUp,
  catchUpSelectable,
  earliestDoneOn,
  markDoneProblem,
  reasonProblem,
  resultLine,
  stageCheckState,
  toggleSelection,
  toggleStage,
  undoAvailable,
  type CatchUpViewer,
} from "@/lib/plan-catch-up";
import { PlanStages, notNeededLabel } from "@/components/onboarding/board/HomeBoard";
import { PlanCatchUpBar, type CatchUpSelection } from "@/components/onboarding/PlanCatchUp";

const viewer = (o: Partial<CatchUpViewer> = {}): CatchUpViewer => ({
  userId: "me",
  isAdmin: false,
  isOnboardingDirector: false,
  isOnboarding: true,
  isHomePm: false,
  roleCodes: [],
  ...o,
});
const task = (id: string, o: Record<string, unknown> = {}) => ({
  id,
  title: `Task ${id}`,
  status: "not_started",
  stage: "Intake",
  assigned_to: null,
  assigned_seat: null,
  archived_at: null,
  parent_task_id: null,
  due_on: null,
  ...o,
});

describe("selection", () => {
  const order = ["a", "b", "c", "d", "e"];
  it("toggles one Task", () => {
    expect([...toggleSelection(new Set(), "b")]).toEqual(["b"]);
    expect([...toggleSelection(new Set(["b"]), "b")]).toEqual([]);
  });
  it("Shift-click selects the range from the last Task clicked", () => {
    const next = toggleSelection(new Set(["b"]), "e", { shift: true, anchor: "b", order });
    expect([...next].sort()).toEqual(["b", "c", "d", "e"]);
  });
  it("Shift-click skips Tasks this person cannot select", () => {
    const next = toggleSelection(new Set(["a"]), "d", { shift: true, anchor: "a", order, selectable: new Set(["a", "b", "d"]) });
    expect([...next].sort()).toEqual(["a", "b", "d"]);
  });
  it("the stage box shows a dash when some are selected and selects every open Task", () => {
    const stage = ["a", "b", "c"];
    const open = ["a", "b"];
    expect(stageCheckState(stage, open, new Set())).toBe("none");
    expect(stageCheckState(stage, open, new Set(["a"]))).toBe("some");
    expect(stageCheckState(stage, open, new Set(["c"]))).toBe("some");
    expect(stageCheckState(stage, open, new Set(["a", "b"]))).toBe("all");
    expect([...toggleStage(new Set(["a"]), open, "some")].sort()).toEqual(["a", "b"]);
    expect([...toggleStage(new Set(["a", "b", "z"]), open, "all")]).toEqual(["z"]);
  });
  it("finished Tasks can be selected; carry overs and Not needed ones cannot", () => {
    const v = viewer({ isAdmin: true });
    expect(catchUpSelectable(v, task("a", { status: "complete" }))).toBe(true);
    expect(catchUpSelectable(v, task("b", { status: "carryover" }))).toBe(false);
    expect(catchUpSelectable(v, task("c", { archived_at: "2026-11-01" }))).toBe(false);
  });
});

describe("the bar", () => {
  it("appears with one selected Task and offers Reopen only when every selected Task is finished", () => {
    expect(barActions([])).toEqual([]);
    expect(barActions([task("a")])).toEqual(["mark_done", "not_needed", "assign", "due_date"]);
    expect(barActions([task("a", { status: "complete" }), task("b")])).not.toContain("reopen");
    expect(barActions([task("a", { status: "complete" }), task("b", { status: "done" })])).toContain("reopen");
  });
  const selection = (ids: string[]): CatchUpSelection => ({
    selectable: new Set(ids),
    selected: new Set(ids),
    toggle: () => {},
    replace: () => {},
    clear: () => {},
  });
  const bar = (ids: string[], tasks = [task("a"), task("b"), task("c", { status: "complete" })]) =>
    renderToStaticMarkup(
      <PlanCatchUpBar
        propertyId="00000000-0000-0000-0000-000000000001"
        homeName="1464 Buckland Ct"
        tasks={tasks as never}
        people={[]}
        selection={selection(ids)}
        canEditSelected={false}
        stages={["Intake"]}
        onChanged={() => {}}
      />,
    );
  it("is pinned to the bottom of the screen with the count and every action", () => {
    const html = bar(["a", "b"]);
    expect(html).toContain("fixed inset-x-0 bottom-0");
    expect(html).toContain("2 selected");
    for (const label of ["Mark done", "Not needed for this home", "Assign to…", "Change due date…", "Clear"]) expect(html).toContain(label);
    expect(html).not.toContain(">Reopen<");
  });
  it("shows Reopen when only finished Tasks are selected", () => {
    expect(bar(["c"])).toContain(">Reopen<");
  });
  it("is not shown with nothing selected", () => {
    expect(bar([])).toBe("");
  });
});

describe("plan rows", () => {
  const stepper = {
    steps: ["Intake", "Utilities", "Design", "Staging", "Photos", "Handoff"].map((n) => ({ name: n, note: "Not started", state: "upcoming" })),
    currentIndex: 0,
  };
  const html = renderToStaticMarkup(
    <PlanStages
      tasks={[task("a", { roleLabel: "Project Manager" }), task("b", { roleLabel: "Utilities" })] as never}
      stepper={stepper as never}
      userId="me"
      today="2026-11-12"
      onOpen={() => {}}
      catchUp={{ selectable: new Set(["a"]), selected: new Set(["a"]), toggle: () => {}, replace: () => {}, clear: () => {} }}
      notNeeded={[{ id: "n", title: "HOA approval", stage: "Intake", exception_reason: "Voided — not needed: No HOA" }]}
    />,
  );
  it("rows are 52 px with a 26 px box in a 44 px tap area", () => {
    expect(html).toContain("min-h-[52px]");
    expect(html).toContain("size-[26px]");
    expect(html).toContain("size-11");
    expect(html).toContain('aria-label="Select Task a"');
    expect(html).not.toContain('aria-label="Select Task b"');
  });
  it("each stage header has a box for every open Task in it", () => {
    expect(html).toContain('aria-label="Select every open Task in Intake"');
  });
  it("Not needed Tasks show the reason", () => {
    expect(html).toContain("Not needed (1)");
    expect(html).toContain("Not needed: No HOA");
    expect(notNeededLabel("Voided — not needed: Owner manages lawn")).toBe("Not needed: Owner manages lawn");
  });
});

describe("Mark done form", () => {
  const today = "2026-11-12";
  it("needs a proof note of at least 5 characters", () => {
    expect(markDoneProblem({ note: "ok", when: "today", doneOn: null, today, count: 2 })).toContain("at least 5");
    expect(markDoneProblem({ note: "In SharePoint", when: "today", doneOn: null, today, count: 2 })).toBeNull();
  });
  it("Earlier needs a date no more than two years back and not in the future", () => {
    expect(earliestDoneOn(today)).toBe("2024-11-12");
    expect(markDoneProblem({ note: "In SharePoint", when: "earlier", doneOn: null, today, count: 1 })).toBe("Pick the date it was done.");
    expect(markDoneProblem({ note: "In SharePoint", when: "earlier", doneOn: "2024-11-11", today, count: 1 })).toBe("Pick a date in the last two years.");
    expect(markDoneProblem({ note: "In SharePoint", when: "earlier", doneOn: "2026-11-13", today, count: 1 })).toBe("Pick a date that is not in the future.");
    expect(markDoneProblem({ note: "In SharePoint", when: "earlier", doneOn: "2024-11-12", today, count: 1 })).toBeNull();
  });
  it("Not needed needs a reason", () => {
    expect(reasonProblem("", 1)).not.toBeNull();
    expect(reasonProblem("No HOA", 1)).toBeNull();
  });
});

describe("after saving", () => {
  it("reads like the board", () => {
    expect(resultLine({ action: "mark_done", done: 6, doneOn: "2026-10-22", covered: 5 })).toBe(
      "6 Tasks marked done (Oct 22). 5 owner cards will not be sent.",
    );
    expect(resultLine({ action: "not_needed", done: 1, covered: 1, skipped: 2 })).toBe(
      "1 Task marked not needed. 1 owner card will not be sent. 2 Tasks left as they are.",
    );
  });
  it("Undo is offered for 10 minutes", () => {
    const saved = 1_000_000;
    expect(undoAvailable(saved, saved + 9 * 60_000)).toBe(true);
    expect(undoAvailable(saved, saved + 10 * 60_000)).toBe(false);
  });
});

describe("who", () => {
  const mine = task("a", { assigned_to: "me" });
  const utilitiesRole = task("b", { assigned_seat: "utilities" });
  const other = task("c", { assigned_to: "someone", assigned_seat: "onboarding_project_manager" });
  it("Director of Onboarding and Admin act on every Task", () => {
    expect(canActOnTask(viewer({ isOnboardingDirector: true }), other)).toBe(true);
    expect(canActOnTask(viewer({ isAdmin: true, isOnboarding: false }), other)).toBe(true);
  });
  it("the home's Project Manager acts on every Task on that home only", () => {
    expect(canActOnTask(viewer({ isHomePm: true }), other)).toBe(true);
    expect(canActOnTask(viewer({ isHomePm: false }), other)).toBe(false);
  });
  it("Utilities and Design act only on Tasks given to them or their role", () => {
    const u = viewer({ roleCodes: ["utilities"] });
    expect(canActOnTask(u, mine)).toBe(true);
    expect(canActOnTask(u, utilitiesRole)).toBe(true);
    expect(canActOnTask(u, other)).toBe(false);
    expect(canActOnTask(viewer({ roleCodes: ["designer"] }), utilitiesRole)).toBe(false);
  });
  it("Operations roles get nothing", () => {
    const ops = viewer({ isOnboarding: false });
    expect(canUseCatchUp(ops)).toBe(false);
    expect(canActOnTask(ops, mine)).toBe(false);
  });
});
