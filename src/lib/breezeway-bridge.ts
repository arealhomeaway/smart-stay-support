/**
 * Breezeway bridge rules (browser safe, pure). Register T15, C4, C5, C6 (Emily, Nov 10).
 *
 * The database trigger `private.breezeway_bridge_apply` is the one place tickets and reviews are
 * created; these functions repeat its rules for the screens and the tests, and pull the task
 * fields the webhook already fetches into the mirror row. Nothing here calls Breezeway.
 */

/** Raw Breezeway task fields the bridge reads (GET /task/{id} and the task list). */
export type BridgeRawTask = {
  id: number;
  name?: string | null;
  home_id?: number | null;
  type_department?: string | null;
  type_priority?: string | null;
  type_task_status?: { code?: string | null; name?: string | null; stage?: string | null } | null;
  created_at?: string | null;
  finished_at?: string | null;
  created_by?: { id?: number | string | null; name?: string | null } | null;
  requested_by?: string | null;
  reported_issue?: boolean | null;
  report_url?: string | null;
  tags?: unknown;
  task_tags?: unknown;
};

/**
 * Breezeway writes times without an offset (for example 2026-11-10T14:15:20) that match its own
 * UTC `updated_at`. Read them as UTC so a server in any time zone stores the same instant.
 */
export function breezewayUtc(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string" || !value.trim()) return null;
  const v = value.trim();
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(v);
  const t = Date.parse(hasZone || !/T\d{2}:\d{2}/.test(v) ? v : `${v}Z`);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** Status name the mirror stores for a task (same rule the mirror already used). */
export function taskStatusName(raw: BridgeRawTask): string | null {
  return raw.type_task_status?.name ?? raw.type_task_status?.code ?? null;
}

function stageIsFinished(raw: BridgeRawTask): boolean {
  const stage = (raw.type_task_status?.stage ?? "").toLowerCase();
  const name = (taskStatusName(raw) ?? "").toLowerCase();
  return stage === "finished" || ["finished", "approved", "closed"].includes(name);
}

/** Every tag name on a task: `tags` (strings) and `task_tags` ({ id, name }). */
export function taskTagNames(raw: BridgeRawTask): string[] {
  const out = new Set<string>();
  if (Array.isArray(raw.tags)) {
    for (const t of raw.tags) if (typeof t === "string" && t.trim()) out.add(t.trim());
  }
  if (Array.isArray(raw.task_tags)) {
    for (const t of raw.task_tags as { name?: unknown }[]) {
      if (t && typeof t.name === "string" && t.name.trim()) out.add(t.name.trim());
    }
  }
  return [...out];
}

export type CreatorKind = "guest" | "person" | "unknown";

/**
 * Who or what created the task, from what Breezeway returns: `requested_by: "guest"` is a guest
 * request; a `created_by` person is a person (Breezeway does not say whether a cleaner or office
 * staff); otherwise unknown.
 */
export function creatorKind(raw: BridgeRawTask): CreatorKind {
  if ((raw.requested_by ?? "").toLowerCase() === "guest") return "guest";
  if (raw.created_by && (raw.created_by.id != null || raw.created_by.name)) return "person";
  return "unknown";
}

/**
 * The new mirror fields for one task. Finish time: the time Breezeway says it finished, else the
 * time Resolve first saw it finished (kept once set), else empty.
 */
export function bridgeMirrorFields(
  raw: BridgeRawTask,
  priorFinishedAt: string | null,
  nowIso: string,
) {
  const finishedFromApi = breezewayUtc(raw.finished_at ?? null);
  const finished_at = stageIsFinished(raw)
    ? (finishedFromApi ?? priorFinishedAt ?? nowIso)
    : (finishedFromApi ?? priorFinishedAt ?? null);
  return {
    tags: taskTagNames(raw),
    created_by_id: raw.created_by?.id != null ? String(raw.created_by.id) : null,
    created_by_name: raw.created_by?.name ?? null,
    requested_by: typeof raw.requested_by === "string" ? raw.requested_by : null,
    reported_issue: typeof raw.reported_issue === "boolean" ? raw.reported_issue : null,
    report_url: typeof raw.report_url === "string" && raw.report_url.trim() ? raw.report_url.trim() : null,
    finished_at,
  };
}

/** A finished maintenance work order (lawn care is a maintenance department task). */
export function isFinishedMaintenance(row: { department: string | null; status: string | null }): boolean {
  return (row.department ?? "").toLowerCase() === "maintenance" && (row.status ?? "").toLowerCase() === "finished";
}

export const BRIDGE_REASONS = {
  off: "the bridge is off",
  before: "before the bridge started",
  notVerified: "not a verified Resolve home",
  newHouse: "New House home",
  hasTicket: "already has a ticket",
  reviewExists: "a review already exists",
} as const;

/** Same order as `private.breezeway_bridge_skip_reason`. Null means create. */
export function bridgeSkipReason(input: {
  bridgeOn: boolean;
  startLine: string | null;
  at: string | null;
  propertyId: string | null;
  mappingState: string | null;
}): string | null {
  if (!input.bridgeOn) return BRIDGE_REASONS.off;
  const line = input.startLine ? Date.parse(input.startLine) : NaN;
  const at = input.at ? Date.parse(input.at) : NaN;
  if (!Number.isFinite(line) || !Number.isFinite(at) || at < line) return BRIDGE_REASONS.before;
  if (!input.propertyId || input.mappingState !== "verified") return BRIDGE_REASONS.notVerified;
  return null;
}

/** New House: the Breezeway home tag when Breezeway gives it, else the home's name. */
export function isNewHouse(input: {
  homeTags: string[];
  taskTags: string[];
  homeName: string | null;
  homeNickname: string | null;
}): boolean {
  const hit = (s: string | null | undefined) => (s ?? "").toLowerCase().includes("new house");
  return (
    input.homeTags.some(hit) || input.taskTags.some(hit) || hit(input.homeName) || hit(input.homeNickname)
  );
}

/** Ticket priority from the Breezeway priority: urgent Right now, high Today, else Routine. */
export function reportedIssuePriority(p: string | null | undefined): "p1" | "p2" | "p3" {
  const v = (p ?? "").toLowerCase();
  if (v === "urgent") return "p1";
  if (v === "high") return "p2";
  return "p3";
}

export const REVIEW_DUE_HOURS = 24;

export function reviewDueAt(finishedAt: string): string {
  return new Date(Date.parse(finishedAt) + REVIEW_DUE_HOURS * 3_600_000).toISOString();
}

/** The Breezeway link for a task: the report link Breezeway gives, else the task page. */
export function breezewayTaskLink(taskId: number | string, reportUrl: string | null | undefined): string {
  return reportUrl && reportUrl.trim() ? reportUrl.trim() : `https://app.breezeway.io/task/${taskId}`;
}

/**
 * Tasks the safety sweep mirrors even when they are no longer current, so the bridge sees them:
 * a reported issue created after the start line, or maintenance finished after it.
 */
export function sweepBridgeCandidate(raw: BridgeRawTask, startLine: string | null): boolean {
  const line = startLine ? Date.parse(startLine) : NaN;
  if (!Number.isFinite(line)) return false;
  const created = Date.parse(breezewayUtc(raw.created_at ?? null) ?? "");
  if (raw.reported_issue === true && Number.isFinite(created) && created >= line) return true;
  const finished = Date.parse(breezewayUtc(raw.finished_at ?? null) ?? "");
  return (
    isFinishedMaintenance({ department: raw.type_department ?? null, status: taskStatusName(raw) }) &&
    Number.isFinite(finished) &&
    finished >= line
  );
}

/** Words on the Integrations bridge panel and the Repair card. */
export const BRIDGE_COPY = {
  off: "The Breezeway bridge is off.",
  on: "The Breezeway bridge is on.",
  turnOn: "Turn on",
  turnOff: "Turn off",
  noStartLine: "No start line yet",
  internalOff: "Work orders are made in Breezeway for now. Link the Breezeway work order on the ticket.",
  outboundOff: "Nothing is sent to Breezeway from Resolve for now. Make the task in Breezeway.",
  linkTitle: "Link the Breezeway work order",
  linkHelp: "Make the work order in Breezeway, then pick it here or paste its number.",
  pasteLabel: "Breezeway work order number",
  noHomeOrders: "No Breezeway work orders for this home yet.",
  notThisHome: "That Breezeway work order is for a different home.",
  notFound: "We could not find that Breezeway work order.",
  invoices: "Vendor invoices",
  invoicesHelp: "Add each vendor invoice to this ticket.",
} as const;
