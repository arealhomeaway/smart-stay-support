/**
 * Build 11 (Emily, Nov 10; register O1, O3): the two onboarding boards.
 * Concrete values from the boards and from the Notion Onboarding Project Database.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  NOTION_STATUSES,
  SIX_STAGES,
  byStatus,
  designFolders,
  dueLabel,
  firstNameOf,
  ganttScale,
  handoffDate,
  handoffLabel,
  healthFor,
  homeTabFor,
  planFilter,
  pmaSteps,
  sixStageFor,
  stepperFor,
  todayForMe,
  workload,
  type BoardTask,
} from "@/lib/onboarding-board";
import { buildTrail } from "@/lib/shell-nav";
import { handoffOverviewRow } from "@/lib/handoffs-overview";

const task = (over: Partial<BoardTask>): BoardTask => ({
  id: Math.random().toString(36).slice(2),
  property_id: "h1",
  stage: "Intake",
  title: "A task",
  status: "open",
  due_on: null,
  assigned_to: null,
  ...over,
});

describe("six stages", () => {
  it("are the board's six stages in order", () => {
    expect([...SIX_STAGES]).toEqual([
      "Intake",
      "Pre-Close",
      "Ordering & Repairs",
      "Setup & Staging",
      "Preparing for Handoff",
      "Handoff",
    ]);
  });

  it("the Standard plan maps one to one; older plans map by stage", () => {
    for (const s of SIX_STAGES) expect(sixStageFor(s)).toBe(s);
    expect(sixStageFor("Access & Setup")).toBe("Ordering & Repairs");
    expect(sixStageFor("fieldwork_setup_review")).toBe("Setup & Staging");
    expect(sixStageFor("closeout_stabilization")).toBe("Handoff");
    expect(sixStageFor("something new")).toBeNull();
  });

  it("the stepper reads Stage X of 6 with tasks done, and each stage's note", () => {
    const tasks = [
      ...Array.from({ length: 3 }, () => task({ stage: "Intake", status: "complete" })),
      ...Array.from({ length: 19 }, (_, i) => task({ stage: "Pre-Close", status: i < 13 ? "complete" : "open" })),
      task({ stage: "Handoff" }),
    ];
    const s = stepperFor(tasks);
    expect(s.current).toBe(2);
    expect(s.currentStage).toBe("Pre-Close");
    expect(s.progressLine).toBe("Stage 2 of 6 · 16 of 23 tasks done");
    expect(s.steps.map((x) => x.note)).toEqual([
      "Done",
      "13 of 19 done",
      "Not started",
      "Not started",
      "Not started",
      "Not started",
    ]);
  });
});

describe("Notion's own options", () => {
  it("Status has Notion's twelve options in Notion's order", () => {
    expect([...NOTION_STATUSES]).toEqual([
      "Upcoming Property",
      "Waiting on New House Assessment",
      "Waiting for Design",
      "Waiting for Closing",
      "Waiting for Access to Home",
      "Starting Onboard Process",
      "Waiting for Deliveries",
      "Repairs",
      "Staging/Furniture Setup",
      "Waiting for Handoff",
      "Property Handed Off",
      "Contract Fell Through",
    ]);
  });

  it("By Status has a column per Notion status plus Not set, each home in exactly one", () => {
    const homes = [{ status: "Repairs" }, { status: null }, { status: "Repairs" }];
    const cols = byStatus(homes);
    expect(cols).toHaveLength(13);
    expect(cols.find((c) => c.status === "Repairs")!.homes).toHaveLength(2);
    expect(cols.find((c) => c.status === "Not set")!.homes).toHaveLength(1);
    expect(cols.reduce((n, c) => n + c.homes.length, 0)).toBe(3);
  });

  it("PMA steps: done up to the status, the next one next, the rest not started", () => {
    expect(pmaSteps("HOA & Amenity Information Sent").map((s) => s.state)).toEqual([
      "Done",
      "Done",
      "Done",
      "Next",
      "Not started",
      "Not started",
    ]);
    expect(pmaSteps(null).every((s) => s.state === "Not started")).toBe(true);
  });
});

describe("labels", () => {
  const today = "2026-11-10";
  it("due labels: Overdue 1 day, Today, a date, Done Nov 4", () => {
    expect(dueLabel(task({ due_on: "2026-11-09" }), today)).toBe("Overdue 1 day");
    expect(dueLabel(task({ due_on: "2026-11-07" }), today)).toBe("Overdue 3 days");
    expect(dueLabel(task({ due_on: today }), today)).toBe("Today");
    expect(dueLabel(task({ due_on: "2026-11-12" }), today)).toBe("Nov 12");
    expect(dueLabel(task({ status: "complete", completed_at: "2026-11-04T15:00:00Z" }), today)).toBe("Done Nov 4");
  });

  it("upcoming handoffs read In 6 days", () => {
    expect(handoffLabel("2026-11-16", today)).toBe("In 6 days");
    expect(handoffLabel(today, today)).toBe("Today");
    expect(handoffLabel("2026-11-09", today)).toBe("Was yesterday");
  });

  it("the Committed Handoff Date wins over the estimate once set", () => {
    expect(handoffDate("2026-11-20", "2026-11-14")).toBe("2026-11-20");
    expect(handoffDate(null, "2026-11-14")).toBe("2026-11-14");
  });

  it("a passed handoff is At risk: handoff was yesterday", () => {
    const h = healthFor({ risk: { level: "on_track", reasons: [] }, handoffOn: "2026-11-09", accepted: false, today });
    expect(h.line).toBe("At risk: handoff was yesterday");
    expect(healthFor({ risk: { level: "on_track", reasons: [] }, handoffOn: "2026-11-09", accepted: true, today }).line).toBe("On track");
  });

  it("the greeting uses the profile's first name", () => {
    expect(firstNameOf({ first_name: "Kati", full_name: "Katherine Smith" })).toBe("Kati");
    expect(firstNameOf({ first_name: null, full_name: "Ana Lopez" })).toBe("Ana");
  });
});

describe("Today, for me", () => {
  const today = "2026-11-10";
  it("shows only the person's own open tasks due today or overdue, grouped by home", () => {
    const tasks = [
      task({ assigned_to: "me", due_on: today, property_id: "a" }),
      task({ assigned_to: "me", due_on: "2026-11-08", property_id: "b" }),
      task({ assigned_to: "me", due_on: "2026-11-12", property_id: "a" }),
      task({ assigned_to: "me", due_on: today, property_id: "a", status: "complete" }),
      task({ assigned_to: "someone else", due_on: today, property_id: "a" }),
    ];
    const t = todayForMe(tasks, "me", today);
    expect(t.countLine).toBe("1 task due today, 1 overdue");
    expect(t.groups.map((g) => g.propertyId)).toEqual(["b", "a"]);
    expect(t.groups.flatMap((g) => g.tasks).every((x) => x.assigned_to === "me")).toBe(true);
  });

  it("Plan filter: Mine, Everyone, Overdue", () => {
    const tasks = [
      task({ assigned_to: "me", due_on: "2026-11-01" }),
      task({ assigned_to: "you", due_on: "2026-11-20" }),
    ];
    expect(planFilter(tasks, "mine", "me", today)).toHaveLength(1);
    expect(planFilter(tasks, "everyone", "me", today)).toHaveLength(2);
    expect(planFilter(tasks, "overdue", "me", today)).toHaveLength(1);
  });
});

describe("views and folders", () => {
  it("Gantt runs month by month from the earliest closing to the latest handoff, today marked", () => {
    const g = ganttScale([{ start: "2026-09-22", end: "2026-11-20" }], "2026-11-10");
    expect(g.months.map((m) => m.label)).toEqual(["Sep 26", "Oct 26", "Nov 26"]);
    expect(g.today > 0 && g.today < 100).toBe(true);
  });

  it("Work Load counts active homes per Project Manager", () => {
    expect(workload([{ projectManager: "PM A" }, { projectManager: "PM A" }, { projectManager: null }])).toEqual([
      { name: "PM A", homes: 2 },
      { name: "No Project Manager", homes: 1 },
    ]);
  });

  it("design folders: the six board folders with a count and latest added line", () => {
    const f = designFolders([
      { category: "design_mood_board", created_at: "2026-11-02T10:00:00Z" },
      { category: "design_mood_board", created_at: "2026-11-05T10:00:00Z" },
    ]);
    expect(f.map((x) => x.label)).toEqual([
      "Floor plans",
      "Mood boards",
      "Pick lists",
      "Install instructions",
      "Staging instructions",
      "Photos",
    ]);
    expect(f[1]).toMatchObject({ count: 2, latest: "Latest added Nov 5" });
  });
});

describe("the home's tabs", () => {
  it("are Plan, Design, Budget & Invoices, Agreements, General Info, Files, Activity; old links still open", () => {
    expect(homeTabFor("design")).toBe("design");
    expect(homeTabFor("work")).toBe("plan");
    expect(homeTabFor("handoff")).toBe("plan");
    expect(homeTabFor("property")).toBe("info");
    expect(homeTabFor("history")).toBe("activity");
    expect(homeTabFor(undefined)).toBe("plan");
  });

  it("the page renders exactly the board's tab labels in order", () => {
    const src = readFileSync("src/lib/onboarding-board.ts", "utf8");
    const labels = [...src.slice(src.indexOf("export const HOME_TABS")).matchAll(/label: "([^"]+)"/g)]
      .slice(0, 7)
      .map((m) => m[1]);
    expect(labels).toEqual(["Plan", "Design", "Budget & Invoices", "Agreements", "General Info", "Files", "Activity"]);
    const page = readFileSync("src/routes/_authenticated/onboarding.$propertyId.tsx", "utf8");
    expect(page).toContain("HOME_TABS.map(");
    expect(page).not.toContain("OperationsContextPanel");
  });

  it("breadcrumbs name the board tabs", () => {
    const trail = buildTrail({
      pathname: "/onboarding/0b1f8a52-5c1e-4a3c-9d0e-2f6b8c7a1d11",
      search: { tab: "agreements" },
      propertyName: "1399 Foxtail Ln",
    });
    expect(trail.map((c) => c.label)).toEqual(["Onboarding", "1399 Foxtail Ln", "Agreements"]);
  });
});

describe("Onboarding Home", () => {
  it("has the board's banner line and buttons, and the five Notion views", () => {
    const home = readFileSync("src/components/onboarding/board/OnboardingBoardHome.tsx", "utf8");
    expect(home).toContain('description="From keys to kickoff."');
    expect(home).toContain("My tasks");
    for (const v of ["Gallery", "Active Projects", "By Status", "Gantt", "Work Load"]) expect(home).toContain(`label: "${v}"`);
    for (const c of ["Owner Type", "Project name", "Greater Area", "PMA Status", "Invoice Status", "Project Manager", "Status", "Closing date", "Est. Hand Off Date"])
      expect(home).toContain(`"${c}"`);
    const route = readFileSync("src/routes/_authenticated/onboarding.index.tsx", "utf8");
    expect(route).toContain("Add a home");
    // The banner is a home in onboarding, captioned with its address only.
    expect(route).toContain("dailyHomePhoto(");
    expect(route).toContain("name: h.address, city: null");
  });
});

describe("Handoffs page", () => {
  it("shows the Committed Handoff Date ahead of the estimate", () => {
    const row = (committed: string | null) =>
      handoffOverviewRow({
        project: {
          id: "p",
          property_id: "h",
          handoff_state: null,
          status: "active",
          target_handoff_on: "2026-11-14",
          committed_handoff_on: committed,
          ready_for_ops_at: null,
          is_demo: false,
        },
        home: { primary: "1399 Foxtail Ln", secondary: "" },
        lifecycleStatus: "onboarding",
        readyBy: null,
        standard: null,
      }).committedOn;
    expect(row("2026-11-20")).toBe("2026-11-20");
    expect(row(null)).toBe("2026-11-14");
  });
});
