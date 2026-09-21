/**
 * Breezeway sync depth — the edge cases, in plain terms (browser-safe, no I/O).
 *
 * Two things go wrong between Breezeway and Resolve, and staff need to see
 * both in one place:
 *
 *   1. An update arrived that Resolve could not place — an unknown home, a
 *      different company, or a lookup that failed. Nothing was written; the
 *      event sits in the log until someone looks.
 *   2. A job drifted — the mirrored Breezeway task and the Resolve ticket it
 *      belongs to no longer agree (finished there, still open here, or the
 *      reverse; a date that moved on one side only).
 *
 * Standing rule from the Constitution: Breezeway is transitional and never
 * silently overrides Resolve. Nothing in this module changes a record. Every
 * disagreement is HELD for a person — recorded with both values side by side
 * so a supervisor chooses. Automatic resolution is deliberately absent.
 */

/** Every outcome the webhook receiver can record, grouped for review. */
export type EventBucket = "unplaced" | "failed" | "ignored" | "processed";

export type EventClass = {
  bucket: EventBucket;
  label: string;
  /** What a coordinator should understand from it. */
  meaning: string;
  /** Whether re-running the lookup could still place this one. */
  retryable: boolean;
};

const EVENT_CLASSES: Record<string, EventClass> = {
  processed: {
    bucket: "processed",
    label: "Applied",
    meaning: "The update was matched to a home and recorded.",
    retryable: false,
  },
  ignored_other_property: {
    bucket: "unplaced",
    label: "Home not in Resolve",
    meaning: "The home this update belongs to is not one Resolve mirrors.",
    retryable: false,
  },
  ignored_other_company: {
    bucket: "unplaced",
    label: "Another company",
    meaning: "The update came from a Breezeway company that is not ours.",
    retryable: false,
  },
  duplicate: {
    bucket: "ignored",
    label: "Already seen",
    meaning: "The same update arrived twice; the second copy was dropped.",
    retryable: false,
  },
  stale: {
    bucket: "ignored",
    label: "Older than what we hold",
    meaning: "A newer version of this job was already recorded.",
    retryable: false,
  },
  invalid: {
    bucket: "failed",
    label: "Unreadable update",
    meaning: "The message did not carry enough to identify a job.",
    retryable: false,
  },
  verify_failed: {
    bucket: "failed",
    label: "Lookup failed",
    meaning: "Breezeway could not be re-read to confirm the job. Nothing was written.",
    retryable: true,
  },
  persist_failed: {
    bucket: "failed",
    label: "Not saved here",
    meaning: "The lookup worked but Resolve could not save the result.",
    retryable: true,
  },
};

export function classifyEvent(outcome: string | null | undefined): EventClass {
  const key = String(outcome ?? "").trim();
  return (
    EVENT_CLASSES[key] ?? {
      bucket: "failed",
      label: "Unrecognized outcome",
      meaning: "Resolve does not know what happened to this update — review it by hand.",
      retryable: false,
    }
  );
}

export function needsReview(outcome: string | null | undefined): boolean {
  const bucket = classifyEvent(outcome).bucket;
  return bucket === "unplaced" || bucket === "failed";
}

/* ------------------------------------------------------------------ drift */

/** A mirrored Breezeway task, reduced to the fields that can drift. */
export type MirrorSide = {
  taskId: number;
  name: string | null;
  status: string | null;
  stage: string | null;
  scheduledDate: string | null;
  propertyId: string | null;
  linkedTicketId: string | null;
  updatedAt: string | null;
};

/** The Resolve ticket the mirrored task belongs to, if any. */
export type ResolveSide = {
  ticketId: string;
  status: string | null;
  scheduledDate: string | null;
} | null;

export type DriftKind =
  | "unlinked"
  | "finished_there_open_here"
  | "closed_here_open_there"
  | "date_differs";

export type DriftItem = {
  taskId: number;
  ticketId: string | null;
  kind: DriftKind;
  field: string;
  fieldLabel: string;
  /** What Resolve holds. */
  resolveValue: string | null;
  /** What Breezeway holds. */
  externalValue: string | null;
  summary: string;
};

const DONE_THERE = new Set(["completed", "complete", "finished", "closed", "done", "verified"]);
const DONE_HERE = new Set(["resolved", "closed", "cancelled", "canceled"]);

function done(value: string | null, set: Set<string>) {
  return set.has(String(value ?? "").trim().toLowerCase());
}

/**
 * Compares one mirrored task with its Resolve ticket. Read-only: returns what
 * disagrees, decides nothing.
 */
export function detectDrift(mirror: MirrorSide, local: ResolveSide): DriftItem[] {
  const out: DriftItem[] = [];
  const name = mirror.name ?? `Breezeway job ${mirror.taskId}`;

  if (!local) {
    // A mirrored job with no Resolve ticket is only worth flagging while it is
    // still live over there — finished history needs no owner here.
    if (!done(mirror.status, DONE_THERE)) {
      out.push({
        taskId: mirror.taskId,
        ticketId: null,
        kind: "unlinked",
        field: "linked_ticket_id",
        fieldLabel: "Resolve ticket",
        resolveValue: null,
        externalValue: name,
        summary: `${name} is running in Breezeway with no ticket in Resolve.`,
      });
    }
    return out;
  }

  const thereDone = done(mirror.status, DONE_THERE);
  const hereDone = done(local.status, DONE_HERE);

  if (thereDone && !hereDone) {
    out.push({
      taskId: mirror.taskId,
      ticketId: local.ticketId,
      kind: "finished_there_open_here",
      field: "status",
      fieldLabel: "Job state",
      resolveValue: local.status,
      externalValue: mirror.status,
      summary: `${name} is finished in Breezeway but the Resolve ticket is still open.`,
    });
  }

  if (hereDone && !thereDone) {
    out.push({
      taskId: mirror.taskId,
      ticketId: local.ticketId,
      kind: "closed_here_open_there",
      field: "status",
      fieldLabel: "Job state",
      resolveValue: local.status,
      externalValue: mirror.status,
      summary: `${name} is closed in Resolve but still open in Breezeway.`,
    });
  }

  if (
    mirror.scheduledDate &&
    local.scheduledDate &&
    mirror.scheduledDate !== local.scheduledDate
  ) {
    out.push({
      taskId: mirror.taskId,
      ticketId: local.ticketId,
      kind: "date_differs",
      field: "scheduled_date",
      fieldLabel: "Scheduled date",
      resolveValue: local.scheduledDate,
      externalValue: mirror.scheduledDate,
      summary: `${name} is scheduled for a different day in each system.`,
    });
  }

  return out;
}

/** One stable key per disagreement, so the same drift is never recorded twice. */
export function driftKey(item: DriftItem): string {
  return `breezeway_task:${item.taskId}:${item.field}`;
}

/** Shape written to the held-conflict log. Status is always open — never resolved here. */
export type HeldConflict = {
  entity_type: string;
  entity_id: string;
  system: string;
  field_key: string;
  field_label: string;
  resolve_value: string | null;
  external_value: string | null;
  status: "open";
  note: string;
};

export function heldConflict(item: DriftItem): HeldConflict {
  return {
    entity_type: item.ticketId ? "ticket" : "breezeway_work_order",
    entity_id: item.ticketId ?? String(item.taskId),
    system: "breezeway",
    field_key: driftKey(item),
    field_label: item.fieldLabel,
    resolve_value: item.resolveValue,
    external_value: item.externalValue,
    status: "open",
    note: item.summary,
  };
}

export const CONFLICT_SOURCES = ["resolve", "breezeway"] as const;
export type ConflictSource = (typeof CONFLICT_SOURCES)[number];

export function sourceLabel(source: string | null | undefined): string {
  if (source === "resolve") return "Keep what Resolve holds";
  if (source === "breezeway") return "Take the Breezeway value";
  return "Not decided";
}
