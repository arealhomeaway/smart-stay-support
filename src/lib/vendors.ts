import { TRADES } from "@/lib/taxonomy";

/**
 * Vendor company model (browser-safe).
 *
 * A vendor is a COMPANY, not a person. People sit inside a company as members
 * with a masked code, so ARHA schedules "ModMaids — MM-014" and never a
 * worker's personal name. Nothing here reaches the database; these are the
 * shared labels and pure helpers the UI and the server both read from.
 */

/**
 * Gold Standard / Qualification Status. Operational Active/Inactive is a
 * separate flag (vendor_orgs.is_active) so qualification history survives
 * when ARHA stops using a vendor.
 */
export const VENDOR_STATUSES = [
  "candidate",
  "pilot",
  "approved",
  "gold",
  "corrective_action",
  "suspended",
] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  candidate: "Candidate",
  pilot: "Pilot",
  approved: "Approved",
  gold: "Gold",
  corrective_action: "Corrective Action",
  suspended: "Suspended",
};

export const VENDOR_STATUS_BLURBS: Record<VendorStatus, string> = {
  candidate: "Sourced or in qualification. Cannot be dispatched yet.",
  pilot: "Qualified (85+) and cleared for a limited paid pilot.",
  approved: "Every required gate passed. Cleared for normal dispatch in their markets.",
  gold: "Top-performing approved vendor. Preferred for dispatch.",
  corrective_action: "Dispatch only with supervisor sign-off while a corrective action is open.",
  suspended: "Out of rotation. Existing work stands; history is kept.",
};

/** Only these can be sent work; Corrective Action needs supervisor sign-off. */
export const OPERATIONAL_STATUS_LABELS = { active: "Active", inactive: "Inactive" } as const;

export const DISPATCHABLE_STATUSES: VendorStatus[] = ["pilot", "approved", "gold", "corrective_action"];

export const VENDOR_CLASSES = ["company", "sole_operator", "internal_team"] as const;
export type VendorClass = (typeof VENDOR_CLASSES)[number];

export const VENDOR_CLASS_LABELS: Record<VendorClass, string> = {
  company: "Company",
  sole_operator: "Sole operator",
  internal_team: "Internal team",
};

// The same trade list Work Orders use, so a vendor's approved trades and the
// work sent to them are never written two different ways. See src/lib/taxonomy.ts.
export const SERVICE_CATEGORIES = TRADES.map((t) => t.label);

export const VENDOR_ROLES = ["admin", "dispatcher", "team_member"] as const;
export type VendorRole = (typeof VENDOR_ROLES)[number];

export const VENDOR_ROLE_LABELS: Record<VendorRole, string> = {
  admin: "Vendor admin",
  dispatcher: "Dispatcher",
  team_member: "Team member",
};

export const COVERAGE_PRIORITIES = ["primary", "backup", "emergency", "recurring"] as const;
export type CoveragePriority = (typeof COVERAGE_PRIORITIES)[number];

export const COVERAGE_PRIORITY_LABELS: Record<CoveragePriority, string> = {
  primary: "Primary",
  backup: "Backup",
  emergency: "Emergency",
  recurring: "Recurring",
};

/** Gatekeeper outcomes. "Not verified" never counts as a pass. */
export const GATEKEEPER_RESULTS = [
  "not_verified",
  "verified_meets",
  "verified_does_not_meet",
  "not_applicable",
  "equivalent_verified",
] as const;
export type GatekeeperResult = (typeof GATEKEEPER_RESULTS)[number];

export const GATEKEEPER_RESULT_LABELS: Record<GatekeeperResult, string> = {
  not_verified: "Not verified",
  verified_meets: "Verified & meets",
  verified_does_not_meet: "Verified & does not meet",
  not_applicable: "Not applicable",
  equivalent_verified: "Equivalent verified",
};

export const REQUIREMENT_LEVELS = ["blocking", "required", "optional", "not_applicable"] as const;
export type RequirementLevel = (typeof REQUIREMENT_LEVELS)[number];

export const REQUIREMENT_LEVEL_LABELS: Record<RequirementLevel, string> = {
  blocking: "Blocking",
  required: "Required",
  optional: "Optional",
  not_applicable: "Not applicable",
};

export type GatekeeperLine = {
  requirementId: string;
  code: string;
  label: string;
  detail: string | null;
  level: RequirementLevel;
  result: GatekeeperResult;
  note: string | null;
  verifiedAt: string | null;
  expiresOn: string | null;
  /** Only gates the Gold Standard explicitly permits may use these. */
  allowsNotApplicable?: boolean;
  allowsEquivalent?: boolean;
  exceptionRule?: string | null;
  /** Insurance/licences: an expiration date is required, and expiry fails the gate. */
  expiryRequired?: boolean;
  /** A supporting document or written reference is required to pass. */
  evidenceRequired?: boolean;
  verifiedByName?: string | null;
  documentId?: string | null;
  documentTitle?: string | null;
  evidenceReference?: string | null;
  /** Reason/documentation for Not Applicable or Equivalent Verified. */
  exceptionReason?: string | null;
};

/** Which results staff may pick for this gate. Mandatory gates never offer N/A. */
export function allowedResults(line: Pick<GatekeeperLine, "allowsNotApplicable" | "allowsEquivalent">): GatekeeperResult[] {
  return GATEKEEPER_RESULTS.filter(
    (r) =>
      (r !== "not_applicable" || !!line.allowsNotApplicable) &&
      (r !== "equivalent_verified" || !!line.allowsEquivalent),
  );
}

/** Does this line count as passed? Exceptions only count where permitted. */
export function linePasses(line: GatekeeperLine, today = new Date()): boolean {
  const r = effectiveResult(line, today);
  if (r === "verified_meets") return true;
  if (r === "not_applicable") return !!line.allowsNotApplicable;
  if (r === "equivalent_verified") return !!line.allowsEquivalent;
  return false;
}

/** Expiry is a fail, not a footnote: an expired item reads as not verified. */
export function effectiveResult(line: GatekeeperLine, today = new Date()): GatekeeperResult {
  if (line.result !== "verified_meets" && line.result !== "equivalent_verified") return line.result;
  if (!line.expiresOn) return line.expiryRequired ? "not_verified" : line.result;
  return new Date(`${line.expiresOn}T23:59:59Z`) < today ? "not_verified" : line.result;
}

export type GateState = "passed" | "expired" | "missing_expiry" | "failed" | "not_verified";

/** The plain-language state a person sees for one gate. */
export function gateState(line: GatekeeperLine, today = new Date()): GateState {
  if (linePasses(line, today)) return "passed";
  if ((line.result === "verified_meets" || line.result === "equivalent_verified")) {
    if (!line.expiresOn && line.expiryRequired) return "missing_expiry";
    if (line.expiresOn) return "expired";
  }
  if (line.result === "verified_does_not_meet") return "failed";
  return "not_verified";
}

export const GATE_STATE_LABELS: Record<GateState, string> = {
  passed: "Passed",
  expired: "Expired — not passing",
  missing_expiry: "Needs expiration date",
  failed: "Does not meet",
  not_verified: "Not verified",
};

/** Can this company be approved? Every blocking line must be verified & meets. */
export function gatekeeperReadiness(lines: GatekeeperLine[], today = new Date()) {
  const blockers = lines.filter((l) => l.level === "blocking");
  const failing = blockers.filter((l) => !linePasses(l, today));
  const required = lines.filter((l) => l.level === "required");
  const requiredOpen = required.filter((l) => effectiveResult(l, today) === "not_verified");
  return {
    clear: failing.length === 0,
    blockersFailing: failing,
    requiredOpen,
    passed: lines.filter((l) => linePasses(l, today)).length,
    total: lines.length,
  };
}

/**
 * Google reputation gate. A rating never approves anyone — it only decides how
 * much extra evidence ARHA needs before a trial.
 */
export function reputationGate(rating: number | null, reviews: number | null) {
  if (rating == null || reviews == null || reviews === 0) {
    return {
      band: "no_profile" as const,
      headline: "No Google profile",
      requirement:
        "Needs a trusted referral, two verified references and a controlled trial before approval.",
    };
  }
  if (rating < 4.0) {
    return {
      band: "below_bar" as const,
      headline: `${rating.toFixed(1)} stars — below the 4.0 bar`,
      requirement: "Needs a documented executive exception before any trial.",
    };
  }
  if (reviews >= 20) {
    return {
      band: "clear" as const,
      headline: `${rating.toFixed(1)} stars across ${reviews} reviews`,
      requirement: "Meets the reputation screen. Gatekeeper items still apply.",
    };
  }
  if (reviews >= 5) {
    return {
      band: "thin" as const,
      headline: `${rating.toFixed(1)} stars across only ${reviews} reviews`,
      requirement: "Thin review history: needs stronger references plus a controlled trial.",
    };
  }
  return {
    band: "very_thin" as const,
    headline: `Only ${reviews} review${reviews === 1 ? "" : "s"}`,
    requirement: "Needs a trusted referral, two verified references and a controlled trial.",
  };
}

/** MM-014 style. Initials from the company, sequence from the team size. */
export function maskedCodeFor(displayName: string, sequence: number) {
  const initials =
    displayName
      .replace(/[^A-Za-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "VN";
  return `${initials}-${String(sequence).padStart(3, "0")}`;
}

/** Nothing about a worker leaves the vendor's own company except this. */
export function maskedLabel(orgName: string, code: string) {
  return `${orgName} — ${code}`;
}

export type VendorOrgRow = {
  id: string;
  displayName: string;
  legalName: string;
  vendorClass: VendorClass;
  status: VendorStatus;
  serviceCategories: string[];
  markets: string[];
  legacyAllGroups: boolean;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  emergencyAvailable: boolean;
  googleRating: number | null;
  googleReviewCount: number | null;
  memberCount: number;
  coverageCount: number;
  gatekeeperPassed: number;
  gatekeeperTotal: number;
  gatekeeperClear: boolean;
  lastVerifiedAt: string | null;
};

/* ------------------------------------------------------------------ */
/* Territory coverage                                                  */
/* ------------------------------------------------------------------ */

/** US 5-digit ZIP. ZIP+4 is trimmed; anything else is rejected by the caller. */
export function normalizeZip(raw: string): string | null {
  const digits = raw.trim().replace(/[^0-9]/g, "");
  if (digits.length < 5) return null;
  return digits.slice(0, 5);
}

/** Pull every ZIP out of a pasted territory list, map export or spreadsheet column. */
export function parseZipList(raw: string): { zips: string[]; rejected: string[] } {
  const seen = new Set<string>();
  const rejected: string[] = [];
  for (const token of raw.split(/[\s,;|]+/).filter(Boolean)) {
    const zip = normalizeZip(token);
    if (zip) seen.add(zip);
    else rejected.push(token);
  }
  return { zips: [...seen].sort(), rejected };
}

export type CoverageSource = "property" | "territory" | "none";

/**
 * Who covers this home for this trade?
 *
 * The territory sets the default; the home has the final word. An explicit
 * property row wins over any ZIP match — including a row that excludes the
 * vendor from that one home while their territory still covers the rest.
 */
export function resolveCoverage(input: {
  propertyRow?: { coveragePriority: string; excluded: boolean } | undefined;
  territoryRow?: { coveragePriority: string } | undefined;
}): { covered: boolean; source: CoverageSource; priority: string | null; reason: string } {
  if (input.propertyRow) {
    if (input.propertyRow.excluded) {
      return {
        covered: false,
        source: "property",
        priority: null,
        reason: "Excluded at this home, overriding their territory.",
      };
    }
    return {
      covered: true,
      source: "property",
      priority: input.propertyRow.coveragePriority,
      reason: "Assigned to this home directly.",
    };
  }
  if (input.territoryRow) {
    return {
      covered: true,
      source: "territory",
      priority: input.territoryRow.coveragePriority,
      reason: "Covered by their service territory.",
    };
  }
  return { covered: false, source: "none", priority: null, reason: "Outside their coverage." };
}

export type ServiceAreaRow = {
  id: string;
  serviceCategory: string;
  postalCode: string;
  territoryLabel: string | null;
  coveragePriority: string;
  travelNote: string | null;
  propertyCount: number;
};
