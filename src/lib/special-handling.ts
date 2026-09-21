/**
 * Canonical Special Handling — one source of truth per property.
 *
 * Before this existed, "special handling" was free text scattered across
 * operating notes and access notes. Coordinators had to remember which
 * home had which rule. A rule now has a type, so Resolve can surface the right
 * one at the moment it matters instead of asking someone to tick a generic
 * acknowledgement box.
 *
 * This file is vocabulary and matching only. It stores no thresholds of its
 * own: a property-level spend threshold is a fact about that property, and the
 * maintenance policy engine still decides what the threshold means.
 */

export type SpecialHandlingRuleType =
  | "required_vendor"
  | "preferred_vendor"
  | "owner_self_maintenance"
  | "owner_notification"
  | "spend_threshold"
  | "scheduling"
  | "access"
  | "trade_rule"
  | "restriction"
  | "note";

export type SpecialHandlingSeverity = "critical" | "standard" | "info";

/** The moments a rule can be surfaced before someone acts. */
export type SpecialHandlingMoment =
  "maintenance" | "vendor_dispatch" | "cleaning" | "guest_access" | "owner_contact" | "any";

export type SpecialHandlingRow = {
  id: string;
  property_id: string;
  rule_type: string;
  trade: string | null;
  title: string;
  instruction: string;
  vendor_org_id: string | null;
  vendor_name: string | null;
  threshold_amount: number | null;
  owner_notification_required: boolean;
  applies_to: string[];
  severity: string;
  active: boolean;
  source: string | null;
  updated_at: string;
};

export const RULE_TYPE_LABELS: Record<SpecialHandlingRuleType, string> = {
  required_vendor: "Must use this vendor",
  preferred_vendor: "Preferred vendor",
  owner_self_maintenance: "Owner handles this themselves",
  owner_notification: "Tell the owner first",
  spend_threshold: "Spending limit for this home",
  scheduling: "Scheduling rule",
  access: "Access rule",
  trade_rule: "Trade rule",
  restriction: "Do not do this",
  note: "Operating note",
};

/** Short helper text under each type in the editor. */
export const RULE_TYPE_HINTS: Record<SpecialHandlingRuleType, string> = {
  required_vendor: "Only this vendor may be sent. Anyone else is a mistake, not a preference.",
  preferred_vendor: "Send this vendor first if they are available.",
  owner_self_maintenance: "The owner does this work. Resolve should not dispatch anyone.",
  owner_notification: "The owner must be told before the work happens.",
  spend_threshold: "This home has its own approval ceiling, different from the standard one.",
  scheduling: "Timing constraints — quiet hours, days, notice periods.",
  access: "How people get in, and what they must not do while inside.",
  trade_rule: "A rule that only applies to one trade at this home.",
  restriction: "Something that must never happen at this property.",
  note: "Anything a coordinator genuinely needs to know.",
};

export const RULE_TYPES = Object.keys(RULE_TYPE_LABELS) as SpecialHandlingRuleType[];

export const SEVERITY_LABELS: Record<SpecialHandlingSeverity, string> = {
  critical: "Must follow",
  standard: "Important",
  info: "Good to know",
};

export const MOMENT_LABELS: Record<SpecialHandlingMoment, string> = {
  maintenance: "Maintenance and repairs",
  vendor_dispatch: "Sending a vendor",
  cleaning: "Cleaning",
  guest_access: "Guest access",
  owner_contact: "Owner contact",
  any: "Everything at this home",
};

export const MOMENTS = Object.keys(MOMENT_LABELS) as SpecialHandlingMoment[];

/** Types Resolve treats as blocking guidance rather than background context. */
const BLOCKING_TYPES: SpecialHandlingRuleType[] = [
  "required_vendor",
  "owner_self_maintenance",
  "owner_notification",
  "restriction",
  "spend_threshold",
];

export function isBlocking(rule: SpecialHandlingRow): boolean {
  return (
    rule.severity === "critical" ||
    BLOCKING_TYPES.includes(rule.rule_type as SpecialHandlingRuleType)
  );
}

export function ruleTypeLabel(value: string): string {
  return RULE_TYPE_LABELS[value as SpecialHandlingRuleType] ?? "Operating note";
}

export function severityLabel(value: string): string {
  return SEVERITY_LABELS[value as SpecialHandlingSeverity] ?? "Important";
}

/**
 * Which rules apply right now. `applies_to` is empty or contains "any" for a
 * rule that always applies; otherwise the current moment must be listed. A
 * trade, when set, must also match.
 */
export function rulesForMoment(
  rules: SpecialHandlingRow[],
  moment: SpecialHandlingMoment,
  trade?: string | null,
): SpecialHandlingRow[] {
  const wantedTrade = (trade ?? "").trim().toLowerCase();
  return rules
    .filter((r) => r.active)
    .filter((r) => {
      const scope = r.applies_to ?? [];
      const scoped = scope.length === 0 || scope.includes("any") || scope.includes(moment);
      if (!scoped) return false;
      if (r.trade && wantedTrade && r.trade.trim().toLowerCase() !== wantedTrade) return false;
      return true;
    })
    .sort(
      (a, b) => Number(isBlocking(b)) - Number(isBlocking(a)) || a.title.localeCompare(b.title),
    );
}

/**
 * One-line summaries for the contextual guidance card, which reads Special
 * Handling live and never copies it into a ticket.
 */
export function summarise(rules: SpecialHandlingRow[]): string[] {
  return rules.map((r) => {
    const head = ruleTypeLabel(r.rule_type);
    const who = r.vendor_name ? ` — ${r.vendor_name}` : "";
    const amount =
      r.threshold_amount != null ? ` — $${Number(r.threshold_amount).toLocaleString()}` : "";
    return `${head}${who}${amount}: ${r.instruction}`;
  });
}

/** Practical effects Resolve can apply without asking anyone to tick a box. */
export type SpecialHandlingEffects = {
  /** Dispatch is not allowed — the owner maintains this home themselves. */
  ownerSelfMaintains: boolean;
  /** The owner has to be told before work happens. */
  ownerNotificationRequired: boolean;
  /** Named vendors the coordinator must (or should) use. */
  requiredVendors: string[];
  preferredVendors: string[];
  /** A property-specific approval ceiling, if this home has one. */
  propertyThreshold: number | null;
  /** Hard "never do this" statements. */
  restrictions: string[];
};

export function effectsFor(rules: SpecialHandlingRow[]): SpecialHandlingEffects {
  const active = rules.filter((r) => r.active);
  const thresholds = active
    .filter((r) => r.rule_type === "spend_threshold" && r.threshold_amount != null)
    .map((r) => Number(r.threshold_amount));
  return {
    ownerSelfMaintains: active.some((r) => r.rule_type === "owner_self_maintenance"),
    ownerNotificationRequired: active.some(
      (r) => r.rule_type === "owner_notification" || r.owner_notification_required,
    ),
    requiredVendors: active
      .filter((r) => r.rule_type === "required_vendor" && r.vendor_name)
      .map((r) => r.vendor_name as string),
    preferredVendors: active
      .filter((r) => r.rule_type === "preferred_vendor" && r.vendor_name)
      .map((r) => r.vendor_name as string),
    propertyThreshold: thresholds.length ? Math.min(...thresholds) : null,
    restrictions: active.filter((r) => r.rule_type === "restriction").map((r) => r.instruction),
  };
}
