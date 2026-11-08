/**
 * Notion import runner: the saved run state and every rule about starting,
 * stopping, resuming, counting and retrying. Pure and browser-safe so the page,
 * the server and the tests read the same rules.
 *
 * The state is saved after every batch (app_settings key below), so a stop or
 * a crash loses nothing: Resume picks up at the saved cursor. Redoing a batch is
 * safe because every write is keyed on the Notion page ID.
 */
import { ASSIGNEE_REASON_LABELS, IMPORT_GROUPS, type AssigneeReason, type ImportGroup, type MapOutcome, type TeamGroup } from "./mapping";

export const RUNNER_SETTINGS_KEY = "notion_import_runner";
/** A running job with no batch for this long is treated as stopped unexpectedly. */
export const STALE_AFTER_MS = 3 * 60_000;
/** A batch in flight blocks a second one for this long. */
export const BATCH_LEASE_MS = 2 * 60_000;
export const DRY_RUN_PAGE_SIZE = 100;
export const RUN_PAGE_SIZE = 3;
export const MAX_LISTED_FAILURES = 300;
export const MAX_FILE_BYTES = 60 * 1024 * 1024;
export const FILE_ATTEMPTS = 3;

export type JobKind = "dry_run" | "run";
export type JobStatus = "running" | "stopping" | "stopped" | "done" | "failed";
export type Counts = { done: number; skipped: number; failed: number };
export const zeroCounts = (): Counts => ({ done: 0, skipped: 0, failed: 0 });

export type DryRunSummary = {
  finishedAt: string | null;
  total: number;
  groups: Record<ImportGroup, number>;
  priority: Record<"p1" | "p2" | "p3", number>;
  assignee: Partial<Record<AssigneeReason, number>>;
  missingLogins: Record<string, number>;
  teams: Record<TeamGroup, number>;
  claims: number;
  claimReview: number;
  needsHome: number;
  formerHome: number;
  multipleHomes: number;
  blankCreatedDate: number;
};

export type Failure = { pageId: string; group: ImportGroup | null; title: string; error: string; at: string };
export type FailedFile = { pageId: string; ticketId: string; key: string; name: string; error: string; at: string };

export type Job = {
  runId: string;
  kind: JobKind;
  group: ImportGroup | null;
  status: JobStatus;
  cursor: string | null;
  /** Start of the 30 day window, fixed when the job starts. */
  cutoff: string;
  startedAt: string;
  updatedAt: string;
  batchUntil: string | null;
  batches: number;
};

export type RunnerState = {
  version: 1;
  job: Job | null;
  /** Per group, for the most recent run of that group. */
  progress: Record<ImportGroup, Counts & { comments: number; files: number; bytes: number }>;
  dryRun: DryRunSummary | null;
  failures: Failure[];
  failedFiles: FailedFile[];
  lastError: string | null;
};

const emptyProgress = () => ({ ...zeroCounts(), comments: 0, files: 0, bytes: 0 });

export function emptyDryRun(): DryRunSummary {
  return {
    finishedAt: null,
    total: 0,
    groups: { recent_open: 0, older_open: 0, closed: 0 },
    priority: { p1: 0, p2: 0, p3: 0 },
    assignee: {},
    missingLogins: {},
    teams: { team_a: 0, team_b: 0, unassigned: 0 },
    claims: 0,
    claimReview: 0,
    needsHome: 0,
    formerHome: 0,
    multipleHomes: 0,
    blankCreatedDate: 0,
  };
}

export function emptyState(): RunnerState {
  return {
    version: 1,
    job: null,
    progress: { recent_open: emptyProgress(), older_open: emptyProgress(), closed: emptyProgress() },
    dryRun: null,
    failures: [],
    failedFiles: [],
    lastError: null,
  };
}

/** Reads a saved state, filling anything missing. Never throws. */
export function parseState(raw: unknown): RunnerState {
  const base = emptyState();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<RunnerState>;
  return {
    ...base,
    ...r,
    version: 1,
    progress: { ...base.progress, ...(r.progress ?? {}) },
    failures: Array.isArray(r.failures) ? r.failures : [],
    failedFiles: Array.isArray(r.failedFiles) ? r.failedFiles : [],
    job: r.job ?? null,
    dryRun: r.dryRun ?? null,
    lastError: r.lastError ?? null,
  };
}

/** What the page shows. A running job whose batches stopped arriving is "stopped unexpectedly". */
export function effectiveStatus(state: RunnerState, now: number): JobStatus | "idle" | "crashed" {
  const j = state.job;
  if (!j) return "idle";
  if ((j.status === "running" || j.status === "stopping") && now - Date.parse(j.updatedAt) > STALE_AFTER_MS) return "crashed";
  return j.status;
}

export class RunnerRuleError extends Error {}

/** Start a new dry run or run. A fresh run of a group resets that group's counts. */
export function startJob(
  state: RunnerState,
  input: { kind: JobKind; group: ImportGroup | null; runId: string; now: number },
): RunnerState {
  const s = effectiveStatus(state, input.now);
  if (s === "running" || s === "stopping") throw new RunnerRuleError("A run is already going. Stop it first.");
  if (input.kind === "run" && !input.group) throw new RunnerRuleError("Choose which tickets to run.");
  const iso = new Date(input.now).toISOString();
  const job: Job = {
    runId: input.runId,
    kind: input.kind,
    group: input.kind === "run" ? input.group : null,
    status: "running",
    cursor: null,
    cutoff: new Date(input.now - 30 * 86_400_000).toISOString(),
    startedAt: iso,
    updatedAt: iso,
    batchUntil: null,
    batches: 0,
  };
  const next: RunnerState = { ...state, job, lastError: null };
  if (input.kind === "dry_run") next.dryRun = emptyDryRun();
  else {
    next.progress = { ...state.progress, [input.group!]: emptyProgress() };
    next.failures = state.failures.filter((f) => f.group !== input.group);
  }
  return next;
}

/** Stop: the batch in flight finishes, then the job is saved as stopped. */
export function requestStop(state: RunnerState, now: number): RunnerState {
  const j = state.job;
  if (!j) throw new RunnerRuleError("Nothing is running.");
  const s = effectiveStatus(state, now);
  if (s === "crashed") return { ...state, job: { ...j, status: "stopped", batchUntil: null, updatedAt: new Date(now).toISOString() } };
  if (j.status !== "running") throw new RunnerRuleError("Nothing is running.");
  return { ...state, job: { ...j, status: "stopping", updatedAt: new Date(now).toISOString() } };
}

/** Resume a stopped, failed or crashed job from its saved cursor. */
export function resumeJob(state: RunnerState, now: number): RunnerState {
  const j = state.job;
  const s = effectiveStatus(state, now);
  if (!j || !(s === "stopped" || s === "failed" || s === "crashed")) throw new RunnerRuleError("There is nothing to resume.");
  return { ...state, lastError: null, job: { ...j, status: "running", batchUntil: null, updatedAt: new Date(now).toISOString() } };
}

/** Claims the next batch for this job, or says why not. */
export function claimBatch(state: RunnerState, runId: string, now: number): RunnerState {
  const j = state.job;
  if (!j || j.runId !== runId) throw new RunnerRuleError("This run was replaced. Refresh the page.");
  if (j.status === "stopping") return { ...state, job: { ...j, status: "stopped", batchUntil: null, updatedAt: new Date(now).toISOString() } };
  if (j.status !== "running") throw new RunnerRuleError("This run is not going.");
  if (j.batchUntil && Date.parse(j.batchUntil) > now) throw new RunnerRuleError("A batch is already in progress.");
  return { ...state, job: { ...j, batchUntil: new Date(now + BATCH_LEASE_MS).toISOString(), updatedAt: new Date(now).toISOString() } };
}

export type BatchResult = {
  counts: Counts;
  comments: number;
  files: number;
  bytes: number;
  failures: Failure[];
  failedFiles: FailedFile[];
  /** Page keys whose files all copied this time; their old file failures are cleared. */
  filesCleared: string[];
  dryRun?: DryRunSummary;
};

export function emptyBatch(): BatchResult {
  return { counts: zeroCounts(), comments: 0, files: 0, bytes: 0, failures: [], failedFiles: [], filesCleared: [] };
}

/**
 * Saves a finished batch. A stop pressed during the batch takes effect here;
 * otherwise the job keeps running until Notion has no more pages.
 */
export function finishBatch(state: RunnerState, runId: string, result: BatchResult, nextCursor: string | null, now: number): RunnerState {
  const j = state.job;
  if (!j || j.runId !== runId) return state;
  const iso = new Date(now).toISOString();
  const status: JobStatus = !nextCursor ? "done" : j.status === "stopping" ? "stopped" : "running";
  const next: RunnerState = {
    ...state,
    job: { ...j, cursor: nextCursor, status, batchUntil: null, updatedAt: iso, batches: j.batches + 1 },
    failures: [...state.failures, ...result.failures].slice(-MAX_LISTED_FAILURES),
    failedFiles: [
      ...state.failedFiles.filter((f) => !result.filesCleared.includes(f.pageId) && !result.failedFiles.some((g) => g.key === f.key)),
      ...result.failedFiles,
    ].slice(-MAX_LISTED_FAILURES),
  };
  if (j.kind === "dry_run" && result.dryRun) {
    next.dryRun = { ...mergeDryRun(state.dryRun ?? emptyDryRun(), result.dryRun), finishedAt: status === "done" ? iso : null };
  }
  if (j.kind === "run" && j.group) {
    const p = state.progress[j.group];
    next.progress = {
      ...state.progress,
      [j.group]: {
        done: p.done + result.counts.done,
        skipped: p.skipped + result.counts.skipped,
        failed: p.failed + result.counts.failed,
        comments: p.comments + result.comments,
        files: p.files + result.files,
        bytes: p.bytes + result.bytes,
      },
    };
  }
  return next;
}

/** A batch that threw: the job is saved as failed at the same cursor, so Resume redoes that batch. */
export function failBatch(state: RunnerState, runId: string, error: string, now: number): RunnerState {
  const j = state.job;
  if (!j || j.runId !== runId) return state;
  return { ...state, lastError: error, job: { ...j, status: "failed", batchUntil: null, updatedAt: new Date(now).toISOString() } };
}

/** Tickets left in a group: the dry run count minus those done or skipped. Null before a dry run. */
export function leftInGroup(state: RunnerState, group: ImportGroup): number | null {
  if (!state.dryRun?.finishedAt) return null;
  const p = state.progress[group];
  return Math.max(0, state.dryRun.groups[group] - p.done - p.skipped);
}

// ---------- dry run counting ----------

export function countOutcome(sum: DryRunSummary, out: MapOutcome): DryRunSummary {
  const s: DryRunSummary = JSON.parse(JSON.stringify(sum));
  s.total++;
  s.groups[out.group]++;
  s.priority[out.ticket.priority]++;
  s.assignee[out.assigneeReason] = (s.assignee[out.assigneeReason] ?? 0) + 1;
  if (out.missingLogin) s.missingLogins[out.missingLogin] = (s.missingLogins[out.missingLogin] ?? 0) + 1;
  if (out.teamGroup) s.teams[out.teamGroup]++;
  if (out.ticket.claim) s.claims++;
  if (out.ticket.waiting_reason === "claim review") s.claimReview++;
  if (!out.ticket.property_id) s.needsHome++;
  if (out.formerProperty) s.formerHome++;
  if (out.multipleHomes) s.multipleHomes++;
  if (out.blankCreatedDate) s.blankCreatedDate++;
  return s;
}

export function mergeDryRun(a: DryRunSummary, b: DryRunSummary): DryRunSummary {
  const addMap = <K extends string>(x: Partial<Record<K, number>>, y: Partial<Record<K, number>>) => {
    const out: Partial<Record<K, number>> = { ...x };
    for (const [k, v] of Object.entries(y) as [K, number][]) out[k] = (out[k] ?? 0) + v;
    return out;
  };
  return {
    finishedAt: b.finishedAt ?? a.finishedAt,
    total: a.total + b.total,
    groups: addMap(a.groups, b.groups) as DryRunSummary["groups"],
    priority: addMap(a.priority, b.priority) as DryRunSummary["priority"],
    assignee: addMap(a.assignee, b.assignee),
    missingLogins: addMap(a.missingLogins, b.missingLogins) as Record<string, number>,
    teams: addMap(a.teams, b.teams) as DryRunSummary["teams"],
    claims: a.claims + b.claims,
    claimReview: a.claimReview + b.claimReview,
    needsHome: a.needsHome + b.needsHome,
    formerHome: a.formerHome + b.formerHome,
    multipleHomes: a.multipleHomes + b.multipleHomes,
    blankCreatedDate: a.blankCreatedDate + b.blankCreatedDate,
  };
}

export function assigneeRows(sum: DryRunSummary): { label: string; n: number }[] {
  return (Object.keys(ASSIGNEE_REASON_LABELS) as AssigneeReason[])
    .filter((k) => (sum.assignee[k] ?? 0) > 0)
    .map((k) => ({ label: ASSIGNEE_REASON_LABELS[k], n: sum.assignee[k] ?? 0 }));
}

// ---------- duplicate guard and reopen protection ----------

export type ExistingImport = { id: string; external_status: string | null; external_synced_at: string | null } | null;
export type WritePlan = "create" | "update" | "unchanged" | "keep_live";

/**
 * One ticket per Notion page ID. A ticket someone reopened or took in Resolve is
 * never written again (its claim is left alone too); only missing Notion
 * comments and files are added to its history.
 */
export function planTicketWrite(existing: ExistingImport, mapped: { external_synced_at: string }): WritePlan {
  if (!existing) return "create";
  if (existing.external_status === "reopened_in_resolve") return "keep_live";
  const same =
    existing.external_synced_at != null && Date.parse(existing.external_synced_at) === Date.parse(mapped.external_synced_at);
  return same ? "unchanged" : "update";
}

// ---------- Notion rate limit ----------

/**
 * Wait before retry number `attempt` (0 based). Notion's Retry-After wins when
 * given; otherwise 1 s, 2 s, 4 s ... capped at 30 s, plus up to 0.5 s of jitter.
 */
export function retryDelayMs(attempt: number, retryAfter: string | null, rand: number = Math.random()): number {
  const ra = Number(retryAfter);
  const base = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1000 * 2 ** attempt;
  return Math.min(base, 30_000) + Math.floor(rand * 500);
}
export const NOTION_ATTEMPTS = 6;
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 408 || status >= 500;
}

/** Which group a run button imports, and the button wording. */
export const RUN_BUTTONS: { group: ImportGroup; label: string }[] = [
  { group: "recent_open", label: "Run: tickets from the past 30 days that are open" },
  { group: "older_open", label: "Run: older open tickets" },
  { group: "closed", label: "Run: closed history" },
];
export const ALL_GROUPS = IMPORT_GROUPS;

/** Plain words for a Notion read problem, with what to do. */
export function explainNotionProblem(status: number | null, body: string): { reason: string; fix: string } {
  const b = body.toLowerCase();
  if (status === null && /not linked|notion_api_key/.test(b))
    return { reason: "The Notion connection is not linked to this app.", fix: "Link the Notion connection to this project, then check again." };
  if (status === 404 || b.includes("object_not_found") || b.includes("could not find"))
    return {
      reason: "The ticket database is not shared with the Notion connection.",
      fix: "In Notion, open Maintenance Ticket Management, choose Connections, add the connection, then check again.",
    };
  if (status === 401 || b.includes("unauthorized"))
    return { reason: "Notion did not accept the connection.", fix: "Reconnect Notion in the workspace connector settings, then check again." };
  if (status === 403 || b.includes("restricted_resource"))
    return { reason: "The connection is not allowed to read this database.", fix: "Give the connection read access to the database in Notion, then check again." };
  if (status === 429) return { reason: "Notion is busy and asked us to slow down.", fix: "Wait a minute and check again." };
  return { reason: "Notion could not be reached.", fix: "Wait a minute and check again. If it keeps failing, reconnect Notion." };
}
