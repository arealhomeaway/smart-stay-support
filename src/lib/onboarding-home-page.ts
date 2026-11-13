/**
 * One home's page in its Onboarding view, Part 1 of 3 (approved by the Admin and the
 * Director of Onboarding, Nov 12). Pure rules only, so the header, Needs attention, the
 * Overview cards and the Tasks tab read the same facts and each rule is tested without a
 * database: the tabs, the stage names, the Status to stage map, schedule health, whose Task
 * it is (the PM owns unassigned work), Do now / Up next / Done, the owner contact links and
 * who may add a one-off Task. The database and server functions re-check every save.
 */
import { SIX_STAGES, daysBetween, isFinished, shortDate, sixStageFor } from "@/lib/onboarding-board";

/* ---------------------------------------------------------------- tabs */

export const PAGE_TABS = [
  { value: "overview", label: "Overview" },
  { value: "tasks", label: "Tasks" },
  { value: "owner", label: "Owner" },
  { value: "details", label: "Home details" },
  { value: "vendors", label: "Vendors and work" },
  { value: "files", label: "Files" },
  { value: "budget", label: "Budget" },
  { value: "activity", label: "Activity" },
  // Temporary until Parts 2 and 3 give General Info, Design and Agreements their new homes.
  { value: "more", label: "More" },
] as const;
export type PageTab = (typeof PAGE_TABS)[number]["value"];

/** Older links keep working: each old tab opens the tab that now holds its content. */
const OLD_PAGE_TAB: Record<string, PageTab> = {
  plan: "tasks",
  work: "tasks",
  workflow: "tasks",
  timeline: "tasks",
  calendar: "tasks",
  "active-owner": "owner",
  opportunities: "owner",
  team: "details",
  dates: "details",
  workorders: "vendors",
  financial: "budget",
  history: "activity",
  info: "more",
  property: "more",
  findings: "more",
  design: "more",
  agreements: "more",
  handoff: "more",
};

/** Part 1 fix 6: the page opens on Overview; an Opportunity link opens the Owner tab. */
export const DEFAULT_PAGE_TAB: PageTab = "overview";

export function pageTabFor(raw: unknown, hasOpportunity = false): PageTab {
  if (typeof raw === "string") {
    if (PAGE_TABS.some((t) => t.value === raw)) return raw as PageTab;
    if (OLD_PAGE_TAB[raw]) return OLD_PAGE_TAB[raw]!;
  }
  return hasOpportunity ? "owner" : DEFAULT_PAGE_TAB;
}

/** Set in the address when a Needs attention chip took the person to another tab. */
export const FROM_ATTENTION = "attention";
type TabSearch = Record<string, unknown>;

/** A Needs attention jump: a new history entry, marked so one Back button shows. */
export function attentionJumpSearch<S extends TabSearch>(search: S, tab: PageTab): S & { tab: PageTab; from: string } {
  return { ...search, tab, from: FROM_ATTENTION };
}

/** A tab clicked directly (or "Back to Needs attention" with Overview): the mark goes. */
export function tabClickSearch<S extends TabSearch>(search: S, tab: PageTab): Omit<S, "from"> & { tab: PageTab } {
  const { from: _from, ...rest } = search;
  return { ...rest, tab } as Omit<S, "from"> & { tab: PageTab };
}

/** One "Back to Needs attention" button, only after a jump and never on Overview itself. */
export function showBackToAttention(search: TabSearch, tab: PageTab): boolean {
  return search["from"] === FROM_ATTENTION && tab !== "overview";
}

/* -------------------------------------------------------------- stages */

/** The six stage names as this page writes them (1.4). The stored stage keys are unchanged. */
export const PAGE_STAGE_NAMES = [
  "Intake",
  "Pre-Close",
  "Ordering and Repairs",
  "Setup and Staging",
  "Preparing for Handoff",
  "Handoff",
] as const;

/** 0 to 5 for a Task's stage, or -1 when its stage is not on the six stage map. */
export function stageIndexOf(stage: string | null | undefined): number {
  const s = sixStageFor(stage);
  return s ? (SIX_STAGES as readonly string[]).indexOf(s) : -1;
}

export type PageTask = {
  id: string;
  title: string;
  stage: string;
  status: string;
  due_on: string | null;
  assigned_to: string | null;
  assigned_seat?: string | null;
  task_kind?: string | null;
  parent_task_id?: string | null;
  completed_at?: string | null;
  requires_owner_approval?: boolean | null;
  owner_dependency?: string | null;
  owner_approval_status?: string | null;
  /** The role as staff read it (taskRoleLabel). */
  roleLabel?: string | null;
};

/** 1.4: the computed stage is the earliest stage that still has an open Task (1 to 6). */
export function computedStage(tasks: PageTask[]): number {
  for (let i = 0; i < SIX_STAGES.length; i++) {
    if (tasks.some((t) => stageIndexOf(t.stage) === i && !isFinished(t) && !t.parent_task_id)) return i + 1;
  }
  return SIX_STAGES.length;
}

/* ------------------------------------------------ Status to stage map */

export const STATUS_STAGE_MAP_KEY = "onboarding_status_stage_map";

/** Seeded exactly as approved (1.4). Contract Fell Through has no stage, so never a chip. */
export const DEFAULT_STATUS_STAGE_MAP: Readonly<Record<string, number | null>> = {
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
};

/** A stored map; anything that is not a status name with 1 to 6 or none is ignored. */
export function parseStatusStageMap(value: unknown): Record<string, number | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_STATUS_STAGE_MAP };
  const out: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === null) out[k] = null;
    else if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 6) out[k] = v;
  }
  return out;
}

export function statusStage(status: string | null | undefined, map: Record<string, number | null>): number | null {
  const s = (status ?? "").trim();
  if (!s || !(s in map)) return null;
  return map[s] ?? null;
}

/** 1.2 / 1.4: "Status says X, Tasks say Y" only when the mapped stage differs from the computed one. */
export function stageMismatch(
  status: string | null | undefined,
  computed: number,
  map: Record<string, number | null>,
): { label: string; computed: number } | null {
  const mapped = statusStage(status, map);
  if (mapped === null || mapped === computed) return null;
  return {
    label: `Status says ${PAGE_STAGE_NAMES[mapped - 1]}, Tasks say ${PAGE_STAGE_NAMES[computed - 1]}`,
    computed,
  };
}

/* ------------------------------------------------------ schedule health */

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

/**
 * 1.4: Behind N days when any open Task is more than 2 days late (N = most days late) or the
 * estimated handoff is after the committed handoff (N = days between); the larger wins.
 */
export function scheduleHealth(input: {
  tasks: PageTask[];
  today: string;
  estimateOn: string | null | undefined;
  committedOn: string | null | undefined;
}): { behind: boolean; days: number; label: string } {
  let late = 0;
  for (const t of input.tasks) {
    if (isFinished(t) || t.parent_task_id || !t.due_on || t.due_on >= input.today) continue;
    late = Math.max(late, daysBetween(t.due_on, input.today));
  }
  const fromLate = late > 2 ? late : 0;
  const slip =
    input.committedOn && input.estimateOn && input.estimateOn > input.committedOn
      ? daysBetween(input.committedOn, input.estimateOn)
      : 0;
  const n = Math.max(fromLate, slip);
  return n > 0 ? { behind: true, days: n, label: `Behind ${days(n)}` } : { behind: false, days: 0, label: "On track" };
}

/* ------------------------------------------------------ whose Task */

export type OwnerTag = "you" | "designer" | "utilities" | "homeowner" | "director" | "unassigned";
export const OWNER_TAG_ORDER: readonly OwnerTag[] = ["you", "designer", "utilities", "homeowner", "director", "unassigned"];
export const OWNER_TAG_LABEL: Record<OwnerTag, string> = {
  you: "You",
  designer: "Designer",
  utilities: "Utilities",
  homeowner: "Homeowner",
  director: "Director or other team",
  unassigned: "Unassigned (PM owns)",
};

const DESIGN_SEATS = new Set(["designer", "lead_designer", "design_staging"]);

/** The ownership rule: a Task with no person counts as the home's PM's until a person is assigned. */
export function effectiveOwner(t: Pick<PageTask, "assigned_to">, pmId: string | null | undefined): string | null {
  return t.assigned_to ?? pmId ?? null;
}

/** 1.5: which colored tag a Task wears. "You" wins when the Task is the viewer's (PM owns unassigned). */
export function ownerTagFor(t: PageTask, viewerId: string | null | undefined, pmId: string | null | undefined): OwnerTag {
  if (viewerId && effectiveOwner(t, pmId) === viewerId) return "you";
  if (t.task_kind === "send_to_owner") return "homeowner";
  const seat = t.assigned_seat ?? null;
  if (seat && DESIGN_SEATS.has(seat)) return "designer";
  if (seat === "utilities") return "utilities";
  if (!t.assigned_to && !seat) return "unassigned";
  return "director";
}

/** The tag's words: "<Role> · <person>", "<Role> · You" or "Unassigned · PM owns it". The role is always written. */
export function ownerTagText(
  t: PageTask,
  viewerId: string | null | undefined,
  pmId: string | null | undefined,
  nameOf: (id: string) => string | null,
): string {
  const role = t.task_kind === "send_to_owner" ? "Homeowner" : t.roleLabel || "Unassigned";
  const owner = effectiveOwner(t, pmId);
  const who =
    viewerId && owner === viewerId
      ? "You"
      : t.assigned_to
        ? (nameOf(t.assigned_to) ?? "Teammate")
        : "PM owns it";
  return `${role} · ${who}`;
}

/** Open count per tag in a set of Tasks (the WHOSE TASK rows). */
export function tagCounts(tasks: PageTask[], viewerId: string | null | undefined, pmId: string | null | undefined) {
  const out: Record<OwnerTag, number> = { you: 0, designer: 0, utilities: 0, homeowner: 0, director: 0, unassigned: 0 };
  for (const t of tasks) if (!isFinished(t) && !t.parent_task_id) out[ownerTagFor(t, viewerId, pmId)] += 1;
  return out;
}

/* ------------------------------------------- Do now / Up next / Done */

function addDaysIso(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  return new Date(d.getTime() + n * 86_400_000).toISOString().slice(0, 10);
}

export type ListedTask<T extends PageTask> = { task: T; fromStage: string | null; late: number };

/**
 * 1.5 as fixed: Do now = the selected stage's open Tasks late or due within 2 days; Up next = the
 * rest of that stage's open Tasks by due date; Done = that stage's finished Tasks. Late Tasks in
 * other stages are only counted (lateElsewhere) for the one line above Do now. stage null means
 * All stages. A whose-Task filter narrows everything.
 */
export function stageLists<T extends PageTask>(
  tasks: T[],
  input: { stage: number | null; today: string; tag: OwnerTag | null; viewerId: string | null | undefined; pmId: string | null | undefined },
) {
  const soon = addDaysIso(input.today, 2);
  const keep = (t: T) => !t.parent_task_id && (!input.tag || ownerTagFor(t, input.viewerId, input.pmId) === input.tag);
  const inStage = (t: T) => input.stage === null || stageIndexOf(t.stage) === input.stage;
  const lateBy = (t: T) => (t.due_on && t.due_on < input.today ? daysBetween(t.due_on, input.today) : 0);
  const open = tasks.filter((t) => !isFinished(t) && keep(t));
  const byDue = (a: T, b: T) => (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999") || a.title.localeCompare(b.title);
  const doNow: ListedTask<T>[] = open
    .filter((t) => inStage(t) && t.due_on !== null && t.due_on <= soon)
    .sort(byDue)
    .map((task) => ({ task, late: lateBy(task), fromStage: null }));
  const now = new Set(doNow.map((x) => x.task.id));
  const upNext = open.filter((t) => inStage(t) && !now.has(t.id)).sort(byDue);
  const done = tasks
    .filter((t) => isFinished(t) && inStage(t) && keep(t))
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
  const lateElsewhere = open.filter((t) => !inStage(t) && lateBy(t) > 0).length;
  return { doNow, upNext, done, lateElsewhere };
}

function stageNameOf(stage: string) {
  const i = stageIndexOf(stage);
  return i >= 0 ? PAGE_STAGE_NAMES[i]! : "Other tasks";
}

/** The all-late view: every open late Task in every stage, most late first, each with its stage. */
export function lateEverywhere<T extends PageTask>(
  tasks: T[],
  input: { today: string; tag: OwnerTag | null; viewerId: string | null | undefined; pmId: string | null | undefined },
): ListedTask<T>[] {
  return tasks
    .filter(
      (t) =>
        !t.parent_task_id &&
        !isFinished(t) &&
        t.due_on !== null &&
        t.due_on < input.today &&
        (!input.tag || ownerTagFor(t, input.viewerId, input.pmId) === input.tag),
    )
    .sort((a, b) => a.due_on!.localeCompare(b.due_on!) || a.title.localeCompare(b.title))
    .map((task) => ({ task, late: daysBetween(task.due_on!, input.today), fromStage: stageNameOf(task.stage) }));
}

/** The one line above Do now: "N late Tasks in other stages ›". */
export function lateElsewhereLabel(n: number): string {
  return `${n} late ${n === 1 ? "Task" : "Tasks"} in other stages ›`;
}

/** The row's due words: "2 days late" (red) or the date. */
export function rowDue(t: Pick<PageTask, "due_on" | "status" | "completed_at">, today: string): { text: string; late: boolean } {
  if (isFinished(t)) return { text: t.completed_at ? `Done ${shortDate(t.completed_at)}` : "Done", late: false };
  if (!t.due_on) return { text: "No date", late: false };
  if (t.due_on < today) return { text: `${days(daysBetween(t.due_on, today))} late`, late: true };
  if (t.due_on === today) return { text: "Today", late: false };
  return { text: shortDate(t.due_on), late: false };
}

/** Stage rail: done/total per stage and whether it is complete. */
export function stageRail(tasks: PageTask[]) {
  return PAGE_STAGE_NAMES.map((name, i) => {
    const list = tasks.filter((t) => stageIndexOf(t.stage) === i && !t.parent_task_id);
    const done = list.filter(isFinished).length;
    return { index: i, name, done, total: list.length, complete: list.length > 0 && done === list.length };
  });
}

/* ---------------------------------------------------- Needs attention */

/** The next working day after today (Friday, Saturday and Sunday roll to Monday). */
export function nextBusinessDay(today: string): string {
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
  const step = dow === 5 ? 3 : dow === 6 ? 2 : 1;
  return addDaysIso(today, step);
}

/** Owner decisions linked to an open Task due within 1 business day (late ones included). */
export function ownerDecisionsDue(tasks: PageTask[], today: string): PageTask[] {
  const by = nextBusinessDay(today);
  return tasks.filter(
    (t) =>
      !isFinished(t) &&
      !t.parent_task_id &&
      Boolean(t.due_on && t.due_on <= by) &&
      ((t.requires_owner_approval === true && t.owner_approval_status !== "approved") ||
        t.owner_dependency === "business_decision"),
  );
}

/** Tasks that are the viewer's (assigned, or unassigned where the viewer is the PM) and more than 0 days late. */
export function yoursLate(tasks: PageTask[], viewerId: string | null | undefined, pmId: string | null | undefined, today: string) {
  if (!viewerId) return [];
  return tasks.filter(
    (t) => !isFinished(t) && !t.parent_task_id && t.due_on !== null && t.due_on < today && effectiveOwner(t, pmId) === viewerId,
  );
}

export type AttentionJump =
  | { tab: "owner" }
  | { tab: "tasks"; stage: number | null; tag: OwnerTag | null }
  | { tab: "details"; section: "team" | "dates" };

export type AttentionChip = { key: string; label: string; jump: AttentionJump };

/** Fix 3: the first 3 chips show; the rest fold behind "+N more". */
export const ATTENTION_SHOWN = 3;
export function foldChips<C>(chips: C[], open: boolean): { shown: C[]; more: number } {
  const more = Math.max(0, chips.length - ATTENTION_SHOWN);
  return { shown: open ? chips : chips.slice(0, ATTENTION_SHOWN), more };
}

/** 1.2, in order; a chip shows only when true. */
export function needsAttention(input: {
  ownerWaitingOnUs: number;
  ownerDecisionsDue: number;
  yoursLate: number;
  mismatch: { label: string; computed: number } | null;
  missingRoles: string[];
  committedMissing: boolean;
}): AttentionChip[] {
  const out: AttentionChip[] = [];
  if (input.ownerWaitingOnUs > 0)
    out.push({ key: "owner", label: `Owner replied, waiting on us: ${input.ownerWaitingOnUs}`, jump: { tab: "owner" } });
  if (input.ownerDecisionsDue > 0)
    out.push({ key: "decision", label: `Owner decision due tomorrow: ${input.ownerDecisionsDue}`, jump: { tab: "owner" } });
  if (input.yoursLate > 0)
    out.push({ key: "late", label: `Yours late: ${input.yoursLate}`, jump: { tab: "tasks", stage: null, tag: "you" } });
  if (input.mismatch)
    out.push({ key: "mismatch", label: input.mismatch.label, jump: { tab: "tasks", stage: input.mismatch.computed - 1, tag: null } });
  for (const r of input.missingRoles)
    out.push({ key: `role-${r}`, label: `${r} not assigned`, jump: { tab: "details", section: "team" } });
  if (input.committedMissing)
    out.push({ key: "committed", label: "Committed handoff date not set", jump: { tab: "details", section: "dates" } });
  return out;
}

/** Past closing (closed, or the planned closing has passed) with no Committed Handoff Date. */
export function committedHandoffMissing(input: {
  committedOn: string | null | undefined;
  actualClosingOn: string | null | undefined;
  plannedClosingOn: string | null | undefined;
  today: string;
}) {
  if (input.committedOn) return false;
  if (input.actualClosingOn && input.actualClosingOn <= input.today) return true;
  return Boolean(input.plannedClosingOn && input.plannedClosingOn < input.today);
}

/* --------------------------------------------------------- header */

/** 1.1 (3): "Closed Oct 22 · Handoff Nov 20 · Stage 4 of 6 · PM <name>"; before closing "Closing <date>". */
export function factsLine(input: {
  actualClosingOn: string | null | undefined;
  plannedClosingOn: string | null | undefined;
  committedOn: string | null | undefined;
  estimateOn: string | null | undefined;
  stage: number;
  pmName: string | null | undefined;
  today: string;
}): string {
  const parts: string[] = [];
  if (input.actualClosingOn && input.actualClosingOn <= input.today) parts.push(`Closed ${shortDate(input.actualClosingOn)}`);
  else if (input.actualClosingOn || input.plannedClosingOn)
    parts.push(`Closing ${shortDate((input.actualClosingOn || input.plannedClosingOn)!)}`);
  const handoff = input.committedOn || input.estimateOn;
  if (handoff) parts.push(`Handoff ${shortDate(handoff)}`);
  parts.push(`Stage ${input.stage} of ${SIX_STAGES.length}`);
  if (input.pmName) parts.push(`PM ${input.pmName}`);
  return parts.join(" · ");
}

/** 1.1 (2): the tags folded behind "+N more", only those that are set. */
export function moreTags(input: {
  market?: string | null;
  scope?: string | null;
  utilityOption?: string | null;
  hoa?: boolean;
  breezeway?: boolean;
  labels?: string[];
}): string[] {
  const out: string[] = [];
  if (input.market?.trim()) out.push(input.market.trim());
  if (input.scope?.trim()) out.push(input.scope.trim());
  if (input.utilityOption?.trim()) out.push(input.utilityOption.trim());
  if (input.hoa) out.push("HOA");
  if (input.breezeway) out.push("Breezeway connected");
  for (const l of input.labels ?? []) if (l.trim()) out.push(l.trim());
  return out;
}

/* ---------------------------------------------------- owner contact */

export const CONTACT_METHODS = ["text", "call", "email", "telegram"] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];
export const CONTACT_METHOD_LABEL: Record<ContactMethod, string> = {
  text: "Text",
  call: "Call",
  email: "Email",
  telegram: "Telegram",
};

export function firstName(name: string | null | undefined) {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

/** Digits with one leading +; a 10 digit US number gets +1. */
export function dialable(phone: string | null | undefined): string | null {
  const raw = (phone ?? "").trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return null;
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits;
}

/** A Telegram username or link, as a t.me link; null when it is not one. */
export function telegramLink(handle: string | null | undefined): string | null {
  const h = (handle ?? "").trim().replace(/^https?:\/\/(www\.)?(t\.me|telegram\.me)\//i, "").replace(/^@/, "").split(/[/?#]/)[0] ?? "";
  return /^[A-Za-z0-9_]{3,64}$/.test(h) ? `https://t.me/${h}` : null;
}

export type ContactButton = { method: ContactMethod; label: string; href: string; preferred: boolean; detail: string | null };

/**
 * An owner record named "Adriel Properties, LLC (Niles & Dana Syska)": the text in the closing
 * parentheses is the people, the text before it is the legal owner. `covered` lists each person
 * as first and last name ("Niles & Dana Syska" covers Niles Syska and Dana Syska). No closing
 * parentheses: people is null and the name is left alone.
 */
export function splitOwnerName(name: string | null | undefined): {
  people: string | null;
  legal: string | null;
  covered: { first: string; last: string }[];
} {
  const m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec((name ?? "").trim());
  const inner = (m?.[2] ?? "").trim();
  if (!m || !inner) return { people: null, legal: null, covered: [] };
  const parts = inner.split(/\s*(?:&|,|\band\b)\s*/i).map((x) => x.trim().split(/\s+/).filter(Boolean)).filter((x) => x.length);
  const shared = [...parts].reverse().find((x) => x.length > 1)?.slice(-1)[0] ?? "";
  const covered = parts.map((x) => ({ first: x[0]!.toLowerCase(), last: (x.length > 1 ? x[x.length - 1]! : shared).toLowerCase() }));
  return { people: inner, legal: m[1]!.trim() || null, covered };
}

/** Same first and last name, ignoring case; a one-word name matches on the first name. */
function coversPerson(c: { first: string; last: string }, person: string): boolean {
  const w = person.toLowerCase().split(/\s+/).filter(Boolean);
  if (!w.length || w[0] !== c.first) return false;
  return w.length === 1 || w[w.length - 1] === c.last;
}

/**
 * Fix 2: the owner row on one line. Names = the owner contacts (people); legal = the owner record's
 * name, shown in gray after them (omitted when there are no separate people, so it is not repeated).
 * A record name ending in "(…)" is split by splitOwnerName: the parentheses lead the people, logins
 * and the co-owner they already cover are dropped, and the text before them is the legal owner.
 * One button for the preferred method, marked "(preferred)"; with none set (or the preferred one
 * not on file) the first button is Text, else the first method on file. "Call or email" opens the rest.
 */
export function ownerRow(input: {
  people: string[];
  legal: string | null | undefined;
  phone: string | null | undefined;
  email: string | null | undefined;
  telegram: string | null | undefined;
  preferred: string | null | undefined;
}): { names: string; legal: string | null; primary: ContactButton | null; others: ContactButton[] } {
  const split = splitOwnerName(input.legal);
  const seen = new Set<string>();
  const people = input.people
    .map((p) => p.trim())
    .filter((p) => p && !seen.has(p.toLowerCase()) && seen.add(p.toLowerCase()))
    .filter((p) => !split.covered.some((c) => coversPerson(c, p)));
  if (split.people) people.unshift(split.people);
  const legal = split.people ? split.legal : (input.legal ?? "").trim() || null;
  const first = firstName(people[0] ?? legal);
  const phone = (input.phone ?? "").trim();
  const dial = dialable(phone);
  const email = (input.email ?? "").trim();
  const tg = telegramLink(input.telegram);
  const who = first ? ` ${first}` : "";
  const avail: Omit<ContactButton, "preferred">[] = [];
  if (dial) {
    avail.push({ method: "text", label: `Text${who}`, href: `sms:${dial}`, detail: phone });
    avail.push({ method: "call", label: `Call${who}`, href: `tel:${dial}`, detail: phone });
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) avail.push({ method: "email", label: "Email", href: `mailto:${email}`, detail: email });
  if (tg) avail.push({ method: "telegram", label: "Telegram", href: tg, detail: null });
  const pref = avail.find((b) => b.method === input.preferred) ?? null;
  const lead = pref ?? avail.find((b) => b.method === "text") ?? avail[0] ?? null;
  const primary = lead ? { ...lead, label: pref ? `${lead.label} (preferred)` : lead.label, preferred: Boolean(pref) } : null;
  return {
    names: people.length ? people.join(" and ") : (legal ?? ""),
    legal: people.length ? legal : null,
    primary,
    others: avail.filter((b) => b.method !== lead?.method).map((b) => ({ ...b, preferred: false })),
  };
}

/* ------------------------------------------------------ add a Task */

export type Whose =
  | { kind: "you" }
  | { kind: "role"; role: string }
  | { kind: "person"; personId: string }
  | { kind: "homeowner" };

export type AddViewer = {
  userId: string | null;
  isAdmin: boolean;
  isOnboardingDirector: boolean;
  isOnboarding: boolean;
  isHomePm: boolean;
  roleCodes: string[];
};

/**
 * Permissions (Part 1): Add task for Admin and the Director of Onboarding on every home, the
 * Project Manager on their own homes, Designer and Utilities only for their own work (themselves
 * or their role). Operations roles never.
 */
export function canAddOneOff(v: AddViewer, whose: Whose): boolean {
  if (!v.userId) return false;
  if (v.isAdmin || v.isOnboardingDirector) return true;
  if (!v.isOnboarding) return false;
  if (v.isHomePm) return true;
  if (v.roleCodes.length === 0) return false;
  if (whose.kind === "you") return true;
  if (whose.kind === "person") return whose.personId === v.userId;
  if (whose.kind === "role") return v.roleCodes.includes(whose.role);
  return false;
}

/** May this person add Tasks on this home at all (shows "+ Add task to this stage"). */
export function mayAddAny(v: AddViewer): boolean {
  return canAddOneOff(v, { kind: "you" });
}

/** The stored columns for a one-off Task: kind Do it; Homeowner makes it a Send to the homeowner Task. */
export function oneOffColumns(whose: Whose, viewerId: string): { assigned_to: string | null; assigned_seat: string | null; task_kind: string } {
  if (whose.kind === "you") return { assigned_to: viewerId, assigned_seat: null, task_kind: "do_it" };
  if (whose.kind === "person") return { assigned_to: whose.personId, assigned_seat: null, task_kind: "do_it" };
  if (whose.kind === "role") return { assigned_to: null, assigned_seat: whose.role, task_kind: "do_it" };
  return { assigned_to: null, assigned_seat: null, task_kind: "send_to_owner" };
}

/**
 * The stored stage key for a new Task in one of the six stages: the key this home's own Tasks
 * use there (older plans keep their own stage names), else the Standard plan's name.
 */
export function stageKeyFor(index: number, tasks: Pick<PageTask, "stage">[] = []): string {
  const counts = new Map<string, number>();
  for (const t of tasks) if (stageIndexOf(t.stage) === index) counts.set(t.stage, (counts.get(t.stage) ?? 0) + 1);
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : SIX_STAGES[index]!;
}
