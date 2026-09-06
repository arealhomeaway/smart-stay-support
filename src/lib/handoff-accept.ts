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
