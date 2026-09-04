/**
 * How a homeowner's email reply is matched back to the decision it answers.
 *
 * Every approval carries one short, human-readable reference — APR-1042 — that
 * Resolve prints in the subject line of the email it sends. A reply keeps that
 * text, so the strongest match is the reference itself. Where the reference has
 * been stripped, the same Outlook conversation is the next best evidence, and
 * the sender's address is the last. If none of that settles it to exactly one
 * open decision, the reply is held for a person to place — it is never guessed.
 *
 * Pure string and list handling, so the rules can be tested without Outlook.
 */

/** The reference printed on the homeowner's email. */
export function approvalRef(ref: number | null | undefined): string | null {
  if (ref === null || ref === undefined) return null;
  return `APR-${ref}`;
}

/** Every approval reference mentioned in a subject or reply body. */
export function findApprovalRefs(...texts: (string | null | undefined)[]): number[] {
  const found: number[] = [];
  for (const text of texts) {
    for (const m of (text ?? "").matchAll(/\bAPR[-\s]?(\d{1,12})\b/gi)) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && !found.includes(n)) found.push(n);
    }
  }
  return found;
}

export type ApprovalCandidate = {
  id: string;
  ref: number | null;
  title: string;
  propertyId: string | null;
  ownerEmail: string | null;
  conversationId: string | null;
};

export type MatchMethod = "reference" | "thread" | "sender";

export type ResponseMatch = {
  approvalId: string | null;
  method: MatchMethod | null;
  /** Why a person has to place it, in plain words. */
  reason: string | null;
  /** The open decisions that could plausibly be the one, when it is unclear. */
  candidates: ApprovalCandidate[];
};

function sameEmail(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Which open decision this reply answers, if it can be said with certainty.
 *
 * Never returns a "best guess": anything short of exactly one match comes back
 * unmatched with the plausible decisions attached for staff to choose from.
 */
export function matchOwnerResponse(input: {
  subject?: string | null;
  body?: string | null;
  conversationId?: string | null;
  fromAddress?: string | null;
  candidates: ApprovalCandidate[];
}): ResponseMatch {
  const open = input.candidates ?? [];
  const refs = findApprovalRefs(input.subject, input.body);

  if (refs.length > 0) {
    const byRef = open.filter((c) => c.ref !== null && refs.includes(c.ref));
    if (byRef.length === 1) {
      return { approvalId: byRef[0]!.id, method: "reference", reason: null, candidates: [] };
    }
    if (byRef.length > 1) {
      return {
        approvalId: null,
        method: null,
        reason: "The reply names more than one open decision.",
        candidates: byRef,
      };
    }
    return {
      approvalId: null,
      method: null,
      reason: "The reference in this reply does not match an open decision.",
      candidates: open,
    };
  }

  if (input.conversationId) {
    const byThread = open.filter((c) => c.conversationId && c.conversationId === input.conversationId);
    if (byThread.length === 1) {
      return { approvalId: byThread[0]!.id, method: "thread", reason: null, candidates: [] };
    }
    if (byThread.length > 1) {
      return {
        approvalId: null,
        method: null,
        reason: "This email thread covers more than one open decision.",
        candidates: byThread,
      };
    }
  }

  const bySender = open.filter((c) => sameEmail(c.ownerEmail, input.fromAddress));
  if (bySender.length === 1) {
    return { approvalId: bySender[0]!.id, method: "sender", reason: null, candidates: [] };
  }
  if (bySender.length > 1) {
    return {
      approvalId: null,
      method: null,
      reason: "This homeowner has more than one decision waiting.",
      candidates: bySender,
    };
  }

  return {
    approvalId: null,
    method: null,
    reason: "Resolve could not tell which decision this reply answers.",
    candidates: open.slice(0, 25),
  };
}
