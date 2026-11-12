/**
 * Onboarding Home and one home's onboarding page (register O1, O3; Emily, Nov 10).
 *
 * Pure rules only, so every view shows the same homes, stages and labels and
 * each rule can be tested without a database: the six stages and how each plan
 * maps onto them, the Notion Onboarding Project Database options, the PMA
 * steps, due and handoff labels, health, the Gantt scale and the design folders.
 */

/* ------------------------------------------------------------ six stages */

export const SIX_STAGES = [
  "Intake",
  "Pre-Close",
  "Ordering & Repairs",
  "Setup & Staging",
  "Preparing for Handoff",
  "Handoff",
] as const;
export type SixStage = (typeof SIX_STAGES)[number];

/**
 * Where each plan's stage sits among the six. The Standard plan (versions 3 and 4)
 * uses the six names exactly. Older plans still on some homes map by their stage:
 * this is the default reported to Emily for confirmation.
 */
export const STAGE_MAP: Record<string, SixStage> = {
  // Standard plan, versions 3 and 4: one to one.
  Intake: "Intake",
  "Pre-Close": "Pre-Close",
  "Ordering & Repairs": "Ordering & Repairs",
  "Setup & Staging": "Setup & Staging",
  "Preparing for Handoff": "Preparing for Handoff",
  Handoff: "Handoff",
  // V2 plan.
  "Access & Setup": "Ordering & Repairs",
  "Furnishing & Prep": "Setup & Staging",
  "Readiness & Handoff": "Preparing for Handoff",
  // Full plan (eight stage sequence).
  intake_identity: "Intake",
  documents_assessment: "Pre-Close",
  scope_utilities_compliance: "Pre-Close",
  design_approvals_procurement: "Ordering & Repairs",
  fieldwork_setup_review: "Setup & Staging",
  listing_final_clean: "Preparing for Handoff",
  handoff_acceptance: "Handoff",
  closeout_stabilization: "Handoff",
  // Oldest phase headings.
  post_contract: "Intake",
  phase1_inspection: "Pre-Close",
  phase2_estimates: "Ordering & Repairs",
  phase3_work_orders: "Ordering & Repairs",
  phase4_purchasing: "Ordering & Repairs",
  phase5_monitor: "Setup & Staging",
  phase6_handoff: "Preparing for Handoff",
};

export function sixStageFor(stage: string | null | undefined): SixStage | null {
  return stage ? (STAGE_MAP[stage] ?? null) : null;
}

export type BoardTask = {
  id: string;
  property_id: string;
  stage: string;
  title: string;
  status: string;
  due_on: string | null;
  assigned_to: string | null;
  completed_at?: string | null;
  parent_task_id?: string | null;
  sort_order?: number | null;
};

const FINISHED = new Set(["complete", "carryover"]);
export const isFinished = (t: Pick<BoardTask, "status">) => FINISHED.has(t.status);

export type StageStep = {
  stage: SixStage;
  index: number;
  total: number;
  done: number;
  /** Done, 13 of 19 done, or Not started. */
  note: string;
  percent: number;
  state: "done" | "current" | "upcoming";
};

export type Stepper = {
  steps: StageStep[];
  /** 1 to 6. */
  current: number;
  currentStage: SixStage;
  done: number;
  total: number;
  /** Stage 4 of 6 · 118 of 149 tasks done */
  progressLine: string;
  /** Tasks whose stage is not on the map (reported, never guessed). */
  unmapped: number;
};

export function stepperFor(tasks: BoardTask[]): Stepper {
  const counts = SIX_STAGES.map(() => ({ total: 0, done: 0 }));
  let unmapped = 0;
  for (const t of tasks) {
    const s = sixStageFor(t.stage);
    if (!s) {
      unmapped += 1;
      continue;
    }
    const c = counts[SIX_STAGES.indexOf(s)]!;
    c.total += 1;
    if (isFinished(t)) c.done += 1;
  }
  const firstOpen = counts.findIndex((c) => c.total > c.done);
  const currentIndex = firstOpen === -1 ? SIX_STAGES.length - 1 : firstOpen;
  const steps = SIX_STAGES.map((stage, i): StageStep => {
    const c = counts[i]!;
    const state = i < currentIndex || (firstOpen === -1 && c.total > 0 && c.done === c.total)
      ? "done"
      : i === currentIndex
        ? "current"
        : "upcoming";
    const note =
      c.total > 0 && c.done === c.total
        ? "Done"
        : c.total === 0
          ? i < currentIndex
            ? "Done"
            : "Not started"
          : c.done === 0
            ? "Not started"
            : `${c.done} of ${c.total} done`;
    return {
      stage,
      index: i,
      total: c.total,
      done: c.done,
      note,
      percent: c.total ? Math.round((c.done / c.total) * 100) : i < currentIndex ? 100 : 0,
      state,
    };
  });
  const total = counts.reduce((n, c) => n + c.total, 0);
  const done = counts.reduce((n, c) => n + c.done, 0);
  return {
    steps,
    current: currentIndex + 1,
    currentStage: SIX_STAGES[currentIndex]!,
    done,
    total,
    progressLine: `Stage ${currentIndex + 1} of ${SIX_STAGES.length} · ${done} of ${total} tasks done`,
    unmapped,
  };
}

/* ------------------------------------------------ Notion database fields */

/** Status options read Nov 10 from the Notion Onboarding Project Database. */
export const NOTION_STATUSES = [
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
] as const;

export const OWNER_TYPES = ["Standard DFY", "Active Owner", "Acquisition", "Local/Direct"] as const;

export const PMA_STATUSES = [
  "Not started",
  "Utilities LOA + Exhibit D Sent",
  "Utilities LOA + Exhibit D Signed",
  "HOA & Amenity Information Sent",
  "HOA & Amenity Information Signed",
  "PMA In Progress",
  "PMA Received",
] as const;

export const INVOICE_STATUSES = [
  "Not Started",
  "Estimate Created",
  "Estimate Sent",
  "Estimate Approved",
  "First Invoice Requested",
  "First Invoice Sent",
  "First Invoice Paid",
  "Second Furnishing Invoice Sent",
  "Second Furnishing Invoice Paid",
  "Repair Invoice Reviewed & Sent",
  "All Invoices Paid",
] as const;

export const NOT_SET = "Not set";

export type ProjectDetails = {
  owner_type?: string | null;
  project_status?: string | null;
  pma_status?: string | null;
  invoice_status?: string | null;
  greater_area?: string | null;
  weekly_status?: string | null;
  committed_handoff_on?: string | null;
};

export const DETAIL_FIELDS = [
  "owner_type",
  "project_status",
  "pma_status",
  "invoice_status",
  "greater_area",
  "weekly_status",
  "committed_handoff_on",
] as const;
export type DetailField = (typeof DETAIL_FIELDS)[number];

export const DETAIL_LABELS: Record<DetailField, string> = {
  owner_type: "Owner Type",
  project_status: "Status",
  pma_status: "PMA Status",
  invoice_status: "Invoice Status",
  greater_area: "Greater Area",
  weekly_status: "Weekly status",
  committed_handoff_on: "Committed Handoff Date",
};

/** A stored value, or Not set. Never a guess. */
/**
 * Item 40: the Owner Type and Status line under the home header. A value already shown as a
 * chip, or not set, is left out; with nothing left the line is not shown (null).
 */
export function headerFactsLine(input: { ownerType: string | null | undefined; status: string | null | undefined; chips: string[] }): string | null {
  const onChip = new Set(input.chips.map((c) => c.trim().toLowerCase()).filter(Boolean));
  const parts: string[] = [];
  const add = (label: string, v: string | null | undefined) => {
    const t = (v ?? "").trim();
    if (t && !onChip.has(t.toLowerCase())) parts.push(`${label}: ${t}`);
  };
  add("Owner Type", input.ownerType);
  add("Status", input.status);
  return parts.length ? parts.join(" · ") : null;
}

export function shown(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  return v ? v : NOT_SET;
}

/**
 * The PMA Status steps on the Agreements tab. Each step is done once the status
 * has reached it; the step right after the current one is next.
 */
export const PMA_STEPS = [
  { label: "Utilities LOA + Exhibit D sent", reachedAt: "Utilities LOA + Exhibit D Sent" },
  { label: "Utilities LOA + Exhibit D signed", reachedAt: "Utilities LOA + Exhibit D Signed" },
  { label: "HOA & Amenity Information sent", reachedAt: "HOA & Amenity Information Sent" },
  { label: "HOA & Amenity Information signed", reachedAt: "HOA & Amenity Information Signed" },
  { label: "PMA in progress", reachedAt: "PMA In Progress" },
  { label: "PMA received", reachedAt: "PMA Received" },
] as const;

export function pmaSteps(status: string | null | undefined) {
  const at = status ? PMA_STATUSES.indexOf(status as (typeof PMA_STATUSES)[number]) : -1;
  let nextGiven = false;
  return PMA_STEPS.map((s) => {
    const idx = PMA_STATUSES.indexOf(s.reachedAt);
    if (at >= idx) return { label: s.label, state: "Done" as const };
    if (!nextGiven && at >= 0) {
      nextGiven = true;
      return { label: s.label, state: "Next" as const };
    }
    return { label: s.label, state: "Not started" as const };
  });
}

/* ---------------------------------------------------------------- dates */

/** Today's date in Central time, as YYYY-MM-DD. */
export function centralToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const DAY = 86_400_000;
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / DAY);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Nov 4 */
export function shortDate(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Overdue 1 day, Today, Nov 12, Done Nov 4, No date. */
export function dueLabel(task: Pick<BoardTask, "status" | "due_on" | "completed_at">, today: string): string {
  if (isFinished(task)) return task.completed_at ? `Done ${shortDate(task.completed_at)}` : "Done";
  if (!task.due_on) return "No date";
  const d = daysBetween(today, task.due_on);
  if (d < 0) return `Overdue ${plural(-d, "day")}`;
  if (d === 0) return "Today";
  return shortDate(task.due_on);
}

/** In 6 days, Today, Was yesterday, Was 3 days ago, No date. */
export function handoffLabel(date: string | null | undefined, today: string): string {
  if (!date) return "No date";
  const d = daysBetween(today, date);
  if (d === 0) return "Today";
  if (d > 0) return `In ${plural(d, "day")}`;
  if (d === -1) return "Was yesterday";
  return `Was ${plural(-d, "day")} ago`;
}

/** The date a handoff is expected: the Committed Handoff Date once set, else the estimate. */
export function handoffDate(committed: string | null | undefined, estimate: string | null | undefined) {
  return committed || estimate || null;
}

/* --------------------------------------------------------------- health */

export type HealthLevel = "on_track" | "watch" | "at_risk" | "blocked";
export const HEALTH_LABEL: Record<HealthLevel, string> = {
  on_track: "On track",
  watch: "Watch",
  at_risk: "At risk",
  blocked: "Blocked",
};

/**
 * Health with its reason, from the home's existing risk rule. A handoff date that
 * has passed without acceptance is At risk with that as the reason.
 */
export function healthFor(input: {
  risk: { level: HealthLevel; reasons: string[] };
  handoffOn: string | null;
  accepted: boolean;
  today: string;
}): { level: HealthLevel; label: string; reason: string | null; line: string } {
  let level = input.risk.level;
  const reasons = input.risk.reasons.filter((r) => !/^handoff in -/.test(r));
  let reason = reasons[0] ?? null;
  if (!input.accepted && input.handoffOn && daysBetween(input.today, input.handoffOn) < 0) {
    const late = -daysBetween(input.today, input.handoffOn);
    reason = late === 1 ? "handoff was yesterday" : `handoff was ${late} days ago`;
    if (level === "on_track" || level === "watch") level = "at_risk";
  }
  const label = HEALTH_LABEL[level];
  return { level, label, reason, line: reason ? `${label}: ${reason}` : label };
}

/* ------------------------------------------------------- Today, for me */

export type TodayGroup<T extends BoardTask> = { propertyId: string; tasks: T[] };

/** The person's own open tasks due today or overdue, grouped by home, most overdue first. */
export function todayForMe<T extends BoardTask>(tasks: T[], userId: string | null, today: string) {
  const mine = tasks.filter(
    (t) => userId && t.assigned_to === userId && !isFinished(t) && t.due_on && t.due_on <= today,
  );
  const dueToday = mine.filter((t) => t.due_on === today).length;
  const overdue = mine.length - dueToday;
  const groups = new Map<string, T[]>();
  for (const t of [...mine].sort((a, b) => (a.due_on ?? "").localeCompare(b.due_on ?? ""))) {
    groups.set(t.property_id, [...(groups.get(t.property_id) ?? []), t]);
  }
  return {
    dueToday,
    overdue,
    countLine: `${plural(dueToday, "task")} due today, ${overdue} overdue`,
    groups: [...groups.entries()].map(([propertyId, list]) => ({ propertyId, tasks: list })),
  };
}

/* ---------------------------------------------------------- Plan filter */

export type PlanFilter = "mine" | "everyone" | "overdue";
export function planFilter<T extends BoardTask>(tasks: T[], filter: PlanFilter, userId: string | null, today: string) {
  if (filter === "mine") return tasks.filter((t) => userId && t.assigned_to === userId);
  if (filter === "overdue") return tasks.filter((t) => !isFinished(t) && t.due_on && t.due_on < today);
  return tasks;
}

/* ---------------------------------------------------------------- Gantt */

/** First of each month from the earliest start to the latest end, plus where today falls. */
export function ganttScale(ranges: { start: string | null; end: string | null }[], today: string) {
  const dates = ranges.flatMap((r) => [r.start, r.end]).filter((d): d is string => Boolean(d));
  dates.push(today);
  const min = dates.reduce((a, b) => (a < b ? a : b));
  const max = dates.reduce((a, b) => (a > b ? a : b));
  const start = `${min.slice(0, 7)}-01`;
  const [ey, em] = max.slice(0, 7).split("-").map(Number) as [number, number];
  const end = em === 12 ? `${ey + 1}-01-01` : `${ey}-${String(em + 1).padStart(2, "0")}-01`;
  const span = Math.max(1, daysBetween(start, end));
  const months: { label: string; left: number }[] = [];
  let cur = start;
  while (cur < end) {
    const [y, m] = cur.split("-").map(Number) as [number, number];
    months.push({ label: `${MONTHS[m - 1]} ${String(y).slice(2)}`, left: (daysBetween(start, cur) / span) * 100 });
    cur = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  }
  const at = (iso: string) => Math.min(100, Math.max(0, (daysBetween(start, iso) / span) * 100));
  return { start, end, months, today: at(today), at };
}

/* ------------------------------------------------------------- workload */

export function workload(homes: { projectManager: string | null }[]) {
  const map = new Map<string, number>();
  for (const h of homes) {
    const key = h.projectManager ?? "No Project Manager";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, homes]) => ({ name, homes }))
    .sort((a, b) => b.homes - a.homes || a.name.localeCompare(b.name));
}

/* ------------------------------------------------------- by Notion status */

export function byStatus<T extends { status: string | null | undefined }>(homes: T[]) {
  // Homes without a Status yet come first, so they are never off screen.
  const columns = [NOT_SET, ...NOTION_STATUSES].map((status) => ({
    status,
    homes: homes.filter((h) => (h.status ? h.status === status : status === NOT_SET)),
  }));
  return columns;
}

/* ------------------------------------------------------------- folders */

export const DESIGN_FOLDERS = [
  { value: "design_floor_plan", label: "Floor plans" },
  { value: "design_mood_board", label: "Mood boards" },
  { value: "design_pick_list", label: "Pick lists" },
  { value: "design_install", label: "Install instructions" },
  { value: "design_staging", label: "Staging instructions" },
  { value: "design_photo", label: "Photos" },
] as const;

export type FolderFile = { category: string | null; created_at: string; title?: string | null };

/** Each design folder with its count and its latest added line. */
export function designFolders(files: FolderFile[]) {
  return DESIGN_FOLDERS.map((f) => {
    const mine = files.filter((x) => x.category === f.value).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const latest = mine[0];
    return {
      ...f,
      count: mine.length,
      latest: latest ? `Latest added ${shortDate(latest.created_at)}` : "Nothing added yet",
    };
  });
}

/* ---------------------------------------------------------------- tabs */

export const HOME_TABS = [
  { value: "plan", label: "Plan" },
  { value: "design", label: "Design" },
  { value: "budget", label: "Budget & Invoices" },
  { value: "agreements", label: "Agreements" },
  { value: "info", label: "General Info" },
  { value: "files", label: "Files" },
  { value: "activity", label: "Activity" },
] as const;
export type HomeTab = (typeof HOME_TABS)[number]["value"];

/** Older links keep working: each old tab opens the tab that now holds its content. */
const OLD_TAB: Record<string, HomeTab> = {
  overview: "plan",
  work: "plan",
  tasks: "plan",
  workflow: "plan",
  timeline: "plan",
  calendar: "plan",
  handoff: "plan",
  property: "info",
  "active-owner": "info",
  findings: "info",
  workorders: "info",
  vendors: "info",
  budget: "budget",
  financial: "budget",
  files: "files",
  activity: "activity",
  history: "activity",
};

export function homeTabFor(raw: unknown, hasOpportunity = false): HomeTab {
  if (typeof raw === "string") {
    if (HOME_TABS.some((t) => t.value === raw)) return raw as HomeTab;
    if (OLD_TAB[raw]) return OLD_TAB[raw]!;
  }
  return hasOpportunity ? "info" : "plan";
}

/* --------------------------------------------------------- greeting */

export function firstNameOf(profile: { first_name?: string | null; full_name?: string | null } | null | undefined) {
  const first = (profile?.first_name ?? "").trim();
  if (first) return first;
  return (profile?.full_name ?? "").trim().split(/\s+/)[0] ?? "";
}

export function greetingFor(hour: number) {
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/** The hour of day in Central time. */
export function centralHour(now: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" }).format(now),
  );
}
