/**
 * Work Entry Model — the three ways Operations records something.
 *
 *  - Log Property Activity: already handled, history only (property_activity_log).
 *  - Create Ops Ticket: actionable non-maintenance work (Ticket engine).
 *  - Report Maintenance: physical repair work (Ticket engine + maintenance fields).
 *
 * Pure: no I/O. The owner-relevance rule reads the one maintenance threshold
 * from MAINTENANCE_POLICY; nothing here restates a dollar amount.
 */
import { MAINTENANCE_POLICY } from "@/lib/maintenance-policy";

export type EntryKind = "activity" | "ops" | "maintenance";

export const ENTRY_KINDS: { value: EntryKind; title: string; hint: string }[] = [
  {
    value: "activity",
    title: "Log Property Activity",
    hint: "Already handled outside Resolve, nothing left to do. Saved to the property's history only.",
  },
  {
    value: "ops",
    title: "Create Ops Ticket",
    hint: "Guest, reservation or coordination work that still needs someone to own and finish it.",
  },
  {
    value: "maintenance",
    title: "Report Maintenance",
    hint: "Something physical at the home needs repair or maintenance.",
  },
];

export const ACTIVITY_CATEGORIES = [
  { value: "guest", label: "Guest-related" },
  { value: "cleaner", label: "Cleaner-related" },
  { value: "vendor", label: "Vendor-related" },
  { value: "property_condition", label: "Property condition" },
  { value: "access", label: "Access / lock" },
  { value: "delivery", label: "Delivery / package" },
  { value: "administrative", label: "Administrative" },
  { value: "other", label: "Other" },
] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number]["value"];

export const MAINTENANCE_CATEGORIES = [
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "hvac", label: "HVAC" },
  { value: "appliance", label: "Appliance" },
  { value: "lock_access", label: "Lock / access" },
  { value: "furniture", label: "Furniture" },
  { value: "structural", label: "Structural" },
  { value: "roof", label: "Roof" },
  { value: "water_intrusion", label: "Water intrusion / leak" },
  { value: "exterior", label: "Exterior / yard" },
  { value: "technology", label: "Internet / technology" },
  { value: "other", label: "Other" },
] as const;

export const INSURANCE_RISK = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
  { value: "unsure", label: "Unsure" },
] as const;
export type InsuranceRisk = (typeof INSURANCE_RISK)[number]["value"];

export function labelOf(list: readonly { value: string; label: string }[], v: string | null | undefined) {
  return list.find((x) => x.value === v)?.label ?? v ?? "—";
}

/** Work-type catalog categories each Ticket path draws from. */
export function workTypeFitsKind(category: string | null | undefined, kind: "ops" | "maintenance") {
  return kind === "maintenance" ? category === "maintenance" : category !== "maintenance";
}

export function insuranceFlagged(risk: string | null | undefined): boolean {
  return risk === "yes" || risk === "unsure";
}

export type OwnerRelevanceInput = {
  entry_kind?: string | null;
  insurance_risk?: string | null;
  estimated_cost?: number | string | null;
};

export type OwnerRelevance = { relevant: boolean; reasons: string[] };

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Whether the compact Owner section belongs on this Ticket. Ops Tickets never
 * show it. Maintenance shows it above the owner-approval threshold (estimated
 * or any Work Order cost) or when an insured loss is possible (Yes / Unsure).
 */
export function ownerSectionRelevant(
  ticket: OwnerRelevanceInput,
  workOrderCosts: (number | string | null | undefined)[] = [],
  threshold: number = MAINTENANCE_POLICY.ownerApprovalThreshold,
): OwnerRelevance {
  if (ticket.entry_kind !== "maintenance") return { relevant: false, reasons: [] };
  const reasons: string[] = [];
  const costs = [num(ticket.estimated_cost), ...workOrderCosts.map(num)].filter(
    (n): n is number => n !== null,
  );
  if (costs.some((c) => c > threshold)) reasons.push(`Cost is over $${threshold}`);
  if (ticket.insurance_risk === "yes") reasons.push("Potential insurance-related event");
  if (ticket.insurance_risk === "unsure") reasons.push("Insurance-related status unsure — confirm");
  return { relevant: reasons.length > 0, reasons };
}

/** Default maintenance work type when the text names none: urgent if a guest is affected. */
export function defaultMaintenanceWorkTypeName(guestAffected: boolean) {
  return guestAffected ? "Immediate maintenance" : "Ongoing maintenance";
}
