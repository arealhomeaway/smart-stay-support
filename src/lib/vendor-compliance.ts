/**
 * Canonical vendor compliance indicator for credentials that expire
 * (Insurance, Licences/Certifications). Mirrors
 * public.vendor_compliance_threshold and public.vendor_gate_passes: a credential
 * is valid through its expiration date and expired from the day after.
 * Approaching expiry never blocks a vendor; only actual expiry does.
 */
export type ComplianceState = "current" | "expiring_soon" | "expires_7" | "expired";

export const COMPLIANCE_STATE_LABELS: Record<ComplianceState, string> = {
  current: "Current",
  expiring_soon: "Expiring Soon",
  expires_7: "Expires in 7 Days",
  expired: "Expired / On Hold",
};

export const COMPLIANCE_STATE_TONE = {
  current: "resolved",
  expiring_soon: "waiting",
  expires_7: "escalated",
  expired: "escalated",
} as const;

export type ReminderThreshold = "30_days" | "14_days" | "7_days" | "expiration_day";

export type ExpiringItem = {
  requirementId: string;
  label: string;
  expiresOn: string;
  days: number;
  state: ComplianceState;
};

const RANK: Record<ComplianceState, number> = { current: 0, expiring_soon: 1, expires_7: 2, expired: 3 };

export function daysUntil(expiresOn: string, today: string): number {
  const a = Date.UTC(+expiresOn.slice(0, 4), +expiresOn.slice(5, 7) - 1, +expiresOn.slice(8, 10));
  const b = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  return Math.round((a - b) / 86_400_000);
}

export function itemState(days: number): ComplianceState {
  if (days < 0) return "expired";
  if (days <= 7) return "expires_7";
  if (days <= 30) return "expiring_soon";
  return "current";
}

/** Same rule as the database reminder pass. */
export function reminderThreshold(days: number): ReminderThreshold | null {
  if (days < 0 || days > 30) return null;
  if (days === 0) return "expiration_day";
  if (days <= 7) return "7_days";
  if (days <= 14) return "14_days";
  return "30_days";
}

type Gate = { id: string; label: string; expiry_required: boolean };
type Result = { requirement_id: string; result: string; expires_on: string | null };

/** Expiring credentials for one vendor, worst first, plus the overall state. */
export function vendorCompliance(gates: Gate[], results: Result[], today: string) {
  const items: ExpiringItem[] = [];
  for (const g of gates) {
    if (!g.expiry_required) continue;
    const r = results.find((x) => x.requirement_id === g.id);
    if (!r?.expires_on || (r.result !== "verified_meets" && r.result !== "equivalent_verified")) continue;
    const days = daysUntil(r.expires_on, today);
    items.push({ requirementId: g.id, label: g.label, expiresOn: r.expires_on, days, state: itemState(days) });
  }
  items.sort((a, b) => a.days - b.days);
  const state = items.reduce<ComplianceState>((s, i) => (RANK[i.state] > RANK[s] ? i.state : s), "current");
  return { state, items, attention: items.filter((i) => i.state !== "current") };
}
