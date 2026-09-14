/**
 * Where this ticket is in the work — nothing more.
 *
 * The ticket workspace renders one stage at a time. This function decides
 * which stage that is, from state the ticket already carries. It is pure:
 * it grants no authority, moves no clocks and never decides whether closure
 * is allowed — the SLA, evidence and closure engines remain the source of
 * truth. It only answers "where is the employee in this job right now?".
 *
 * There used to be a "start" stage that blocked everything else until a
 * separate "Start working" click acknowledged the ticket and started the
 * clock. That gate is retired: `acknowledged_at`/`action_started_at` are
 * now backfilled automatically on the first real action the ticket
 * receives (see `ensureTicketActionStarted` in ticket-action-start.ts), so
 * the stage machine always shows the real next stage — opening a ticket is
 * never itself an action, and never advances anything here.
 */

export type TicketStage =
  "closed" | "waiting" | "repair_active" | "verify" | "steps" | "repair" | "closure";

export type TicketStageInput = {
  status: string | null | undefined;
  closed: boolean;
  /** A Breezeway repair exists for this ticket. */
  repairExists: boolean;
  /** The field work has been reported complete. */
  repairComplete: boolean;
  /** The guest has confirmed the fix (or no guest is in the home). */
  verified: boolean;
  requiredOpenSteps: number;
  /** This kind of work can plausibly need a field repair. */
  repairPossible: boolean;
  /**
   * The most recently completed repair was reported as unsuccessful (the
   * "Still needs repair" action) and no fresh Work Order has been opened
   * since. `repairExists`/`repairComplete` stay true forever once any Work
   * Order has ever closed on this ticket — they say a repair was attempted,
   * not that it worked — so this is the only signal that can send a ticket
   * back to `repair` once it has reached `verify`.
   */
  repairReportedIncomplete: boolean;
};

export function ticketStage(t: TicketStageInput): TicketStage {
  if (t.closed) return "closed";
  if (t.status === "waiting") return "waiting";
  if (t.repairExists && !t.repairComplete) return "repair_active";
  if (t.repairExists && t.repairComplete && !t.verified && !t.repairReportedIncomplete)
    return "verify";
  if (t.requiredOpenSteps > 0) return "steps";
  if (t.repairPossible && !t.repairExists && t.status !== "resolved") return "repair";
  // A repair happened and closed, but it didn't fix the issue — send it back
  // to `repair` (not `verify` or `closure`) so a new Work Order can be
  // opened. Guarded by `!verified`: a genuine guest confirmation always
  // wins over a stale flag from an earlier cycle.
  if (t.repairPossible && t.repairReportedIncomplete && !t.verified && t.status !== "resolved")
    return "repair";
  return "closure";
}

/** The categories where sending someone to the property is a normal outcome. */
const REPAIRABLE = new Set([
  "maintenance",
  "appliance",
  "hvac",
  "plumbing",
  "electrical",
  "cleaning",
  "damage",
  "access",
  "safety",
]);

export function repairIsPossible(
  category: string | null | undefined,
  workTypeName?: string | null,
) {
  const text = `${category ?? ""} ${workTypeName ?? ""}`.toLowerCase();
  if (!text.trim()) return false;
  return [...REPAIRABLE].some((c) => text.includes(c));
}

/**
 * Has the field repair actually finished — the signal `ticketStage()` reads
 * as `repairComplete`.
 *
 * A vendor saying the job is done ("Vendor says complete", `vendor_completed_at`)
 * is an internal Work Order milestone, not a Ticket-visible one: closure
 * evidence, final cost and guest notification can all still stand between
 * that and "Close work order". Only `closed_at` — the Work Order actually
 * closed — may advance the Ticket to Verify. `vendor_status === "completed"`
 * is kept as a second, independent signal: the older on-ticket vendor
 * dispatch field, predating the Work Order model, unaffected by this rule.
 */
export function repairIsComplete(input: {
  vendorStatus: string | null | undefined;
  /** Every live (non-cancelled) Work Order for this ticket. */
  liveOrders: { closed_at: string | null | undefined }[];
}): boolean {
  return (
    input.vendorStatus === "completed" ||
    (input.liveOrders.length > 0 && input.liveOrders.every((o) => Boolean(o.closed_at)))
  );
}
