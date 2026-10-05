/**
 * The homeowner's four Opportunity queues (browser-safe, pure).
 * Counts and filters are derived from canonical Opportunity data every time —
 * never stored as counters. Only ARHA-sent Opportunities are counted; internal
 * Tasks never appear here.
 */
export type OwnerQueue = "attention" | "awaiting" | "feedback" | "new";

export const OWNER_QUEUES: { key: OwnerQueue; label: string }[] = [
  { key: "attention", label: "Needs Your Attention" },
  { key: "awaiting", label: "Awaiting Your Response" },
  { key: "feedback", label: "Feedback Sent" },
  { key: "new", label: "New" },
];

export type QueueInput = {
  status: string;
  viewed: boolean;
  needsOwnerAttention: boolean;
  lastSpeaker: "homeowner" | "staff" | null;
  responseTypes: string[];
  /** The owner has already answered (a reply or a recorded response). */
  answered?: boolean;
  /** Retired by staff (never an owner obligation). */
  retired?: boolean;
};

const INACTIVE = new Set(["complete", "completed", "draft", "archived", "retired"]);
const active = (o: QueueInput) => !INACTIVE.has(o.status) && !o.retired;
/**
 * An owner obligation exists only when the Opportunity asks for feedback or a
 * decision. Acknowledge-only (informational) and optional documentation never do.
 */
const requiresOwnerAction = (o: QueueInput) => o.responseTypes.some((t) => t === "feedback" || t === "decision");

export function inQueue(o: QueueInput, q: OwnerQueue): boolean {
  if (!active(o)) return false;
  switch (q) {
    // Priority flag, independent of workflow state.
    case "attention":
      return o.needsOwnerAttention;
    // Published but not yet opened by the homeowner.
    case "new":
      return !o.viewed;
    // Homeowner spoke last: ARHA owns the next step ("Staff action needed" internally).
    case "feedback":
      return o.lastSpeaker === "homeowner";
    // Opened, an owner action (feedback/decision) is requested and not yet given.
    // A staff message alone never creates an obligation.
    case "awaiting":
      return o.viewed && requiresOwnerAction(o) && !o.answered && o.lastSpeaker !== "homeowner";
  }
}

export function queueCounts(rows: QueueInput[]): Record<OwnerQueue, number> {
  return {
    attention: rows.filter((r) => inQueue(r, "attention")).length,
    awaiting: rows.filter((r) => inQueue(r, "awaiting")).length,
    feedback: rows.filter((r) => inQueue(r, "feedback")).length,
    new: rows.filter((r) => inQueue(r, "new")).length,
  };
}

export function isOwnerQueue(v: unknown): v is OwnerQueue {
  return v === "attention" || v === "awaiting" || v === "feedback" || v === "new";
}
