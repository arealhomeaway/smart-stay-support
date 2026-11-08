/**
 * Claim card decision (Emily, Nov 7, 2026; register C2). Pure and browser-safe.
 *
 * Claims use the same approval ladder as refunds, so the limits are read from RECOVERY_POLICY and
 * never restated: a coordinator up to and including $500; the Operations Supervisor above $500 up
 * to and including $1,500; the Director of Operations above that. The database repeats them in
 * private.claim_required_authority (docs/pending/alerts/04_claim_approval.sql); a test keeps the
 * two equal. The database checks the decider's role and blocks sending an unapproved claim.
 */
import { RECOVERY_POLICY } from "@/lib/recovery-policy";

export type ClaimAuthority = "coordinator" | "supervisor" | "director";

export function claimAuthority(amount: number | null | undefined): ClaimAuthority {
  if (amount === null || amount === undefined || !Number.isFinite(amount) || amount <= RECOVERY_POLICY.pcApprovalCeiling)
    return "coordinator";
  if (amount <= RECOVERY_POLICY.supervisorApprovalCeiling) return "supervisor";
  return "director";
}

export function canDecideClaim(
  authority: string | null | undefined,
  viewer: { isSupervisor: boolean; isDirector: boolean },
): boolean {
  if (authority === "director") return viewer.isDirector;
  return viewer.isSupervisor || viewer.isDirector;
}

const money = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export const CLAIM_APPROVAL_COPY = {
  title: "Approval",
  amount: "Amount to claim",
  who: {
    coordinator: `Up to ${money(RECOVERY_POLICY.pcApprovalCeiling)}: you can go ahead. No approval needed.`,
    supervisor: `Over ${money(RECOVERY_POLICY.pcApprovalCeiling)}: the Operations Supervisor approves before it is sent.`,
    director: `Over ${money(RECOVERY_POLICY.supervisorApprovalCeiling)}: the Director of Operations approves before it is sent.`,
  } as Record<ClaimAuthority, string>,
  ask: "Ask for approval",
  asking: "Asking…",
  waiting: {
    supervisor: "Waiting for the Operations Supervisor.",
    director: "Waiting for the Director of Operations.",
  } as Record<string, string>,
  reason: "Reason (required)",
  approve: "Approve",
  decline: "Decline",
  approved: (amount: number | null, reason: string | null) =>
    `Approved${amount !== null ? ` at ${money(amount)}` : ""}${reason ? `: ${reason}` : "."}`,
  declined: (reason: string | null) => `Declined${reason ? `: ${reason}` : "."}`,
  asked: "Approval asked for",
  decidedApprove: "Approved",
  decidedDecline: "Declined",
} as const;

/** What the card shows for a claim's approval right now. */
export function claimApprovalState(claim: {
  approval_status?: string | null;
  approval_authority?: string | null;
}): "none" | "pending" | "approved" | "declined" {
  const s = claim.approval_status;
  return s === "pending" || s === "approved" || s === "declined" ? s : "none";
}

export function parseAmount(text: string): number | null {
  const n = Number(text.replace(/[$,\s]/g, ""));
  return text.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
}
