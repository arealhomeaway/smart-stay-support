/**
 * ARHA Maintenance Authority Policy for Resolve, v3 (decided Nov 7, 2026).
 *
 * Every maintenance dollar threshold, emergency reason and vendor response
 * benchmark lives here. Nothing else in the app restates a number: when
 * leadership changes a threshold this file changes, and each Work Order keeps
 * the version it was decided under (see `policyForVersion`).
 *
 *  - $249 and under: it proceeds and the cost is recorded;
 *  - $250 to $349: the Operations Supervisor approves, the owner is told the same day;
 *  - $350 and up: the Operations Supervisor AND the owner approve before work starts;
 *  - emergencies: mitigate under a documented exception.
 */

export type Priority = "p1" | "p2" | "p3";

export const MAINTENANCE_POLICY_VERSION = "ARHA Maintenance Authority Policy for Resolve v3";

/** How one version of the ladder decides. Older versions keep their own record. */
export type MaintenancePolicyRecord = {
  version: string;
  supervisorApprovalThreshold: number;
  ownerApprovalThreshold: number;
  /** True: exactly the owner amount already needs the owner. */
  ownerThresholdInclusive: boolean;
  /** True: in the owner tier the Operations Supervisor approves as well. */
  supervisorAlsoApprovesOwnerTier: boolean;
  /** True: in the supervisor tier the owner is told the same day. */
  ownerNoticeSameDay: boolean;
};

/**
 * Policy v2, kept so every Work Order stamped with it keeps the result it was
 * decided under: Supervisor from $200, owner only above $350, owner tier
 * without the Supervisor. Never used for new work.
 */
export const MAINTENANCE_POLICY_V2: MaintenancePolicyRecord = {
  version: "ARHA Maintenance Authority Policy for Resolve — v2",
  supervisorApprovalThreshold: 200,
  ownerApprovalThreshold: 350,
  ownerThresholdInclusive: false,
  supervisorAlsoApprovesOwnerTier: false,
  ownerNoticeSameDay: false,
};

export const MAINTENANCE_POLICY = {
  version: MAINTENANCE_POLICY_VERSION,

  /**
   * From this amount up (inclusive) the owner approves before work starts,
   * together with the Operations Supervisor, unless a recorded contractual
   * exception applies.
   */
  ownerApprovalThreshold: 350,

  /**
   * Below this amount ARHA proceeds on its own authority and records the cost.
   * From here up to the owner threshold the Operations Supervisor approves and
   * the owner is told the same day.
   */
  supervisorApprovalThreshold: 250,

  ownerThresholdInclusive: true,
  supervisorAlsoApprovesOwnerTier: true,
  ownerNoticeSameDay: true,

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
  if (amount == null || Number.isNaN(Number(amount))) return "-";
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
 * Who decides a given amount of spend. One ladder for the whole app (v3):
 *
 *  - $249 and under: it proceeds and the cost is recorded;
 *  - $250 to $349: the Operations Supervisor approves, the owner is told the same day;
 *  - $350 and up: the Operations Supervisor and the owner both approve first;
 *  - emergency: mitigation proceeds under a documented exception.
 *
 * A policy without the v3 flags (older versions, and the separate onboarding
 * cost policy) keeps its original rule and wording.
 */
export type AuthorityTier = "proceed" | "supervisor" | "owner" | "emergency";
export type AuthorityPolicy = {
  version: string;
  supervisorApprovalThreshold: number;
  ownerApprovalThreshold: number;
  ownerThresholdInclusive?: boolean;
  supervisorAlsoApprovesOwnerTier?: boolean;
  ownerNoticeSameDay?: boolean;
};

/**
 * The policy a Work Order was decided under. A known older version keeps its
 * own numbers; anything else (new work, unknown or missing) uses the current one.
 */
export function policyForVersion(version: string | null | undefined): AuthorityPolicy {
  if (version && version === MAINTENANCE_POLICY_V2.version && version !== MAINTENANCE_POLICY.version)
    return MAINTENANCE_POLICY_V2;
  return MAINTENANCE_POLICY;
}

/**
 * Missing onboarding configuration uses the onboarding baseline; malformed
 * configuration fails closed. Onboarding cost requests have their own setting
 * and database check, so their baseline stays on the version they use today.
 */
export function readAuthorityPolicy(value: unknown): AuthorityPolicy {
  if (value == null)
    return {
      version: MAINTENANCE_POLICY_V2.version,
      supervisorApprovalThreshold: MAINTENANCE_POLICY_V2.supervisorApprovalThreshold,
      ownerApprovalThreshold: MAINTENANCE_POLICY_V2.ownerApprovalThreshold,
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
      "Enter a policy version and valid supervisor and owner limits, lowest first.",
    );
  }
  return {
    version: policy.version.trim(),
    supervisorApprovalThreshold: policy.supervisorApprovalThreshold,
    ownerApprovalThreshold: policy.ownerApprovalThreshold,
  };
}

export const AUTHORITY_TIER_LABELS: Record<AuthorityTier, string> = {
  proceed: "Proceed: no approval needed",
  supervisor: "Supervisor approval",
  owner: "Homeowner approval",
  emergency: "Emergency exception",
};

/** True when this amount is in the owner tier under the given policy. */
export function inOwnerTier(value: number, policy: AuthorityPolicy = MAINTENANCE_POLICY): boolean {
  return policy.ownerThresholdInclusive
    ? value >= policy.ownerApprovalThreshold
    : value > policy.ownerApprovalThreshold;
}

export function authorityTier(
  amount: number | null | undefined,
  options: { emergency?: boolean; policy?: AuthorityPolicy } = {},
): AuthorityTier {
  if (options.emergency) return "emergency";
  const value = Number(amount ?? 0);
  const policy = options.policy ?? MAINTENANCE_POLICY;
  if (!Number.isFinite(value) || value < policy.supervisorApprovalThreshold) return "proceed";
  if (inOwnerTier(value, policy)) return "owner";
  return "supervisor";
}

/** "$249", from a $250 limit: the last whole dollar below a limit. */
function dollarBelow(limit: number) {
  return money(Math.ceil(limit) - 1);
}

/** The v3 ladder in plain words, one line per tier, in order. */
export function plainLadderLines(policy: AuthorityPolicy = MAINTENANCE_POLICY): string[] {
  const sup = policy.supervisorApprovalThreshold;
  const own = policy.ownerApprovalThreshold;
  const ownerTier = policy.supervisorAlsoApprovesOwnerTier
    ? "the Operations Supervisor and the owner both approve before work starts"
    : "the owner approves before work starts";
  const notice = policy.ownerNoticeSameDay ? "the owner is told the same day" : "the owner is told afterwards";
  return [
    `${dollarBelow(sup)} and under: it proceeds and the cost is recorded.`,
    `${money(sup)} to ${dollarBelow(own)}: the Operations Supervisor approves and ${notice}.`,
    `${money(own)} and up: ${ownerTier}.`,
    `Emergencies: mitigate under a documented exception.`,
  ];
}

/** Plain-language sentence for the tier a given amount falls into. */
export function authorityGuidance(
  amount: number | null | undefined,
  options: { emergency?: boolean; policy?: AuthorityPolicy } = {},
): string {
  const tier = authorityTier(amount, options);
  const policy = options.policy ?? MAINTENANCE_POLICY;
  if (policy.ownerThresholdInclusive) {
    const lines = plainLadderLines(policy);
    switch (tier) {
      case "emergency":
        return `Emergencies: mitigate now under a documented exception. Record the reason, scope, amount, who decided and evidence. Anything beyond stopping the immediate problem follows the normal ladder.`;
      case "proceed":
        return lines[0] as string;
      case "supervisor":
        return lines[1] as string;
      case "owner":
        return lines[2] as string;
    }
  }
  const sup = money(policy.supervisorApprovalThreshold);
  const own = money(policy.ownerApprovalThreshold);
  switch (tier) {
    case "emergency":
      return `Emergency: mitigate now and record the exception. Reason, scope, amount, who decided and evidence. Anything beyond stopping the immediate problem still follows the normal ladder.`;
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
  if (policy.ownerThresholdInclusive) return plainLadderLines(policy);
  const sup = money(policy.supervisorApprovalThreshold);
  const own = money(policy.ownerApprovalThreshold);
  return [
    `Under ${sup}. Proceed, record the cost.`,
    `${sup} to ${own}. Supervisor approves, homeowner is told afterwards.`,
    `Above ${own}. Homeowner approves before work starts.`,
    `Emergency: mitigate now under a documented exception: reason, scope, amount, who decided, evidence.`,
  ];
}

/** The help line above a Work Order's owner approval section. */
export function ownerApprovalHelp(policy: AuthorityPolicy = MAINTENANCE_POLICY): string {
  if (policy.ownerThresholdInclusive)
    return `${plainLadderLines(policy)[2]} Emergency work to stop damage can go ahead; approval is for the permanent fix. Notified is not the same as approved.`;
  return "Repairs over the owner approval limit need the owner's approval. Emergency work to stop damage can go ahead; approval is for the permanent fix. Notified is not the same as approved.";
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
  for (const flag of ["ownerThresholdInclusive", "supervisorAlsoApprovesOwnerTier", "ownerNoticeSameDay"]) {
    target[flag] = v[flag] === true;
  }
  if (typeof v['version'] === "string" && v['version']) target["version"] = v['version'];
  return true;
}
