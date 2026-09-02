/**
 * Resolve navigation context.
 *
 * One contract for the whole app: whenever an employee leaves a workspace to
 * open a record, Resolve remembers *the workspace they left* — its label, its
 * exact URL (tab, filters, search, sort), its scroll position and, where the
 * workspace is a queue, the ordered list of work they were moving through.
 *
 * The record then knows where it came from, so Back restores the workspace
 * rather than guessing at a similar URL, and queue work can flow continuously
 * with Previous / Next.
 *
 * Nothing here touches data, permissions or routing rules. It is pure
 * client-side memory keyed to a navigation state, held in sessionStorage so it
 * survives a reload and a browser Back but never leaks between sessions.
 */

export type QueueItem = {
  /** Record id, used for the route param. */
  id: string;
  label: string;
  sub?: string | undefined;
};

export type OriginSnapshot = {
  /** Plain-language destination, e.g. "My work". Used as "← Back to My work". */
  label: string;
  /** Full path including search, e.g. "/tickets?tab=mine&priority=p1". */
  href: string;
  scrollY?: number;
  /** Ordered queue the employee was working, when the origin is a queue. */
  queue?: QueueItem[];
  at: number;
};

const PREFIX = "resolve.nav.";
/** Keep the store small; workspaces are revisited, tokens are deterministic. */
const MAX_QUEUE = 300;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Deterministic short token for a workspace URL, so the same state reuses one slot. */
export function originToken(href: string): string {
  let h = 5381;
  for (let i = 0; i < href.length; i++) h = ((h << 5) + h + href.charCodeAt(i)) | 0;
  return `o${(h >>> 0).toString(36)}`;
}

export function readOrigin(token?: string | null): OriginSnapshot | null {
  if (!token) return null;
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(PREFIX + token);
    return raw ? (JSON.parse(raw) as OriginSnapshot) : null;
  } catch {
    return null;
  }
}

function write(token: string, snap: OriginSnapshot) {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(PREFIX + token, JSON.stringify(snap));
  } catch {
    /* quota — navigation memory is a convenience, never a requirement */
  }
}

/**
 * Record (or refresh) the workspace the employee is currently in.
 * Returns the token to hand to any record opened from here.
 */
export function rememberOrigin(input: { label: string; href: string; queue?: QueueItem[] }): string {
  const token = originToken(input.href);
  const previous = readOrigin(token);
  const queue = input.queue ? input.queue.slice(0, MAX_QUEUE) : previous?.queue;
  const snap: OriginSnapshot = { label: input.label, href: input.href, at: Date.now() };
  if (previous?.scrollY !== undefined) snap.scrollY = previous.scrollY;
  if (queue) snap.queue = queue;
  write(token, snap);
  return token;
}

export function rememberScroll(token: string, scrollY: number) {
  const snap = readOrigin(token);
  if (!snap) return;
  write(token, { ...snap, scrollY, at: Date.now() });
}

/** The natural parent collection for a record opened from a cold, direct link. */
export const NATURAL_PARENTS = {
  ticket: { label: "My work", href: "/tickets" },
  property: { label: "Properties", href: "/properties" },
  lead: { label: "Leads", href: "/leads" },
  claim: { label: "Claims", href: "/claims" },
  recovery: { label: "Guest recovery", href: "/recovery" },
  routine: { label: "Routine work", href: "/routines" },
} as const;

export type NaturalParent = keyof typeof NATURAL_PARENTS;

/** Resolve the origin for a record: remembered workspace, else natural parent. */
export function resolveOrigin(token: string | undefined, fallback: NaturalParent): OriginSnapshot {
  const snap = readOrigin(token);
  if (snap) return snap;
  const parent = NATURAL_PARENTS[fallback];
  return { label: parent.label, href: parent.href, at: 0 };
}

/** Position of a record inside the remembered queue, with its neighbours. */
export function queuePosition(snap: OriginSnapshot | null, id: string) {
  const queue = snap?.queue ?? [];
  const index = queue.findIndex((q) => q.id === id);
  if (index < 0) return null;
  return {
    index,
    total: queue.length,
    previous: index > 0 ? (queue[index - 1] ?? null) : null,
    next: index < queue.length - 1 ? (queue[index + 1] ?? null) : null,
    queue,
  };
}
