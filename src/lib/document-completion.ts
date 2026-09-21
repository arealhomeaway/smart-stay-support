/**
 * Document completion and legacy cleanup rules (browser-safe, no I/O).
 *
 * Two questions this answers, and nothing else:
 *   - What paperwork is missing, expired or unusable right now?
 *   - Which files were carried over from the old tools and can be retired?
 *
 * Nothing here deletes anything. Retiring a document means archiving it: it
 * stays readable, it stops counting as current.
 */

export type DocState = "current" | "expiring" | "expired" | "unusable" | "archived";

export type DocStateInfo = {
  state: DocState;
  label: string;
  /** Sorts worst-first in a review list. */
  severity: number;
};

const STATES: Record<DocState, DocStateInfo> = {
  expired: { state: "expired", label: "Expired", severity: 0 },
  unusable: { state: "unusable", label: "Nothing attached", severity: 1 },
  expiring: { state: "expiring", label: "Expires soon", severity: 2 },
  current: { state: "current", label: "Current", severity: 3 },
  archived: { state: "archived", label: "Retired", severity: 4 },
};

/** How far ahead an expiry counts as "expires soon". */
export const EXPIRING_WINDOW_DAYS = 30;

export type DocInput = {
  id: string;
  title: string;
  /** Vendor document type or general document category. */
  kindCode: string | null;
  /** Date the paperwork stops being valid, when the type carries one. */
  expiresOn: string | null;
  /** Where the file or link actually lives. */
  storagePath: string | null;
  externalUrl: string | null;
  /** Documents that were only ever verified, never stored, are complete without a file. */
  verifyOnly?: boolean;
  archivedAt?: string | null;
  uploadStatus?: string | null;
  createdAt?: string | null;
};

function daysUntil(dateISO: string, today: Date): number {
  const then = Date.parse(`${dateISO}T00:00:00Z`);
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((then - start) / 86_400_000);
}

export function documentState(doc: DocInput, today: Date = new Date()): DocStateInfo {
  if (doc.archivedAt) return STATES.archived;

  const hasFile = Boolean(doc.storagePath) || Boolean(doc.externalUrl);
  const uploadFinished = !doc.uploadStatus || doc.uploadStatus === "stored";
  if (!doc.verifyOnly && (!hasFile || !uploadFinished)) return STATES.unusable;

  if (doc.expiresOn) {
    const days = daysUntil(doc.expiresOn, today);
    if (days < 0) return STATES.expired;
    if (days <= EXPIRING_WINDOW_DAYS) return STATES.expiring;
  }
  return STATES.current;
}

/* --------------------------------------------------------------- legacy */

/**
 * Hosts belonging to the tools Resolve replaces. A link into one of these is
 * a leftover: the record it points at is being retired with the tool.
 */
const LEGACY_HOSTS = [
  "notion.so",
  "notion.site",
  "asana.com",
  "fillout.com",
  "breezeway.io",
];

export function isLegacyLink(doc: DocInput): boolean {
  const url = (doc.externalUrl ?? "").toLowerCase();
  if (!url) return false;
  return LEGACY_HOSTS.some((host) => url.includes(host));
}

/** A stalled upload that never finished has nothing behind it and can be cleared. */
export function isAbandonedUpload(doc: DocInput): boolean {
  return Boolean(doc.uploadStatus) && doc.uploadStatus !== "stored" && !doc.storagePath;
}

export function isRetirable(doc: DocInput): boolean {
  if (doc.archivedAt) return false;
  return isLegacyLink(doc) || isAbandonedUpload(doc);
}

export function retireReason(doc: DocInput): string | null {
  if (doc.archivedAt) return null;
  if (isLegacyLink(doc)) return "Points at a tool Resolve replaces.";
  if (isAbandonedUpload(doc)) return "An upload that never finished — no file behind it.";
  return null;
}

/* ----------------------------------------------------------- completion */

export type RequiredDoc = {
  code: string;
  label: string;
  /** Verified rather than stored — complete without a file on record. */
  verifyOnly?: boolean;
};

export type CompletionRow = {
  code: string;
  label: string;
  state: DocState;
  stateLabel: string;
  documentId: string | null;
  expiresOn: string | null;
};

export type Completion = {
  rows: CompletionRow[];
  missing: number;
  attention: number;
  complete: boolean;
};

/**
 * Measures one holder (a home or a vendor company) against the paperwork it
 * must have. The newest non-archived document of each type counts.
 */
export function completionFor(
  required: RequiredDoc[],
  docs: DocInput[],
  today: Date = new Date(),
): Completion {
  const live = docs.filter((d) => !d.archivedAt);
  const rows: CompletionRow[] = required.map((req) => {
    const held = live
      .filter((d) => d.kindCode === req.code)
      .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
    const best = held[0];
    if (!best) {
      return {
        code: req.code,
        label: req.label,
        state: "unusable",
        stateLabel: "Not on file",
        documentId: null,
        expiresOn: null,
      };
    }
    const verifyOnly = req.verifyOnly ?? best.verifyOnly;
    const info = documentState(
      verifyOnly === undefined ? best : { ...best, verifyOnly },
      today,
    );
    return {
      code: req.code,
      label: req.label,
      state: info.state,
      stateLabel: info.label,
      documentId: best.id,
      expiresOn: best.expiresOn,
    };
  });

  const missing = rows.filter((r) => !r.documentId).length;
  const attention = rows.filter(
    (r) => r.state === "expired" || r.state === "unusable" || r.state === "expiring",
  ).length;
  return { rows, missing, attention, complete: attention === 0 };
}

export function sortByUrgency(rows: CompletionRow[]): CompletionRow[] {
  return [...rows].sort((a, b) => STATES[a.state].severity - STATES[b.state].severity);
}
