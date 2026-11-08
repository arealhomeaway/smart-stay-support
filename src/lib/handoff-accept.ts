/**
 * The rules for accepting a ticket handoff — pulled out of `HandoffPanel` so
 * the two things that actually matter here (nobody accepts their own
 * request; acceptance never overwrites who it was offered to) can be
 * verified without a database or a mounted component.
 */

/** Whoever requested a handoff cannot also be the one who accepts it. */
export function handoffSelfAcceptCheck(
  currentUserId: string | null | undefined,
  requestedFrom: string | null | undefined,
): { ok: true } | { ok: false; message: string } {
  if (currentUserId && requestedFrom && currentUserId === requestedFrom) {
    return { ok: false, message: "You requested this handoff — someone else has to accept it." };
  }
  return { ok: true };
}

/**
 * The exact patch written to `handoffs` on acceptance. Deliberately narrow:
 * it never includes `to_user` — who a handoff was offered to and who
 * actually accepted it are two different facts, each kept in its own
 * column, so this patch cannot regress into overwriting the former.
 */
export function handoffAcceptPatch(userId: string | null, now: string) {
  return {
    status: "accepted",
    responded_at: now,
    accepted_by: userId,
    accepted_at: now,
  };
}

/** One save: how many rows changed, or the error. */
export type HandoffWrite = { error: { message: string } | null; rows: number };

export const HANDOFF_SETTLE_COPY = {
  ticketNotMoved: {
    accept: "The ticket did not change, so the handoff was not accepted. Refresh the page and try again.",
    decline: "The ticket did not change, so the handoff was not declined. Refresh the page and try again.",
  },
  handoffNotSaved: {
    accept: "The handoff could not be saved, so the ticket was put back. Try again.",
    decline: "The handoff could not be saved, so the ticket was put back. Try again.",
  },
} as const;

/**
 * Accept or decline in a safe order: the ticket moves first, and only when
 * that save really changed the ticket is the handoff recorded as accepted or
 * declined. If the handoff record then fails, the ticket is put back, so the
 * screen never says done while the ticket stayed where it was.
 */
export async function settleHandoff(
  kind: "accept" | "decline",
  steps: {
    saveTicket: () => Promise<HandoffWrite>;
    saveHandoff: () => Promise<HandoffWrite>;
    undoTicket: () => Promise<unknown>;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  let ticket: HandoffWrite;
  try {
    ticket = await steps.saveTicket();
  } catch {
    return { ok: false, message: HANDOFF_SETTLE_COPY.ticketNotMoved[kind] };
  }
  if (ticket.error || ticket.rows < 1) return { ok: false, message: HANDOFF_SETTLE_COPY.ticketNotMoved[kind] };

  let handoff: HandoffWrite | null = null;
  try {
    handoff = await steps.saveHandoff();
  } catch {
    handoff = null;
  }
  if (!handoff || handoff.error || handoff.rows < 1) {
    try {
      await steps.undoTicket();
    } catch {
      // The message below still tells the person it did not go through.
    }
    return { ok: false, message: HANDOFF_SETTLE_COPY.handoffNotSaved[kind] };
  }
  return { ok: true };
}
