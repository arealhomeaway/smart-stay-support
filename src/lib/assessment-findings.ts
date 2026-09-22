/**
 * Assessment findings — browser-safe shaping only.
 *
 * A finding is what somebody saw at the home during New House Setup, Pre-Work
 * or a Standard Assessment. Recording one always produces a tracked correction
 * task; the database trigger creates it, so the seat, the due date and the
 * photo requirement are decided in exactly one place. The maps below mirror
 * that trigger so the interface can preview what will happen before the person
 * saves — they never decide it.
 */

export const FINDING_CONTEXTS = [
  { value: "new_house_setup", label: "New House Setup" },
  { value: "pre_work", label: "Pre-Work" },
  { value: "standard_assessment", label: "Standard Assessment" },
] as const;

export type FindingContext = (typeof FINDING_CONTEXTS)[number]["value"];

export const FINDING_CATEGORIES = [
  { value: "missing_item", label: "Missing item" },
  { value: "damage", label: "Damage" },
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "appliance", label: "Appliance" },
  { value: "hvac", label: "Heating / cooling" },
  { value: "maintenance", label: "General maintenance" },
  { value: "supplies", label: "Supplies" },
  { value: "inventory", label: "Inventory" },
  { value: "other", label: "Other" },
] as const;

export type FindingCategory = (typeof FINDING_CATEGORIES)[number]["value"];

export const FINDING_SEVERITIES = [
  { value: "urgent", label: "Urgent" },
  { value: "normal", label: "Normal" },
  { value: "minor", label: "Minor" },
] as const;

export type FindingSeverity = (typeof FINDING_SEVERITIES)[number]["value"];

export const CONTEXT_LABEL: Record<string, string> = Object.fromEntries(
  FINDING_CONTEXTS.map((c) => [c.value, c.label]),
);
export const FINDING_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  FINDING_CATEGORIES.map((c) => [c.value, c.label]),
);
export const SEVERITY_LABEL: Record<string, string> = Object.fromEntries(
  FINDING_SEVERITIES.map((s) => [s.value, s.label]),
);

/** Mirrors `create_correction_task_for_finding` in the database. */
export const SEVERITY_DUE_DAYS: Record<FindingSeverity, number> = {
  urgent: 2,
  normal: 7,
  minor: 21,
};

/** Mirrors the seat assignment in `create_correction_task_for_finding`. */
export function seatForFinding(category: string): string {
  if (["plumbing", "electrical", "appliance", "hvac", "damage", "maintenance"].includes(category)) {
    return "ops_supervisor";
  }
  if (["supplies", "missing_item", "inventory"].includes(category)) return "po_day";
  return "project_manager";
}

export function dueDateForFinding(severity: string, from: Date = new Date()): string {
  const days = SEVERITY_DUE_DAYS[(severity as FindingSeverity) in SEVERITY_DUE_DAYS ? (severity as FindingSeverity) : "normal"];
  const due = new Date(from.getTime());
  due.setDate(due.getDate() + days);
  return due.toISOString().slice(0, 10);
}

export function correctionTitle(title: string): string {
  return `Correct: ${title.trim()}`;
}

/**
 * Stable key so the same observation recorded twice does not open a second
 * correction task. Same home, same assessment, same item, same spot.
 */
export function findingKey(input: {
  context: string;
  category: string;
  title: string;
  location?: string | null;
}): string {
  const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
  return [input.context, input.category, norm(input.title), norm(input.location ?? "")].join("|");
}

export type AssessmentFinding = {
  id: string;
  property_id: string;
  context: string;
  category: string;
  title: string;
  detail: string | null;
  location: string | null;
  severity: string;
  photo_url: string | null;
  status: string;
  correction_task_id: string | null;
  created_at: string;
};

export function openFindings(rows: AssessmentFinding[]): AssessmentFinding[] {
  return rows.filter((r) => r.status === "open");
}

export function findingCounts(rows: AssessmentFinding[]) {
  const open = openFindings(rows);
  return {
    total: rows.length,
    open: open.length,
    urgent: open.filter((r) => r.severity === "urgent").length,
    corrected: rows.filter((r) => r.status === "corrected").length,
  };
}
