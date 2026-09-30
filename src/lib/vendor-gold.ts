/**
 * Canonical Vendor domain — pure rules (browser-safe, no data access).
 *
 * One vendor record underneath Directory, Database, Gold Standard, Market
 * Coverage and Needs Review. The database is authoritative for protected
 * fields and the gate rule (private.vendor_orgs_guard); these helpers only
 * mirror them so the UI can explain before the server refuses.
 */

export const DISPATCH_METHODS = ["breezeway", "internal_email", "arha_staff", "setup_incomplete"] as const;
export type DispatchMethod = (typeof DISPATCH_METHODS)[number];
export const DISPATCH_METHOD_LABELS: Record<DispatchMethod, string> = {
  breezeway: "Breezeway",
  internal_email: "Internal Email",
  arha_staff: "ARHA Staff",
  setup_incomplete: "Setup Incomplete",
};

export const PREFERENCES = ["primary", "backup", "other"] as const;
export type Preference = (typeof PREFERENCES)[number];
export const PREFERENCE_LABELS: Record<Preference, string> = {
  primary: "Primary",
  backup: "Backup",
  other: "Other",
};

export const COMPLIANCE_LABELS: Record<string, string> = {
  incomplete: "Incomplete",
  compliant: "Compliant",
  expiring: "Expiring soon",
  non_compliant: "Non-compliant",
};

/* ---------------------------- qualification score ---------------------------- */

export const SCORE_PARTS = [
  { key: "score_capacity", label: "Capacity & market coverage", max: 20 },
  { key: "score_responsiveness", label: "Responsiveness & availability", max: 15 },
  { key: "score_quality", label: "Quality & reliability", max: 20 },
  { key: "score_hospitality", label: "STR / hospitality fit", max: 15 },
  { key: "score_communication", label: "Communication & documentation", max: 10 },
  { key: "score_pricing", label: "Pricing & total value", max: 10 },
  { key: "score_references", label: "References & issue recovery", max: 10 },
] as const;
export type ScoreKey = (typeof SCORE_PARTS)[number]["key"];
export const PILOT_THRESHOLD = 85;

export function qualificationTotal(scores: Partial<Record<ScoreKey, number | null>>): number {
  return SCORE_PARTS.reduce((sum, p) => {
    const v = scores[p.key];
    return sum + (typeof v === "number" ? Math.max(0, Math.min(p.max, v)) : 0);
  }, 0);
}

/**
 * Can this vendor move to the target lifecycle state? A failed gate is never
 * overridden by a score. Mirrors private.vendor_orgs_guard.
 */
export function lifecycleCheck(input: {
  target: string;
  gatesClear: boolean;
  criticalFailure: boolean;
  score: number;
}): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (input.target === "approved" || input.target === "gold") {
    if (!input.gatesClear) reasons.push("A required qualification gate is not complete.");
    if (input.criticalFailure) reasons.push("An open critical failure must be cleared first.");
  }
  if (input.target === "pilot" && input.score < PILOT_THRESHOLD) {
    reasons.push(`Qualification score is ${input.score}; ${PILOT_THRESHOLD}+ is needed for a paid pilot.`);
  }
  return { ok: reasons.length === 0, reasons };
}

/* ---------------------------- protected fields ---------------------------- */

/** Fields the Database view may never rename, archive or delete. */
export const SYSTEM_FIELDS = [
  "id",
  "display_name",
  "status",
  "dispatch_method",
  "breezeway_person_id",
  "source_system",
  "legacy_notion_id",
  "migration_status",
  "created_at",
  "updated_at",
] as const;

/** Only Admin / Director of Operations may change these values. */
export const LEADERSHIP_ONLY_FIELDS = [
  "dispatch_method",
  "breezeway_person_id",
  "source_system",
  "legacy_notion_id",
  "migration_status",
] as const;

/** Gold Standard / compliance: Operations leadership (supervisors, director, admin). */
export const GOLD_FIELDS = [
  "status",
  "compliance_status",
  ...SCORE_PARTS.map((p) => p.key),
  "performance_score",
  "jobs_90d",
  "critical_failure",
  "last_review_on",
  "next_review_on",
  "program_owner",
  "open_corrective_action",
  "corrective_action_due",
] as const;

/** Fields a manager can bulk edit safely from the Database view. */
export const BULK_SAFE_FIELDS = ["is_active", "tags", "payment_terms", "pricing_note", "notes"] as const;

export function isSystemField(key: string) {
  return (SYSTEM_FIELDS as readonly string[]).includes(key);
}

export function customFieldKey(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `cf_${slug || "field"}`;
}

/* ---------------------------- market coverage ---------------------------- */

export type CoverageRow = {
  orgId: string;
  orgName: string;
  market: string;
  category: string;
  preference: Preference;
  status: string;
  isActive: boolean;
};

export type CoverageCell = {
  market: string;
  category: string;
  tier: string;
  primary: CoverageRow[];
  backup: CoverageRow[];
  status: "complete" | "missing_primary" | "missing_backup" | "missing_both";
};

/** Only these lifecycle states count as a qualified Primary/Backup. */
const QUALIFIED = new Set(["pilot", "approved", "gold", "corrective_action"]);

export function coverageMatrix(
  markets: string[],
  categories: { label: string; tier: string }[],
  rows: CoverageRow[],
): CoverageCell[] {
  const cells: CoverageCell[] = [];
  for (const market of markets) {
    for (const cat of categories) {
      const here = rows.filter(
        (r) => r.market === market && r.category === cat.label && r.isActive && QUALIFIED.has(r.status),
      );
      const primary = here.filter((r) => r.preference === "primary");
      const backup = here.filter((r) => r.preference === "backup");
      const status =
        primary.length && backup.length
          ? "complete"
          : !primary.length && !backup.length
            ? "missing_both"
            : !primary.length
              ? "missing_primary"
              : "missing_backup";
      cells.push({ market, category: cat.label, tier: cat.tier, primary, backup, status });
    }
  }
  return cells;
}

export const COVERAGE_STATUS_LABELS: Record<CoverageCell["status"], string> = {
  complete: "Complete",
  missing_primary: "Missing Primary",
  missing_backup: "Missing Backup",
  missing_both: "Missing Primary & Backup",
};

/* ---------------------------- migration staging ---------------------------- */

export const REVIEW_STATES = [
  "ready",
  "possible_duplicate",
  "missing_contact",
  "missing_market",
  "missing_category",
  "needs_dispatch_setup",
  "archive_candidate",
] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];
export const REVIEW_STATE_LABELS: Record<ReviewState, string> = {
  ready: "Ready to Import",
  possible_duplicate: "Possible Duplicate",
  missing_contact: "Missing Contact Info",
  missing_market: "Missing Market",
  missing_category: "Missing Service Category",
  needs_dispatch_setup: "Needs Dispatch Setup",
  archive_candidate: "Inactive / Archive Candidate",
};

export function normalizeName(s: string | null | undefined) {
  return (s ?? "")
    .toLowerCase()
    .replace(/\b(llc|inc|co|corp|company|ltd|the)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}
export function normalizePhone(s: string | null | undefined) {
  const d = (s ?? "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : "";
}
export function normalizeDomain(s: string | null | undefined) {
  return (s ?? "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0]!
    .trim();
}

export type DupeCandidate = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
};

/** Signals only — a human always decides. Never auto-merges. */
export function duplicateMatches(row: DupeCandidate, existing: DupeCandidate[]): string[] {
  const n = normalizeName(row.name);
  const p = normalizePhone(row.phone);
  const e = (row.email ?? "").trim().toLowerCase();
  const w = normalizeDomain(row.website);
  return existing
    .filter((x) => x.id !== row.id)
    .filter(
      (x) =>
        (n && normalizeName(x.name) === n) ||
        (p && normalizePhone(x.phone) === p) ||
        (e && (x.email ?? "").trim().toLowerCase() === e) ||
        (w && normalizeDomain(x.website) === w),
    )
    .map((x) => x.id);
}

export function reviewStatesFor(row: {
  company: string | null;
  phone: string | null;
  email: string | null;
  markets: string[];
  specialties: string[];
  breezewayPersonId?: string | null;
  legacyStatus: string | null;
  duplicates: string[];
}): ReviewState[] {
  const s: ReviewState[] = [];
  if (row.duplicates.length) s.push("possible_duplicate");
  if (!row.phone && !row.email) s.push("missing_contact");
  if (!row.markets.length) s.push("missing_market");
  if (!row.specialties.length) s.push("missing_category");
  // A Notion "in Breezeway" tick is only a hint; a real person ID is required.
  if (!row.breezewayPersonId) s.push("needs_dispatch_setup");
  if (row.legacyStatus && /inactive|archive|do not use|dnu|former/i.test(row.legacyStatus)) {
    s.push("archive_candidate");
  }
  // Dispatch setup alone does not block import; it is finished after import.
  const blocking = s.filter((x) => x !== "needs_dispatch_setup");
  return blocking.length ? s : ["ready", ...s];
}

/* ---------------------------- Notion CSV parsing ---------------------------- */

/** Minimal RFC-4180 CSV parser (quoted fields, commas and newlines inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim()));
}

const NOTION_MAP: Record<string, string> = {
  company: "company",
  name: "company",
  "vendor name": "company",
  "contact person": "contact_person",
  contact: "contact_person",
  market: "markets",
  markets: "markets",
  specialty: "specialties",
  specialties: "specialties",
  "service category": "specialties",
  preference: "preference",
  phone: "phone",
  email: "email",
  pricing: "pricing",
  comments: "comments",
  notes: "comments",
  "payment type": "payment_type",
  website: "website",
  breezeway: "breezeway_hint",
  "in breezeway": "breezeway_hint",
  "vendor status": "legacy_status",
  status: "legacy_status",
  tags: "tags",
  id: "legacy_notion_id",
  "notion id": "legacy_notion_id",
};

export type StagedVendor = {
  company: string | null;
  contact_person: string | null;
  markets: string[];
  specialties: string[];
  preference: string | null;
  phone: string | null;
  email: string | null;
  pricing: string | null;
  comments: string | null;
  payment_type: string | null;
  website: string | null;
  breezeway_hint: boolean | null;
  legacy_status: string | null;
  tags: string[];
  legacy_notion_id: string | null;
  /** Every column not mapped above, kept verbatim for review. */
  legacy_fields: Record<string, string>;
  raw: Record<string, string>;
};

const splitList = (v: string) =>
  v
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean);

export function stageNotionCsv(text: string): StagedVendor[] {
  const [header, ...body] = parseCsv(text);
  if (!header) return [];
  const cols = header.map((h) => h.trim());
  return body.map((cells) => {
    const raw: Record<string, string> = {};
    cols.forEach((h, i) => (raw[h] = (cells[i] ?? "").trim()));
    const out: StagedVendor = {
      company: null,
      contact_person: null,
      markets: [],
      specialties: [],
      preference: null,
      phone: null,
      email: null,
      pricing: null,
      comments: null,
      payment_type: null,
      website: null,
      breezeway_hint: null,
      legacy_status: null,
      tags: [],
      legacy_notion_id: null,
      legacy_fields: {},
      raw,
    };
    for (const [h, v] of Object.entries(raw)) {
      const key = NOTION_MAP[h.toLowerCase()];
      if (!key) {
        if (v) out.legacy_fields[h] = v;
        continue;
      }
      if (!v) continue;
      if (key === "markets" || key === "specialties" || key === "tags") out[key] = splitList(v);
      else if (key === "breezeway_hint") out.breezeway_hint = /^(yes|true|x|✓|checked|1)$/i.test(v);
      else (out as Record<string, unknown>)[key] = v;
    }
    return out;
  });
}
