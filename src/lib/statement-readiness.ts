/**
 * Statement Readiness — pure rules (browser-safe).
 *
 * Prepares and tracks Finance's monthly expense review per property. It never
 * generates, sends or posts statements: QuickBooks stays the accounting record
 * and OwnerRez the statement record. Gates are also enforced in the database.
 */
import { authorizationNeed, missingDocumentation, type AuthorizationContext, type ExpenseFacts } from "@/lib/expenses";

export type Disposition = "include" | "hold" | "defer" | "exclude";
export const DISPOSITION_LABEL: Record<Disposition, string> = {
  include: "Include in this period",
  hold: "Hold for clarification or decision",
  defer: "Defer to a later period",
  exclude: "Exclude from owner statement",
};

export type PeriodReadiness = "not_reconciled" | "needs_rereview" | "expense_review_ready";
export const PERIOD_READINESS_LABEL: Record<PeriodReadiness, string> = {
  not_reconciled: "Not yet reconciled",
  needs_rereview: "Needs re-review — changed after sign-off",
  expense_review_ready: "Expense review ready",
};

/** Empty periods are never "ready" on their own — Finance must confirm the source review. */
export function periodReadiness(signoffs: { status: string; reviewed_at: string }[]): PeriodReadiness {
  if (signoffs.some((s) => s.status === "confirmed")) return "expense_review_ready";
  return signoffs.length ? "needs_rereview" : "not_reconciled";
}

export type StatementItem = ExpenseFacts & {
  id: string;
  is_estimate: boolean | null;
  duplicate_flag: string | null;
  finance_review: string;
  cost_responsibility: string | null;
  owner_notified_at: string | null;
  links: number;
  openClarifications: number;
  openClaims: { id: string; title: string | null }[];
  expected: number;
  received: number;
};

/** Specific, plain blockers for one expense in the period view (empty = none). */
export function itemBlockers(e: StatementItem, wo: AuthorizationContext = null): string[] {
  const out: string[] = [];
  if (e.is_estimate) out.push("Estimate only — the actual invoice has not been recorded.");
  if (e.duplicate_flag === "suspected") out.push("Possible duplicate of another expense.");
  const missing = missingDocumentation(e, wo);
  if (missing.length) out.push(`Documentation missing: ${missing.join(", ")}.`);
  if (e.finance_review !== "reviewed") out.push("Finance review not complete.");
  if (!e.cost_responsibility || e.cost_responsibility === "pending") out.push("Cost responsibility unresolved.");
  if (e.links === 0) out.push("Not matched to a Ticket, Work Order, Claim or Property Activity.");
  if (e.openClarifications > 0) out.push(`${e.openClarifications} open clarification Task(s) with Operations.`);
  const auth = authorizationNeed(e, wo);
  if (auth.required && auth.who === "owner" && !e.owner_notified_at)
    out.push("Owner notification not recorded for an amount that needed owner authorization.");
  return out;
}

/** An outstanding recovery or open Claim does not block — Finance must record its treatment. */
export function needsRecoveryTreatment(e: Pick<StatementItem, "openClaims" | "expected" | "received">): boolean {
  return e.openClaims.length > 0 || e.expected - e.received > 0;
}

export const monthStart = (ym: string) => `${ym}-01`;
export const monthLabel = (d: string) =>
  new Date(d.slice(0, 7) + "-15T12:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric" });
