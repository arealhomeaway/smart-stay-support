/**
 * ARHA Maintenance Authority Policy for Resolve — v2.
 *
 * Every maintenance dollar threshold, emergency reason and vendor response
 * benchmark lives here. Nothing else in the app restates a number: when
 * leadership changes a threshold this file changes, and each Work Order keeps
 * the version it was decided under.
 */

export type Priority = "p1" | "p2" | "p3";

export const MAINTENANCE_POLICY_VERSION = "ARHA Maintenance Authority Policy for Resolve — v2";

export const MAINTENANCE_POLICY = {
  version: MAINTENANCE_POLICY_VERSION,

  /**
   * ARHA may proceed with a permanent repair up to this amount under normal
   * management authority. Above it, the owner decides — unless a recorded
   * contractual exception applies.
   */
  ownerApprovalThreshold: 350,

  /**
   * Below this amount ARHA proceeds on its own authority and records the cost.
   * From here up to the owner threshold a supervisor decides and the owner is
   * told afterwards.
   */
  supervisorApprovalThreshold: 200,

  /** Vendor contact and acknowledgment benchmarks, in minutes, by priority. */
  vendorContactMinutes: { p1: 10, p2: 30, p3: 120 } as Record<Priority, number>,
  vendorAcknowledgeMinutes: { p1: 10, p2: 30, p3: 120 } as Record<Priority, number>,
  /** A credible service plan is expected within this many minutes on a P2. */
  servicePlanMinutes: { p1: 30, p2: 120, p3: 480 } as Record<Priority, number>,

  /** First miss: the coordinator follows up. */
  missFollowUp: 1,
  /** Second miss: James is notified and a backup vendor is considered. */
  missNotifySupervisor: 2,
  /** Third or repeated miss: vendor performance review with Micah. */
  missPerformanceReview: 3,
} as const;

/* ------------------------------------------------------------------ */
/* Emergency mitigation                                                */
/* ------------------------------------------------------------------ */

/**
 * Conditions where delay reasonably risks harm, so mitigation may proceed
 * before any owner approval. Authority covers stopping or containing the
 * immediate issue — never the full permanent repair.
 */
export type EmergencyReason =
  | "active_property_damage"
  | "guest_safety"
  | "security"
  | "essential_utility_loss"
  | "water_intrusion"
  | "sewage_exposure"
  | "fire_smoke_hazard"
  | "dangerous_hvac"
  | "cannot_secure_property";

export const EMERGENCY_REASON_LABELS: Record<EmergencyReason, string> = {
  active_property_damage: "Active property damage",
  guest_safety: "Guest safety",
  security: "Property security",
  essential_utility_loss: "Loss of an essential utility",
  water_intrusion: "Worsening water intrusion",
  sewage_exposure: "Sewage exposure",
  fire_smoke_hazard: "Fire or smoke hazard",
  dangerous_hvac: "Dangerous HVAC condition",
  cannot_secure_property: "Property cannot be secured",
};

/** The clause Resolve uses when explaining why mitigation may proceed. */
export const EMERGENCY_REASON_CLAUSES: Record<EmergencyReason, string> = {
  active_property_damage: "stop active property damage",
  guest_safety: "protect guest safety",
  security: "restore property security",
  essential_utility_loss: "restore an essential utility",
  water_intrusion: "stop worsening water intrusion",
  sewage_exposure: "contain sewage exposure",
  fire_smoke_hazard: "remove a fire or smoke hazard",
  dangerous_hvac: "make a dangerous HVAC condition safe",
  cannot_secure_property: "secure the property",
};

export const EMERGENCY_REASONS = Object.keys(EMERGENCY_REASON_LABELS) as EmergencyReason[];

/* ------------------------------------------------------------------ */
/* Warranty override reasons                                           */
/* ------------------------------------------------------------------ */

/** Why a human chose not to keep waiting on a warranty route. */
export type WarrantyOverrideReason =
  | "current_guest_affected"
  | "next_reservation_affected"
  | "eta_too_slow"
  | "mitigation_inadequate"
  | "damage_risk";

export const WARRANTY_OVERRIDE_LABELS: Record<WarrantyOverrideReason, string> = {
  current_guest_affected: "Current guest is materially affected",
  next_reservation_affected: "Next reservation will be affected",
  eta_too_slow: "Warranty appointment is too far out",
  mitigation_inadequate: "Temporary mitigation is not adequate",
  damage_risk: "Waiting risks greater property damage",
};

/* ------------------------------------------------------------------ */
/* Second-quote signals                                                */
/* ------------------------------------------------------------------ */

/** Soft signals that a comparison quote is worth getting. Never a block. */
export type SecondQuoteSignal =
  | "approaches_replacement"
  | "quotes_differ"
  | "owner_requested"
  | "diagnosis_uncertain"
  | "unusually_high";

export const SECOND_QUOTE_LABELS: Record<SecondQuoteSignal, string> = {
  approaches_replacement: "Estimate approaches replacement cost",
  quotes_differ: "Quotes differ materially",
  owner_requested: "Owner asked for a comparison",
  diagnosis_uncertain: "Diagnosis is not yet certain",
  unusually_high: "Estimate is unusually high for this work",
};

export function money(amount: number | null | undefined) {
  if (amount == null || Number.isNaN(Number(amount))) return "—";
  return `$${Number(amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function minutesSince(iso: string | null | undefined, now = new Date()) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((now.getTime() - then) / 60000);
}

export function normalisePriority(value: string | null | undefined): Priority {
  return value === "p1" || value === "p2" ? value : "p3";
}

/* ------------------------------------------------------------------ */
/* Spend authority ladder                                              */
/* ------------------------------------------------------------------ */

/**
 * Who decides a given amount of spend. One ladder for the whole app:
 *
 *  - under $200 — ARHA proceeds, cost recorded;
 *  - $200 to $350 — supervisor decides, homeowner told afterwards;
 *  - above $350 — the homeowner decides before work starts;
 *  - emergency — mitigation proceeds under a documented exception.
 */
export type AuthorityTier = "proceed" | "supervisor" | "owner" | "emergency";
export type AuthorityPolicy = {
  version: string;
  supervisorApprovalThreshold: number;
  ownerApprovalThreshold: number;
};

/** Missing configuration uses the approved baseline; malformed configuration fails closed. */
export function readAuthorityPolicy(value: unknown): AuthorityPolicy {
  if (value == null)
    return {
      version: MAINTENANCE_POLICY.version,
      supervisorApprovalThreshold: MAINTENANCE_POLICY.supervisorApprovalThreshold,
      ownerApprovalThreshold: MAINTENANCE_POLICY.ownerApprovalThreshold,
    };
  if (typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid authority policy configuration.");
  const policy = value as Partial<AuthorityPolicy>;
  if (
    typeof policy.version !== "string" ||
    !policy.version.trim() ||
    policy.version.length > 120 ||
    typeof policy.supervisorApprovalThreshold !== "number" ||
    typeof policy.ownerApprovalThreshold !== "number" ||
    !Number.isFinite(policy.supervisorApprovalThreshold) ||
    !Number.isFinite(policy.ownerApprovalThreshold) ||
    policy.supervisorApprovalThreshold < 0 ||
    policy.ownerApprovalThreshold < policy.supervisorApprovalThreshold ||
    policy.ownerApprovalThreshold > 1000000
  ) {
    throw new Error(
      "Enter a policy version and valid supervisor/owner thresholds in ascending order.",
    );
  }
  return {
    version: policy.version.trim(),
    supervisorApprovalThreshold: policy.supervisorApprovalThreshold,
    ownerApprovalThreshold: policy.ownerApprovalThreshold,
  };
}

export const AUTHORITY_TIER_LABELS: Record<AuthorityTier, string> = {
  proceed: "Proceed — no approval needed",
  supervisor: "Supervisor approval",
  owner: "Homeowner approval",
  emergency: "Emergency exception",
};

export function authorityTier(
  amount: number | null | undefined,
  options: { emergency?: boolean; policy?: AuthorityPolicy } = {},
): AuthorityTier {
  if (options.emergency) return "emergency";
  const value = Number(amount ?? 0);
  const policy = options.policy ?? MAINTENANCE_POLICY;
  if (!Number.isFinite(value) || value < policy.supervisorApprovalThreshold) return "proceed";
  if (value <= policy.ownerApprovalThreshold) return "supervisor";
  return "owner";
}

/** Plain-language sentence for the tier a given amount falls into. */
export function authorityGuidance(
  amount: number | null | undefined,
  options: { emergency?: boolean; policy?: AuthorityPolicy } = {},
): string {
  const tier = authorityTier(amount, options);
  const sup = money((options.policy ?? MAINTENANCE_POLICY).supervisorApprovalThreshold);
  const own = money((options.policy ?? MAINTENANCE_POLICY).ownerApprovalThreshold);
  switch (tier) {
    case "emergency":
      return `Emergency: mitigate now and record the exception — reason, scope, amount, who decided and evidence. Anything beyond stopping the immediate problem still follows the normal ladder.`;
    case "proceed":
      return `Under ${sup}: proceed without supervisor or homeowner approval and record the cost.`;
    case "supervisor":
      return `${sup} to ${own}: a supervisor approves before the work starts, and the homeowner is told afterwards.`;
    case "owner":
      return `Above ${own}: the homeowner decides before the work starts.`;
  }
}

/** The full ladder, for guidance panels that explain it up front. */
export function authorityLadder(policy: AuthorityPolicy = MAINTENANCE_POLICY): string[] {
  const sup = money(policy.supervisorApprovalThreshold);
  const own = money(policy.ownerApprovalThreshold);
  return [
    `Under ${sup} — proceed, record the cost.`,
    `${sup} to ${own} — supervisor approves, homeowner is told afterwards.`,
    `Above ${own} — homeowner approves before work starts.`,
    `Emergency — mitigate now under a documented exception: reason, scope, amount, who decided, evidence.`,
  ];
}

/**
 * The stored policy (app_settings `maintenance_authority_policy`) is the one
 * authoritative copy: the database enforces it for Finance, and the app shell
 * loads it here on sign-in so every screen evaluates the same numbers. The
 * literals above are only a fallback until that load completes.
 */
export function applyStoredMaintenancePolicy(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const sup = Number(v["supervisorApprovalThreshold"]);
  const own = Number(v["ownerApprovalThreshold"]);
  if (!Number.isFinite(sup) || !Number.isFinite(own) || sup < 0 || own < sup) return false;
  const target = MAINTENANCE_POLICY as unknown as Record<string, unknown>;
  target["supervisorApprovalThreshold"] = sup;
  target["ownerApprovalThreshold"] = own;
  if (typeof v['version'] === "string" && v['version']) target["version"] = v['version'];
  return true;
}
