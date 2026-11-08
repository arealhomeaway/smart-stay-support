/**
 * Work Entry Model — the three ways Operations records something.
 *
 *  - Log Property Activity: already handled, history only (property_activity_log).
 *  - Create Ops Ticket: actionable non-maintenance work (Ticket engine).
 *  - Create Maintenance Ticket: physical repair work (Ticket engine + maintenance fields).
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
    title: "Create Maintenance Ticket",
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
  { value: "fire_smoke", label: "Fire or smoke" },
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

/**
 * Maintenance categories where the potential-insurance question is asked:
 * flooding and major leaks (Water intrusion / leak), roof, structural.
 * Fire or smoke has no maintenance category yet.
 */
export const INSURANCE_CATEGORIES: readonly string[] = ["water_intrusion", "roof", "structural", "fire_smoke"];

/** Ask about insurance for these categories, and always keep an answer already given visible. */
export function insuranceOptionShown(category: string | null | undefined, risk: string | null | undefined): boolean {
  return INSURANCE_CATEGORIES.includes(category ?? "") || insuranceFlagged(risk);
}

export function insuranceFlagged(risk: string | null | undefined): boolean {
  return risk === "yes" || risk === "unsure";
}

/** Yes = possible insured loss; Unsure = needs review, never presented as confirmed. */
export function insuranceRiskLabel(risk: string | null | undefined): string {
  return risk === "yes" ? "Potential Insurance Event" : risk === "unsure" ? "Insurance Review Needed" : "";
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
  // Policy v3: exactly the owner amount already needs the owner.
  const inclusive = Boolean(MAINTENANCE_POLICY.ownerThresholdInclusive);
  if (costs.some((c) => (inclusive ? c >= threshold : c > threshold)))
    reasons.push(inclusive ? `Cost is $${threshold} or more` : `Cost is over $${threshold}`);
  if (ticket.insurance_risk === "yes") reasons.push("Potential insurance-related event");
  if (ticket.insurance_risk === "unsure") reasons.push("Insurance-related status unsure — confirm");
  return { relevant: reasons.length > 0, reasons };
}

/** Default maintenance work type when the text names none: urgent if a guest is affected. */
export function defaultMaintenanceWorkTypeName(guestAffected: boolean) {
  return guestAffected ? "Immediate maintenance" : "Ongoing maintenance";
}

const MAINTENANCE_WORDS: [string, RegExp][] = [
  ["water_intrusion", /\b(leak|leaking|flood|flooding|water (on|in) the|ceiling stain|drip)/i],
  ["plumbing", /\b(toilet|sink|drain|clog|faucet|shower|water heater|pipe|disposal)/i],
  ["hvac", /\b(ac|a\/c|air condition|hvac|heat|heater|furnace|thermostat|not cooling)\b/i],
  ["electrical", /\b(outlet|breaker|power|light|electric|switch|gfci)/i],
  ["appliance", /\b(fridge|refrigerator|dishwasher|washer|dryer|oven|stove|microwave|ice maker)/i],
  ["lock_access", /\b(lock|keypad|door code|smart lock|key|garage door)/i],
  ["technology", /\b(wifi|wi-fi|internet|router|tv|remote|streaming)/i],
  ["roof", /\broof|shingle/i],
  ["exterior", /\b(yard|lawn|fence|gate|sprinkler|pool|patio|deck)/i],
  ["furniture", /\b(bed|couch|sofa|chair|table|mattress|dresser)/i],
  ["structural", /\b(crack|foundation|wall damage|floor damage)/i],
];

/** Starting maintenance category from what the coordinator typed; null when nothing is clear. */
export function guessMaintenanceCategory(text: string | null | undefined): string | null {
  const t = String(text ?? "");
  for (const [value, re] of MAINTENANCE_WORDS) if (re.test(t)) return value;
  return null;
}
