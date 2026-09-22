/**
 * Onboarding budget — browser-safe shaping only.
 *
 * One budget per home. Lines carry what we expect to spend (estimated), what
 * we have actually committed to a vendor, and what was finally paid. Nothing
 * here talks to the database or decides who may change a number; the server
 * module owns both. Every change to an approved budget carries a written
 * reason, which is why the history type has no optional reason field.
 */

export const BUDGET_CATEGORIES = [
  { value: "staging", label: "Staging" },
  { value: "furniture", label: "Furniture" },
  { value: "contractor", label: "Contractor" },
  { value: "supplies", label: "Supplies" },
  { value: "other", label: "Other" },
] as const;

export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number]["value"];

export const BUDGET_LINE_STATUSES = [
  { value: "planned", label: "Planned" },
  { value: "committed", label: "Committed" },
  { value: "invoiced", label: "Invoiced" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export type BudgetLineStatus = (typeof BUDGET_LINE_STATUSES)[number]["value"];

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  BUDGET_CATEGORIES.map((c) => [c.value, c.label]),
);
export const LINE_STATUS_LABEL: Record<string, string> = Object.fromEntries(
  BUDGET_LINE_STATUSES.map((s) => [s.value, s.label]),
);

export type BudgetLine = {
  id: string;
  category: string;
  label: string;
  vendor: string | null;
  estimated_amount: number | null;
  committed_amount: number | null;
  actual_amount: number | null;
  status: string;
  financial_request_id: string | null;
  note: string | null;
  updated_at?: string;
};

export type BudgetRecord = {
  id: string;
  property_id: string;
  project_id: string | null;
  approved_amount: number | null;
  approved_basis: string | null;
  approved_at: string | null;
  notes: string | null;
};

export type BudgetChange = {
  id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  reason: string;
  changed_by: string | null;
  changed_at: string;
};

const num = (v: number | null | undefined) => (v == null || !Number.isFinite(Number(v)) ? 0 : Number(v));

/** Cancelled lines cost nothing; an un-cancelled line without a committed figure falls back to the estimate. */
export function lineCommitted(line: BudgetLine): number {
  if (line.status === "cancelled") return 0;
  if (line.committed_amount != null) return num(line.committed_amount);
  return line.status === "planned" ? 0 : num(line.estimated_amount);
}

export function lineEstimated(line: BudgetLine): number {
  return line.status === "cancelled" ? 0 : num(line.estimated_amount);
}

export function lineActual(line: BudgetLine): number {
  return line.status === "cancelled" ? 0 : num(line.actual_amount);
}

export type BudgetTotals = {
  approved: number | null;
  estimated: number;
  committed: number;
  actual: number;
  /** Committed-or-actual against the approved budget. Null when nothing is approved yet. */
  remaining: number | null;
  over: boolean;
  byCategory: { category: string; label: string; estimated: number; committed: number; actual: number }[];
};

/** What has left the budget so far: the actual where we have one, otherwise the commitment. */
export function lineSpend(line: BudgetLine): number {
  const actual = lineActual(line);
  return actual > 0 ? actual : lineCommitted(line);
}

export function budgetTotals(lines: BudgetLine[], approved: number | null | undefined): BudgetTotals {
  const estimated = lines.reduce((s, l) => s + lineEstimated(l), 0);
  const committed = lines.reduce((s, l) => s + lineCommitted(l), 0);
  const actual = lines.reduce((s, l) => s + lineActual(l), 0);
  const spend = lines.reduce((s, l) => s + lineSpend(l), 0);
  const approvedValue = approved == null ? null : num(approved);

  const byCategory = BUDGET_CATEGORIES.map((c) => {
    const rows = lines.filter((l) => l.category === c.value);
    return {
      category: c.value,
      label: c.label,
      estimated: rows.reduce((s, l) => s + lineEstimated(l), 0),
      committed: rows.reduce((s, l) => s + lineCommitted(l), 0),
      actual: rows.reduce((s, l) => s + lineActual(l), 0),
    };
  }).filter((c) => c.estimated || c.committed || c.actual);

  return {
    approved: approvedValue,
    estimated,
    committed,
    actual,
    remaining: approvedValue == null ? null : approvedValue - spend,
    over: approvedValue != null && spend > approvedValue,
    byCategory,
  };
}

/** Plain wording for the budget line at the top of the tab. */
export function budgetHeadline(totals: BudgetTotals): string {
  if (totals.approved == null) return "No approved budget recorded yet.";
  if (totals.remaining == null) return "";
  if (totals.remaining < 0) return `Over the approved budget by ${money(Math.abs(totals.remaining))}.`;
  return `${money(totals.remaining)} of the approved budget is still unspent.`;
}

export function money(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
