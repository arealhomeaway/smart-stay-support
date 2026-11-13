/**
 * Property page Part 1 of 3 (approved by the Admin and the Director of Onboarding, Nov 12):
 * one home's Onboarding view. The rules (tabs, stage, Status map, schedule health, whose Task,
 * Do now / Up next / Done, Needs attention, owner contact links, who may add) and the server's
 * Add task refusal. The staged SQL is practised in property-page-part1-sql.test.ts.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DEFAULT_STATUS_STAGE_MAP,
  PAGE_STAGE_NAMES,
  PAGE_TABS,
  canAddOneOff,
  committedHandoffMissing,
  computedStage,
  factsLine,
  moreTags,
  attentionJumpSearch,
  foldChips,
  lateElsewhereLabel,
  lateEverywhere,
  needsAttention,
  nextBusinessDay,
  oneOffColumns,
  ownerRow,
  ownerDecisionsDue,
  ownerTagFor,
  ownerTagText,
  pageTabFor,
  parseStatusStageMap,
  rowDue,
  scheduleHealth,
  showBackToAttention,
  stageKeyFor,
  stageLists,
  stageMismatch,
  tabClickSearch,
  tagCounts,
  telegramLink,
  yoursLate,
  type AddViewer,
  type PageTask,
} from "@/lib/onboarding-home-page";
import { ADD_REFUSED, addStageTask } from "@/lib/onboarding-home-page.server";
import { TasksTab } from "@/components/onboarding/home-page/TasksTab";

const TODAY = "2026-11-12"; // a Thursday
const ME = "me";
const PM = "pm";
let n = 0;
const t = (o: Partial<PageTask> = {}): PageTask => ({
  id: o.id ?? `t${++n}`,
  title: o.title ?? `Task ${n}`,
  stage: "Intake",
  status: "open",
  due_on: null,
  assigned_to: null,
  assigned_seat: null,
  task_kind: "do_it",
  ...o,
});

describe("1.1 tabs and ?tab=", () => {
  it("are in the approved order, ending with the temporary More", () => {
    expect(PAGE_TABS.map((x) => x.label)).toEqual(["Overview", "Tasks", "Owner", "Home details", "Vendors and work", "Files", "Budget", "Activity", "More"]);
  });
  it("the page opens on Overview; old links open the tab that holds their content now", () => {
    expect(pageTabFor(undefined)).toBe("overview");
    expect(pageTabFor("tasks")).toBe("tasks");
    expect(pageTabFor("plan")).toBe("tasks");
    expect(pageTabFor("work")).toBe("tasks");
    expect(pageTabFor("design")).toBe("more");
    expect(pageTabFor("agreements")).toBe("more");
    expect(pageTabFor("info")).toBe("more");
    expect(pageTabFor("active-owner")).toBe("owner");
    expect(pageTabFor(undefined, true)).toBe("owner");
    expect(pageTabFor("budget")).toBe("budget");
    expect(pageTabFor("overview")).toBe("overview");
  });
  it("the route keeps the tab in the address and renders PAGE_TABS", () => {
    const page = readFileSync("src/routes/_authenticated/onboarding.$propertyId.tsx", "utf8");
    expect(page).toContain("PAGE_TABS.map(");
    expect(page).toMatch(/navigate\(\{ search: tabClickSearch\(search, pageTabFor\(next\)\) as never, replace: true \}\)/);
    expect(page).toMatch(/: DEFAULT_PAGE_TAB\);/);
    expect(page).not.toContain("HomeBoardHeader");
    expect(page).not.toContain("<PropertyWorkQueue");
  });
});

describe("1.4 stage and status", () => {
  it("the stage is the earliest stage that still has an open Task", () => {
    expect(computedStage([t({ stage: "Intake", status: "complete" }), t({ stage: "Pre-Close" }), t({ stage: "Handoff" })])).toBe(2);
    expect(computedStage([t({ stage: "Intake", status: "complete" })])).toBe(6);
    expect(PAGE_STAGE_NAMES).toEqual(["Intake", "Pre-Close", "Ordering and Repairs", "Setup and Staging", "Preparing for Handoff", "Handoff"]);
  });
  it("the Status map is seeded exactly", () => {
    expect(DEFAULT_STATUS_STAGE_MAP).toEqual({
      "Upcoming Property": 1,
      "Waiting on New House Assessment": 1,
      "Waiting for Design": 2,
      "Waiting for Closing": 2,
      "Waiting for Access to Home": 3,
      "Starting Onboard Process": 3,
      Repairs: 3,
      "Waiting for Deliveries": 3,
      "Staging/Furniture Setup": 4,
      "Waiting for Handoff": 5,
      "Property Handed Off": 6,
      "Contract Fell Through": null,
    });
    const sql = readFileSync("docs/pending/property-page-part1/apply.sql", "utf8");
    const seeded = JSON.parse(sql.slice(sql.indexOf("'{", sql.indexOf("onboarding_status_stage_map',")) + 1, sql.indexOf("}'::jsonb") + 1));
    expect(seeded).toEqual({ ...DEFAULT_STATUS_STAGE_MAP });
  });
  it("the mismatch chip shows only when the mapped stage differs; Contract Fell Through never", () => {
    expect(stageMismatch("Staging/Furniture Setup", 4, DEFAULT_STATUS_STAGE_MAP)).toBeNull();
    expect(stageMismatch("Waiting for Design", 4, DEFAULT_STATUS_STAGE_MAP)).toEqual({
      label: "Status says Pre-Close, Tasks say Setup and Staging",
      computed: 4,
    });
    expect(stageMismatch("Contract Fell Through", 1, DEFAULT_STATUS_STAGE_MAP)).toBeNull();
    expect(stageMismatch(null, 1, DEFAULT_STATUS_STAGE_MAP)).toBeNull();
    expect(stageMismatch("Repairs", 1, parseStatusStageMap({ Repairs: 1, Bad: 9 }))).toBeNull();
  });
  it("schedule health: Behind N days when an open Task is more than 2 days late or the estimate is after the committed date", () => {
    expect(scheduleHealth({ tasks: [t({ due_on: "2026-11-10" })], today: TODAY, estimateOn: null, committedOn: null }).label).toBe("On track");
    expect(scheduleHealth({ tasks: [t({ due_on: "2026-11-09" }), t({ due_on: "2026-11-02" })], today: TODAY, estimateOn: null, committedOn: null }).label).toBe("Behind 10 days");
    expect(scheduleHealth({ tasks: [t({ due_on: "2026-11-01", status: "complete" })], today: TODAY, estimateOn: null, committedOn: null }).label).toBe("On track");
    expect(scheduleHealth({ tasks: [], today: TODAY, estimateOn: "2026-11-25", committedOn: "2026-11-20" }).label).toBe("Behind 5 days");
    expect(scheduleHealth({ tasks: [], today: TODAY, estimateOn: "2026-11-19", committedOn: "2026-11-20" }).label).toBe("On track");
  });
});

describe("1.5 whose Task (PM owns unassigned)", () => {
  it("You wins when the Task is the viewer's; a Task with no person counts as the PM's", () => {
    expect(ownerTagFor(t({ assigned_to: ME, assigned_seat: "designer" }), ME, PM)).toBe("you");
    expect(ownerTagFor(t({ assigned_seat: "designer" }), PM, PM)).toBe("you");
    expect(ownerTagFor(t({}), PM, PM)).toBe("you");
    expect(ownerTagFor(t({ assigned_seat: "designer" }), ME, PM)).toBe("designer");
    expect(ownerTagFor(t({ assigned_seat: "utilities", assigned_to: "u" }), ME, PM)).toBe("utilities");
    expect(ownerTagFor(t({ task_kind: "send_to_owner", assigned_seat: "onboarding_project_manager" }), ME, PM)).toBe("homeowner");
    expect(ownerTagFor(t({}), ME, PM)).toBe("unassigned");
    expect(ownerTagFor(t({ assigned_seat: "onboarding_director" }), ME, PM)).toBe("director");
  });
  it("the role is always written in the tag", () => {
    const name = (id: string) => (id === "d" ? "Dana Designer" : null);
    expect(ownerTagText(t({ roleLabel: "Designer", assigned_seat: "designer", assigned_to: "d" }), ME, PM, name)).toBe("Designer · Dana Designer");
    expect(ownerTagText(t({}), ME, PM, name)).toBe("Unassigned · PM owns it");
    expect(ownerTagText(t({ roleLabel: "Utilities", assigned_seat: "utilities" }), PM, PM, name)).toBe("Utilities · You");
  });
  it("counts per tag are open Tasks only", () => {
    const c = tagCounts([t({ assigned_to: ME }), t({ assigned_to: ME, status: "complete" }), t({})], ME, PM);
    expect(c).toMatchObject({ you: 1, unassigned: 1 });
  });
});

describe("1.5 Do now, Up next, Done", () => {
  const tasks = [
    t({ id: "late-other", stage: "Intake", due_on: "2026-11-10" }),
    t({ id: "soon", stage: "Pre-Close", due_on: "2026-11-14" }),
    t({ id: "later", stage: "Pre-Close", due_on: "2026-11-30" }),
    t({ id: "nodate", stage: "Pre-Close" }),
    t({ id: "done", stage: "Pre-Close", status: "complete", completed_at: "2026-11-01T10:00:00Z" }),
    t({ id: "future-other", stage: "Handoff", due_on: "2026-11-13" }),
  ];
  it("Do now = only the selected stage's Tasks late or due within 2 days; late Tasks elsewhere are only counted", () => {
    const l = stageLists(tasks, { stage: 1, today: TODAY, tag: null, viewerId: ME, pmId: PM });
    expect(l.doNow.map((x) => [x.task.id, x.fromStage])).toEqual([["soon", null]]);
    expect(l.upNext.map((x) => x.id)).toEqual(["later", "nodate"]);
    expect(l.done.map((x) => x.id)).toEqual(["done"]);
    expect(l.lateElsewhere).toBe(1);
    // A late Task in the selected stage is in Do now, not in the other-stages count.
    const own = stageLists([...tasks, t({ id: "late-here", stage: "Pre-Close", due_on: "2026-11-01" })], { stage: 1, today: TODAY, tag: null, viewerId: ME, pmId: PM });
    expect(own.doNow.map((x) => x.task.id)).toEqual(["late-here", "soon"]);
    expect(own.lateElsewhere).toBe(1);
    // Intake has no other-stage late Task once its own late one is counted there.
    expect(stageLists(tasks, { stage: 0, today: TODAY, tag: null, viewerId: ME, pmId: PM }).lateElsewhere).toBe(0);
  });
  it("one line for late Tasks in other stages; the all-late view lists every late Task with its stage", () => {
    expect(lateElsewhereLabel(1)).toBe("1 late Task in other stages ›");
    expect(lateElsewhereLabel(104)).toBe("104 late Tasks in other stages ›");
    const all = lateEverywhere([...tasks, t({ id: "late-handoff", stage: "Handoff", due_on: "2026-11-05" })], { today: TODAY, tag: null, viewerId: ME, pmId: PM });
    expect(all.map((x) => [x.task.id, x.fromStage, x.late])).toEqual([
      ["late-handoff", "Handoff", 7],
      ["late-other", "Intake", 2],
    ]);
  });
  it("a whose-Task filter narrows every list", () => {
    const l = stageLists([...tasks, t({ id: "mine", stage: "Pre-Close", assigned_to: ME, due_on: "2026-12-01" })], { stage: 1, today: TODAY, tag: "you", viewerId: ME, pmId: PM });
    expect([...l.doNow.map((x) => x.task.id), ...l.upNext.map((x) => x.id)]).toEqual(["mine"]);
  });
  it("rows read N days late or the date", () => {
    expect(rowDue(t({ due_on: "2026-11-10" }), TODAY)).toEqual({ text: "2 days late", late: true });
    expect(rowDue(t({ due_on: "2026-11-20" }), TODAY)).toEqual({ text: "Nov 20", late: false });
  });
  it("the row renders the exact role colors, a 28 px box and a 60 px phone row", () => {
    const html = renderToStaticMarkup(
      <TasksTab
        propertyId="h"
        tasks={tasks.map((x) => ({ ...x, roleLabel: "Project Manager" }))}
        people={[]}
        viewerId={ME}
        pmId={PM}
        today={TODAY}
        stage={1}
        onStage={() => {}}
        tag={null}
        onTag={() => {}}
        catchUp={{ selectable: new Set(["soon"]), selected: new Set(), toggle: () => {}, replace: () => {}, clear: () => {} }}
        onOpen={() => {}}
        addViewer={null}
        notNeededLabel={(r) => r ?? ""}
      />,
    );
    expect(html).toContain("DO NOW · 1");
    expect(html).toContain("UP NEXT · 2");
    expect(html).toContain("Done (1)");
    expect(html).toContain("1 late Task in other stages ›");
    expect(html).not.toContain("late-other");
    expect(html).not.toContain("Showing: late Tasks in every stage");
    expect(html).toContain("bg-role-unassigned-bar");
    expect(html).toContain("size-7");
    expect(html).toContain("min-h-[60px]");
    expect(html).toContain("md:min-h-14");
    expect(html).toContain("bg-stage-selected");
    expect(html).toContain(
      "Green is always you, whoever is signed in. Late Tasks in other stages show as one line at the top. Unassigned Tasks belong to the PM until handed off.",
    );
    const css = readFileSync("src/styles.css", "utf8");
    for (const hex of ["#e3f4ea", "#1e6b3e", "#2e9e5b", "#efe6fb", "#5e3399", "#8a5cd1", "#e3eefb", "#1d5596", "#3b7fd1", "#fdf0dc", "#8a5200", "#d08a1e", "#e9ecee", "#3d4a52", "#6b7a84", "#f3f1ec", "#a8a194", "#5f5f5f", "#b8b1a4", "#145a5e", "#9a2f22"])
      expect(css).toContain(hex);
  });
});

describe("1.2 Needs attention", () => {
  it("chips show only when true, in order, each with its jump", () => {
    const chips = needsAttention({
      ownerWaitingOnUs: 2,
      ownerDecisionsDue: 1,
      yoursLate: 3,
      mismatch: { label: "Status says Pre-Close, Tasks say Setup and Staging", computed: 4 },
      missingRoles: ["Designer"],
      committedMissing: true,
    });
    expect(chips.map((c) => c.label)).toEqual([
      "Owner replied, waiting on us: 2",
      "Owner decision due tomorrow: 1",
      "Yours late: 3",
      "Status says Pre-Close, Tasks say Setup and Staging",
      "Designer not assigned",
      "Committed handoff date not set",
    ]);
    expect(chips.map((c) => c.jump)).toEqual([
      { tab: "owner" },
      { tab: "owner" },
      { tab: "tasks", stage: null, tag: "you" },
      { tab: "tasks", stage: 3, tag: null },
      { tab: "details", section: "team" },
      { tab: "details", section: "dates" },
    ]);
    expect(needsAttention({ ownerWaitingOnUs: 0, ownerDecisionsDue: 0, yoursLate: 0, mismatch: null, missingRoles: [], committedMissing: false })).toEqual([]);
    expect(chips.some((c) => /weekly/i.test(c.label) || /weekly/i.test(c.key))).toBe(false);
  });
  it("the first 3 chips show, the rest behind +N more", () => {
    const six = [1, 2, 3, 4, 5, 6];
    expect(foldChips(six, false)).toEqual({ shown: [1, 2, 3], more: 3 });
    expect(foldChips(six, true)).toEqual({ shown: six, more: 3 });
    expect(foldChips([1, 2], false)).toEqual({ shown: [1, 2], more: 0 });
  });
  it("lives on Overview only, never in the header", () => {
    const page = readFileSync("src/routes/_authenticated/onboarding.$propertyId.tsx", "utf8");
    const header = readFileSync("src/components/onboarding/home-page/OnboardingHomeHeader.tsx", "utf8");
    const overview = page.slice(page.indexOf('<TabsContent value="overview"'), page.indexOf('<TabsContent value="tasks"'));
    expect(overview).toContain("<NeedsAttentionStrip");
    expect(page.match(/<NeedsAttentionStrip/g)).toHaveLength(1);
    expect(header).not.toMatch(/<NeedsAttention|attention[=?:]/);
    const parts = readFileSync("src/components/onboarding/home-page/OverviewParts.tsx", "utf8");
    expect(parts).toContain("Needs attention on this home");
  });
  it("a jump pushes history with one Back button; a tab click or Back drops it", () => {
    const s0 = { tab: "overview", task: "x" };
    const jumped = attentionJumpSearch(s0, "owner");
    expect(jumped).toEqual({ tab: "owner", task: "x", from: "attention" });
    expect(showBackToAttention(jumped, "owner")).toBe(true);
    expect(showBackToAttention(jumped, "overview")).toBe(false);
    expect(tabClickSearch(jumped, "files")).toEqual({ tab: "files", task: "x" });
    expect(showBackToAttention(tabClickSearch(jumped, "files"), "files")).toBe(false);
    expect(showBackToAttention({ tab: "owner" }, "owner")).toBe(false);
    const page = readFileSync("src/routes/_authenticated/onboarding.$propertyId.tsx", "utf8");
    // The jump is a push (no replace); the Back button replaces and clears the chip's filters.
    expect(page).toContain("void navigate({ search: attentionJumpSearch(search, c.jump.tab) as never });");
    expect(page.match(/\/> Back to Needs attention/g)).toHaveLength(1);
    expect(page).toMatch(/const backToAttention = \(\) => \{\s+jumpFilters\.current = false;\s+setStageSel\(undefined\);\s+setTagSel\(null\);/);
  });
  it("Yours late counts Tasks assigned to the viewer, or unassigned where the viewer is PM", () => {
    const tasks = [t({ assigned_to: ME, due_on: "2026-11-11" }), t({ due_on: "2026-11-11" }), t({ assigned_to: ME, due_on: TODAY })];
    expect(yoursLate(tasks, ME, PM, TODAY)).toHaveLength(1);
    expect(yoursLate(tasks, PM, PM, TODAY)).toHaveLength(1);
  });
  it("owner decisions due within 1 business day (Friday rolls to Monday)", () => {
    expect(nextBusinessDay("2026-11-13")).toBe("2026-11-16");
    expect(nextBusinessDay(TODAY)).toBe("2026-11-13");
    const due = ownerDecisionsDue(
      [
        t({ owner_dependency: "business_decision", due_on: "2026-11-13" }),
        t({ requires_owner_approval: true, owner_approval_status: "awaiting_owner", due_on: "2026-11-12" }),
        t({ requires_owner_approval: true, owner_approval_status: "approved", due_on: "2026-11-12" }),
        t({ owner_dependency: "business_decision", due_on: "2026-11-20" }),
      ],
      TODAY,
    );
    expect(due).toHaveLength(2);
  });
  it("Committed handoff date not set only past closing", () => {
    expect(committedHandoffMissing({ committedOn: null, actualClosingOn: "2026-10-22", plannedClosingOn: null, today: TODAY })).toBe(true);
    expect(committedHandoffMissing({ committedOn: null, actualClosingOn: null, plannedClosingOn: "2026-12-01", today: TODAY })).toBe(false);
    expect(committedHandoffMissing({ committedOn: "2026-11-20", actualClosingOn: "2026-10-22", plannedClosingOn: null, today: TODAY })).toBe(false);
  });
});

describe("1.1 header lines", () => {
  it("facts line: Closed, Handoff (committed else estimate), Stage, PM; before closing it says Closing", () => {
    expect(factsLine({ actualClosingOn: "2026-10-22", plannedClosingOn: null, committedOn: "2026-11-20", estimateOn: "2026-11-25", stage: 4, pmName: "Pat", today: TODAY })).toBe(
      "Closed Oct 22 · Handoff Nov 20 · Stage 4 of 6 · PM Pat",
    );
    expect(factsLine({ actualClosingOn: null, plannedClosingOn: "2026-12-03", committedOn: null, estimateOn: "2027-01-10", stage: 1, pmName: null, today: TODAY })).toBe(
      "Closing Dec 3 · Handoff Jan 10 · Stage 1 of 6",
    );
  });
  it("+N more holds only what is set", () => {
    expect(moreTags({ market: "OKC", scope: "Full furnishing", hoa: true, breezeway: false, labels: ["Pool"] })).toEqual(["OKC", "Full furnishing", "HOA", "Pool"]);
  });
  const contact = { phone: "(405) 555-0142", email: "ryan@example.test", telegram: "@ryanlee" };
  it("owner row: the people, then the legal owner; one preferred button, the rest behind Call or email", () => {
    const r = ownerRow({ people: ["Ryan Lee", "Lindsey Lee"], legal: "Adriel Properties, LLC", ...contact, preferred: "call" });
    expect([r.names, r.legal]).toEqual(["Ryan Lee and Lindsey Lee", "Adriel Properties, LLC"]);
    expect([r.primary?.label, r.primary?.href, r.primary?.preferred]).toEqual(["Call Ryan (preferred)", "tel:+14055550142", true]);
    expect(r.others.map((x) => [x.label, x.href])).toEqual([
      ["Text Ryan", "sms:+14055550142"],
      ["Email", "mailto:ryan@example.test"],
      ["Telegram", "https://t.me/ryanlee"],
    ]);
    const labels = (m: string) => ownerRow({ people: ["Ryan Lee"], legal: "X", ...contact, preferred: m }).primary;
    expect([labels("text")?.label, labels("text")?.href]).toEqual(["Text Ryan (preferred)", "sms:+14055550142"]);
    expect([labels("email")?.label, labels("email")?.href]).toEqual(["Email (preferred)", "mailto:ryan@example.test"]);
    expect([labels("telegram")?.label, labels("telegram")?.href]).toEqual(["Telegram (preferred)", "https://t.me/ryanlee"]);
  });
  it("with no preferred method the first button is Text, not highlighted; Telegram only when set", () => {
    const r = ownerRow({ people: ["Ryan Lee"], legal: "X", ...contact, telegram: null, preferred: null });
    expect([r.primary?.label, r.primary?.preferred]).toEqual(["Text Ryan", false]);
    expect(r.others.map((x) => x.label)).toEqual(["Call Ryan", "Email"]);
    // No phone: the first method on file leads.
    expect(ownerRow({ people: [], legal: "Mike & Rachel Ramsey", phone: null, email: "m@example.test", telegram: null, preferred: null }).primary?.label).toBe("Email");
    // No separate people: the record's name shows once, not twice.
    const solo = ownerRow({ people: [], legal: "Mike & Rachel Ramsey", phone: null, email: null, telegram: null, preferred: null });
    expect([solo.names, solo.legal, solo.primary, solo.others]).toEqual(["Mike & Rachel Ramsey", null, null, []]);
  });
  it("owner record with people in parentheses: 1464 Buckland Ct reads the people once, then the legal owner", () => {
    const r = ownerRow({ people: ["Dana Syska"], legal: "Adriel Properties, LLC (Niles & Dana Syska)", ...contact, preferred: null });
    expect([r.names, r.legal]).toEqual(["Niles & Dana Syska", "Adriel Properties, LLC"]);
    expect(r.primary?.label).toBe("Text Niles");
    expect(ownerRow({ people: ["Dana Syska"], legal: "Adriel Properties, LLC (Niles & Dana Syska)", ...contact, preferred: "call" }).primary?.label).toBe("Call Niles (preferred)");
  });
  it("a login already covered by the parentheses is not repeated; match ignores case; others still show", () => {
    const r = ownerRow({ people: ["dana SYSKA", "Niles Syska", "Pat Reed"], legal: "Adriel Properties, LLC (Niles & Dana Syska)", ...contact, preferred: null });
    expect([r.names, r.legal]).toEqual(["Niles & Dana Syska and Pat Reed", "Adriel Properties, LLC"]);
    // Same first name, different last name is a different person.
    expect(ownerRow({ people: ["Dana Smith"], legal: "Adriel Properties, LLC (Niles & Dana Syska)", ...contact, preferred: null }).names).toBe("Niles & Dana Syska and Dana Smith");
  });
  it("an owner name without parentheses is unchanged", () => {
    const r = ownerRow({ people: ["Ryan Lee"], legal: "Adriel Properties, LLC", ...contact, preferred: null });
    expect([r.names, r.legal, r.primary?.label]).toEqual(["Ryan Lee", "Adriel Properties, LLC", "Text Ryan"]);
    const solo = ownerRow({ people: [], legal: "Mike & Rachel Ramsey", phone: null, email: null, telegram: null, preferred: null });
    expect([solo.names, solo.legal]).toEqual(["Mike & Rachel Ramsey", null]);
  });
  it("the header has one owner line and no Grasshopper or Outlook note", () => {
    const header = readFileSync("src/components/onboarding/home-page/OnboardingHomeHeader.tsx", "utf8");
    expect(header).not.toMatch(/Grasshopper|Outlook/);
    expect(header).toContain('{showWays ? "Less" : "Call or email"}');
    expect(readFileSync("src/lib/owner-link.server.ts", "utf8")).toMatch(/people,\n\s+\},\n\s+canManage: true/);
    expect(telegramLink("https://t.me/some_one")).toBe("https://t.me/some_one");
    expect(telegramLink("not a handle")).toBeNull();
  });
});

describe("1.7 Add task and the permission rule", () => {
  const v = (o: Partial<AddViewer> = {}): AddViewer => ({ userId: ME, isAdmin: false, isOnboardingDirector: false, isOnboarding: true, isHomePm: false, roleCodes: [], ...o });
  it("Admin and Director of Onboarding on every home; PM on their homes; Designer and Utilities only their own work; Operations never", () => {
    expect(canAddOneOff(v({ isAdmin: true, isOnboarding: false }), { kind: "homeowner" })).toBe(true);
    expect(canAddOneOff(v({ isOnboardingDirector: true }), { kind: "role", role: "designer" })).toBe(true);
    expect(canAddOneOff(v({ isHomePm: true }), { kind: "person", personId: "x" })).toBe(true);
    expect(canAddOneOff(v(), { kind: "you" })).toBe(false);
    expect(canAddOneOff(v({ roleCodes: ["utilities"] }), { kind: "you" })).toBe(true);
    expect(canAddOneOff(v({ roleCodes: ["utilities"] }), { kind: "role", role: "utilities" })).toBe(true);
    expect(canAddOneOff(v({ roleCodes: ["utilities"] }), { kind: "role", role: "designer" })).toBe(false);
    expect(canAddOneOff(v({ roleCodes: ["designer"] }), { kind: "person", personId: "x" })).toBe(false);
    expect(canAddOneOff(v({ roleCodes: ["designer"] }), { kind: "homeowner" })).toBe(false);
    expect(canAddOneOff(v({ isOnboarding: false, isHomePm: true, roleCodes: ["utilities"] }), { kind: "you" })).toBe(false);
  });
  it("a one-off is kind Do it; Homeowner makes it a Send to the homeowner Task", () => {
    expect(oneOffColumns({ kind: "you" }, ME)).toEqual({ assigned_to: ME, assigned_seat: null, task_kind: "do_it" });
    expect(oneOffColumns({ kind: "role", role: "utilities" }, ME)).toEqual({ assigned_to: null, assigned_seat: "utilities", task_kind: "do_it" });
    expect(oneOffColumns({ kind: "homeowner" }, ME)).toEqual({ assigned_to: null, assigned_seat: null, task_kind: "send_to_owner" });
    expect(stageKeyFor(2, [{ stage: "Access & Setup" }])).toBe("Access & Setup");
    expect(stageKeyFor(2, [])).toBe("Ordering & Repairs");
  });

  // A tiny fake of the signed-in client: records the insert, answers the home read.
  const fake = (home: Record<string, unknown> | null) => {
    const inserted: Record<string, unknown>[] = [];
    const chain = (table: string) => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: table === "properties" ? home : { id: "x" }, error: null }) }),
      }),
      insert: (row: Record<string, unknown>) => {
        inserted.push(row);
        return { select: () => ({ single: async () => ({ data: { id: "new-task", created_at: "now" }, error: null }) }) };
      },
    });
    return { sb: { from: chain }, inserted };
  };
  const input = { propertyId: "h", stage: "Pre-Close", title: "Collect gate codes", whose: { kind: "you" } as const, dueOn: null };
  const viewer = (o: Partial<AddViewer> = {}) => {
    const { userId: _u, ...rest } = v(o);
    return rest;
  };

  it("the server refuses anyone the rule refuses, before writing anything", async () => {
    const f = fake({ id: "h", is_demo: false });
    await expect(addStageTask(f.sb, ME, viewer({ isOnboarding: false }), input, async () => {})).rejects.toThrow(ADD_REFUSED);
    await expect(addStageTask(f.sb, ME, viewer({ roleCodes: ["designer"] }), { ...input, whose: { kind: "role", role: "utilities" } }, async () => {})).rejects.toThrow(ADD_REFUSED);
    expect(f.inserted).toEqual([]);
  });
  it("the server refuses a locked home", async () => {
    const f = fake({ id: "h", is_demo: false, handoff_accepted_at: "2026-11-01" });
    await expect(addStageTask(f.sb, ME, viewer({ isAdmin: true }), input, async () => {})).rejects.toThrow(/locked/);
    expect(f.inserted).toEqual([]);
  });
  it("a PM on their home adds a one-off in that stage, logged with who", async () => {
    const f = fake({ id: "h", is_demo: false });
    const audits: unknown[] = [];
    const r = await addStageTask(f.sb, ME, viewer({ isHomePm: true }), input, async (e) => void audits.push(e));
    expect(r.id).toBe("new-task");
    expect(f.inserted[0]).toMatchObject({ property_id: "h", stage: "Pre-Close", title: "Collect gate codes", task_kind: "do_it", assigned_to: ME, created_by: ME, status: "open" });
    expect(audits[0]).toMatchObject({ actorId: ME, action: "onboarding_task_created", entityId: "new-task" });
  });
  it("the server function loads the viewer and runs this check", () => {
    const fn = readFileSync("src/lib/onboarding-home-page.functions.ts", "utf8");
    expect(fn).toMatch(/requireSupabaseAuth/);
    expect(fn).toMatch(/loadCatchUpViewer\(context\.supabase as never, context\.userId, data\.propertyId\)/);
    expect(fn).toMatch(/addStageTask\(context\.supabase/);
  });
});

describe("tab bar (fix 4) and badges (fix 5)", () => {
  const page = readFileSync("src/routes/_authenticated/onboarding.$propertyId.tsx", "utf8");
  it("the tabs sit alone in a pinned bar", () => {
    const bar = page.slice(page.indexOf('data-testid="home-tab-bar"') - 200, page.indexOf("</TabsList>"));
    expect(bar).toMatch(/className="sticky [^"]*bg-card[^"]*shadow-sm"/);
    expect(bar).toContain("<TabsList");
    expect(bar).not.toMatch(/<Button|<h1|homeName|<p /);
  });
  it("only the Owner tab carries a count", () => {
    const bar = page.slice(page.indexOf("PAGE_TABS.map("), page.indexOf("</TabsList>"));
    expect(bar.match(/t\.value === "/g)).toEqual(['t.value === "']);
    expect(bar).toContain('t.value === "owner" && ownerSummary.waitingOnUs > 0');
  });
});

describe("removed from the page", () => {
  const page = readFileSync("src/routes/_authenticated/onboarding.$propertyId.tsx", "utf8");
  it("no banner photo, no Owner Type line, no separate Every task list", () => {
    expect(page).not.toMatch(/"Every task"|>\s*Every task\s*</);
    expect(page).not.toContain("<PropertyWorkQueue");
    expect(page).not.toContain("headerFactsLine");
    expect(page).not.toContain("HomeBoardHeader");
  });
  it("the plan catch-up bar is reused as is", () => {
    expect(page).toContain("<PlanCatchUpBar");
    expect(page).toMatch(/canEditSelected=\{bulkEditQuery\.data === true\}/);
  });
});
