/**
 * Guest refunds & credits reporting — the money view.
 *
 * Reads rows of public.guest_recovery_ledger, the single reporting surface that
 * joins each recovery to its ticket and home. Everything here is pure so the
 * same totals can be shown to Operations today and to the Finance workspace
 * when it ships, without a second definition of "issued".
 */

export type LedgerRow = {
  recovery_id: string;
  logged_at: string | null;
  stage: string | null;
  approval_status: string | null;
  authority_level: string | null;
  recovery_action: string | null;
  proposed_amount: number | null;
  approved_amount: number | null;
  delivered_amount: number | null;
  delivered_on: string | null;
  ticket_id: string | null;
  ticket_title: string | null;
  ticket_category: string | null;
  property_id: string | null;
  property_name: string | null;
  is_demo: boolean | null;
};

export type RecoveryTotals = {
  count: number;
  proposed: number;
  approved: number;
  issued: number;
  awaitingApproval: number;
  openCount: number;
};

const money = (value: number | null | undefined) => (typeof value === "number" ? value : 0);

/** Demo records never count towards anything anyone reports on. */
export function reportableRows(rows: LedgerRow[]): LedgerRow[] {
  return rows.filter((row) => row.is_demo !== true);
}

export function recoveryTotals(rows: LedgerRow[]): RecoveryTotals {
  const reportable = reportableRows(rows);
  return {
    count: reportable.length,
    proposed: reportable.reduce((sum, r) => sum + money(r.proposed_amount), 0),
    approved: reportable.reduce((sum, r) => sum + money(r.approved_amount), 0),
    issued: reportable.reduce((sum, r) => sum + money(r.delivered_amount), 0),
    awaitingApproval: reportable.filter((r) => r.approval_status === "pending").length,
    openCount: reportable.filter((r) => r.stage !== "closed").length,
  };
}

export type GroupedTotals = { key: string; label: string; totals: RecoveryTotals };

function group(
  rows: LedgerRow[],
  keyOf: (row: LedgerRow) => { key: string; label: string } | null,
): GroupedTotals[] {
  const buckets = new Map<string, { label: string; rows: LedgerRow[] }>();
  for (const row of reportableRows(rows)) {
    const at = keyOf(row);
    if (!at) continue;
    const bucket = buckets.get(at.key) ?? { label: at.label, rows: [] };
    bucket.rows.push(row);
    buckets.set(at.key, bucket);
  }
  return [...buckets.entries()]
    .map(([key, bucket]) => ({ key, label: bucket.label, totals: recoveryTotals(bucket.rows) }))
    .sort((a, b) => b.totals.issued - a.totals.issued || b.totals.count - a.totals.count);
}

/** Issued dollars per home — the pattern a Finance dashboard asks for first. */
export function totalsByProperty(rows: LedgerRow[]): GroupedTotals[] {
  return group(rows, (row) =>
    row.property_id
      ? { key: row.property_id, label: row.property_name ?? "Unnamed home" }
      : { key: "none", label: "No home on file" },
  );
}

export function totalsByCategory(rows: LedgerRow[]): GroupedTotals[] {
  return group(rows, (row) => ({
    key: row.ticket_category ?? "other",
    label: row.ticket_category ?? "Other",
  }));
}

/** YYYY-MM buckets, newest first, by when the recovery was logged. */
export function totalsByMonth(rows: LedgerRow[]): GroupedTotals[] {
  const buckets = group(rows, (row) => {
    if (!row.logged_at) return null;
    const key = row.logged_at.slice(0, 7);
    return { key, label: key };
  });
  return buckets.sort((a, b) => b.key.localeCompare(a.key));
}
