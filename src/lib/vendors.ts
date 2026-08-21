/**
 * Vendor company model (browser-safe).
 *
 * A vendor is a COMPANY, not a person. People sit inside a company as members
 * with a masked code, so ARHA schedules "ModMaids — MM-014" and never a
 * worker's personal name. Nothing here reaches the database; these are the
 * shared labels and pure helpers the UI and the server both read from.
 */

export const VENDOR_STATUSES = [
  "potential",
  "screening",
  "trial",
  "approved",
  "restricted",
  "paused",
  "removed",
  "legacy",
] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  potential: "Potential",
  screening: "Screening",
  trial: "Trial",
  approved: "Approved",
  restricted: "Restricted",
  paused: "Paused",
  removed: "Removed",
  legacy: "Legacy (imported)",
};

export const VENDOR_STATUS_BLURBS: Record<VendorStatus, string> = {
  potential: "Sourced but not contacted or screened. Cannot be dispatched.",
  screening: "Gatekeeper items in progress. Cannot be dispatched.",
  trial: "Cleared to take a limited number of scored trial jobs.",
  approved: "Cleared for normal dispatch inside their approved markets.",
  restricted: "Dispatch only with supervisor sign-off. Reason is on the record.",
  paused: "Temporarily out of rotation. Existing work stands.",
  removed: "No longer used. History is kept for the record.",
  legacy: "Imported from a legacy system and not yet verified.",
};

/** Only these can be sent work, and trial only within its job budget. */
export const DISPATCHABLE_STATUSES: VendorStatus[] = ["approved", "trial", "restricted"];

export const VENDOR_CLASSES = ["company", "sole_operator", "internal_team"] as const;
export type VendorClass = (typeof VENDOR_CLASSES)[number];

export const VENDOR_CLASS_LABELS: Record<VendorClass, string> = {
  company: "Company",
  sole_operator: "Sole operator",
  internal_team: "Internal team",
};

export const SERVICE_CATEGORIES = [
  "Cleaning",
  "Inspection",
  "Maintenance",
  "Handyman",
  "HVAC",
  "Plumbing",
  "Electrical",
  "Appliance",
  "Pest control",
  "Landscaping",
  "Pool & spa",
  "Trash valet",
  "Locks & access",
  "Flooring",
  "Painting",
  "Roofing",
  "Restoration",
  "Photography",
  "Other",
] as const;

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
] as const;
export type GatekeeperResult = (typeof GATEKEEPER_RESULTS)[number];

export const GATEKEEPER_RESULT_LABELS: Record<GatekeeperResult, string> = {
  not_verified: "Not verified",
  verified_meets: "Verified & meets",
  verified_does_not_meet: "Verified & does not meet",
  not_applicable: "Not applicable",
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
};

/** Expiry is a fail, not a footnote: an expired item reads as not verified. */
export function effectiveResult(line: GatekeeperLine, today = new Date()): GatekeeperResult {
  if (line.result !== "verified_meets") return line.result;
  if (!line.expiresOn) return line.result;
  return new Date(`${line.expiresOn}T23:59:59Z`) < today ? "not_verified" : line.result;
}

/** Can this company be approved? Every blocking line must be verified & meets. */
export function gatekeeperReadiness(lines: GatekeeperLine[], today = new Date()) {
  const blockers = lines.filter((l) => l.level === "blocking");
  const failing = blockers.filter((l) => effectiveResult(l, today) !== "verified_meets");
  const required = lines.filter((l) => l.level === "required");
  const requiredOpen = required.filter((l) => effectiveResult(l, today) === "not_verified");
  return {
    clear: failing.length === 0,
    blockersFailing: failing,
    requiredOpen,
    passed: lines.filter((l) => effectiveResult(l, today) === "verified_meets").length,
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
