/**
 * Team B view of the Team Queue (change 2 of 5, Emily, Nov 25). Pure and browser safe:
 * tabs, due filters, source label, scope, onboarding hiding and the reported issue roll up.
 * Reads existing ticket fields only; clocks, routing and filters elsewhere stay as they are.
 */

export const TEAM_B_TABS = ["maintenance", "reported", "cleaning", "inspection", "lawn"] as const;
export type TeamBTab = (typeof TEAM_B_TABS)[number];
export const TEAM_B_TAB_LABELS: Record<TeamBTab, string> = {
  maintenance: "Maintenance",
  reported: "Reported issues",
  cleaning: "Cleaning reviews",
  inspection: "Inspection reviews",
  lawn: "Lawn care reviews",
};

export const TEAM_B_DUE = ["today", "week", "next", "closed"] as const;
export type TeamBDue = (typeof TEAM_B_DUE)[number];
export const TEAM_B_DUE_LABELS: Record<TeamBDue, string> = {
  today: "Due today",
  week: "This week",
  next: "Next week",
  closed: "Closed",
};

export function parseTeamBTab(v: unknown): TeamBTab {
  return (TEAM_B_TABS as readonly unknown[]).includes(v) ? (v as TeamBTab) : "maintenance";
}
export function parseTeamBDue(v: unknown): TeamBDue {
  return (TEAM_B_DUE as readonly unknown[]).includes(v) ? (v as TeamBDue) : "today";
}

export type TeamBTicket = {
  id: string;
  status: string;
  priority?: string | null;
  property_id?: string | null;
  external_source?: string | null;
  source_channel?: string | null;
  category?: string | null;
  maintenance_category?: string | null;
  title?: string | null;
  due_on?: string | null;
  next_action_due_at?: string | null;
  action_due_at?: string | null;
  response_due_at?: string | null;
  work_types?: { name?: string | null } | null;
  properties?: { lifecycle_status?: string | null } | null;
  from_handoff?: boolean;
};

const DONE = ["closed", "resolved"];
export const isDone = (t: { status: string }) => DONE.includes(t.status);

export function isBridgeReportedIssue(t: TeamBTicket): boolean {
  return (t.external_source ?? "").toLowerCase() === "breezeway";
}
export function isEmailTicket(t: TeamBTicket): boolean {
  return (t.external_source ?? "").toLowerCase() === "email" || (t.source_channel ?? "").toLowerCase() === "email";
}

export function teamBTab(t: TeamBTicket): TeamBTab {
  if (isBridgeReportedIssue(t)) return "reported";
  const type = (t.work_types?.name ?? "").toLowerCase();
  if (/cleaning review|departure review/.test(type)) return "cleaning";
  if (/inspection/.test(type)) return "inspection";
  if (/lawn/.test(`${type} ${t.maintenance_category ?? ""} ${t.category ?? ""}`.toLowerCase())) return "lawn";
  return "maintenance";
}

export function sourceLabel(t: TeamBTicket): string {
  if (isBridgeReportedIssue(t)) return "Breezeway reported issue";
  if (isEmailTicket(t)) return "Email";
  const ch = (t.source_channel ?? "").toLowerCase();
  if (ch === "breezeway" || ch === "inspection") return "Breezeway";
  return "Manual";
}

/** Bridge and email tickets with no owner show in Team B; everything else follows the owner's team. */
export function inTeamBScope(t: TeamBTicket, ownerTeam: string | null, ownerId: string | null, teamB: string): boolean {
  if (ownerId) return ownerTeam === teamB;
  return isBridgeReportedIssue(t) || isEmailTicket(t) || (t.source_channel ?? "") === "inspection";
}

/** Homes still in Onboarding never show in Operations queues; handoff carry-over work stays. */
export function hiddenOnboarding(t: TeamBTicket): boolean {
  return (t.properties?.lifecycle_status ?? "") === "onboarding" && !t.from_handoff;
}

/** Central calendar date (YYYY-MM-DD) of an instant. */
export function centralDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function dueDateOf(t: TeamBTicket): string | null {
  if (t.due_on) return t.due_on.slice(0, 10);
  const at = t.next_action_due_at ?? t.action_due_at ?? t.response_due_at;
  return at ? centralDate(new Date(at)) : null;
}

function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Today, this week (today through Sunday), next week (Monday through Sunday), all Central. */
export function dueWindows(now: Date) {
  const today = centralDate(now);
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 Sunday
  const sunday = addDays(today, (7 - dow) % 7);
  return { today, sunday, nextMonday: addDays(sunday, 1), nextSunday: addDays(sunday, 7) };
}

/** Due today includes work already late. Open work with no due date shows under Due today. */
export function inDueFilter(t: TeamBTicket, f: TeamBDue, now: Date): boolean {
  if (f === "closed") return isDone(t);
  if (isDone(t)) return false;
  const w = dueWindows(now);
  const due = dueDateOf(t);
  if (f === "today") return !due || due <= w.today;
  if (!due) return false;
  if (f === "week") return due <= w.sunday;
  return due >= w.nextMonday && due <= w.nextSunday;
}

const RANK: Record<string, number> = { p1: 0, p2: 1, p3: 2 };

/** One row per property with more than one open reported issue; the most urgent leads. */
export function rollUpReported<T extends TeamBTicket>(rows: T[]): Array<T & { rollup?: T[] }> {
  const open = new Map<string, T[]>();
  for (const r of rows) {
    if (isDone(r) || !r.property_id) continue;
    open.set(r.property_id, [...(open.get(r.property_id) ?? []), r]);
  }
  const out: Array<T & { rollup?: T[] }> = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const group = r.property_id ? open.get(r.property_id) : undefined;
    if (!group || group.length < 2 || isDone(r)) { out.push(r); continue; }
    if (seen.has(r.property_id!)) continue;
    seen.add(r.property_id!);
    const lead = [...group].sort((a, b) =>
      (RANK[a.priority ?? "p3"] ?? 2) - (RANK[b.priority ?? "p3"] ?? 2) ||
      (dueDateOf(a) ?? "9999").localeCompare(dueDateOf(b) ?? "9999"))[0]!;
    out.push({ ...lead, title: `${group.length} reported issues`, rollup: group });
  }
  return out;
}
