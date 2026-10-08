/**
 * Plan step rules (browser-safe, pure): relative due-date anchors, business-day
 * offsets and structured step conditions. The database plan creator
 * (`instantiate_onboarding_v2`) and the date recalculation mirror these rules;
 * tests pin both to the same examples.
 *
 * Business days are Monday–Friday. No holiday calendar exists in Resolve, so
 * none is applied.
 */

export const PLAN_ANCHORS = [
  { value: "project_created", label: "Project created" },
  { value: "planned_closing", label: "Planned closing" },
  { value: "actual_access", label: "Confirmed access date" },
  { value: "target_handoff", label: "Target handoff" },
] as const;

/** Older steps may still follow actual closing; kept readable, not offered for new rules. */
export type PlanAnchor = (typeof PLAN_ANCHORS)[number]["value"] | "actual_closing";
export type OffsetUnit = "calendar" | "business";

export function anchorLabel(anchor: string | null | undefined) {
  if (anchor === "actual_closing") return "Actual closing";
  return PLAN_ANCHORS.find((a) => a.value === anchor)?.label ?? "No date rule";
}

export function isPlanAnchor(v: unknown): v is PlanAnchor {
  return v === "actual_closing" || PLAN_ANCHORS.some((a) => a.value === v);
}

function parse(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
const fmt = (d: Date) => d.toISOString().slice(0, 10);

export function addCalendarDays(iso: string, days: number) {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fmt(d);
}

/** Positive, zero or negative business days (Mon–Fri). Zero keeps the anchor date. */
export function addBusinessDays(iso: string, days: number) {
  const d = parse(iso);
  const step = days < 0 ? -1 : 1;
  let left = Math.abs(days);
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + step);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) left -= 1;
  }
  return fmt(d);
}

export function dueFromRule(
  anchorDate: string | null | undefined,
  offset: number | null | undefined,
  unit: OffsetUnit = "calendar",
): string | null {
  if (!anchorDate || offset === null || offset === undefined) return null;
  return unit === "business" ? addBusinessDays(anchorDate, offset) : addCalendarDays(anchorDate, offset);
}

export function describeRule(anchor: string | null, offset: number | null, unit: OffsetUnit) {
  if (!anchor || offset === null) return "No date rule";
  const word = unit === "business" ? "business day" : "day";
  const n = Math.abs(offset);
  if (offset === 0) return `On ${anchorLabel(anchor).toLowerCase()}`;
  return `${n} ${word}${n === 1 ? "" : "s"} ${offset < 0 ? "before" : "after"} ${anchorLabel(anchor).toLowerCase()}`;
}

/* ------------------------------------------------------------ conditions */

/** Stable values only — free-form labels never drive behavior. */
export const CONDITION_OPTIONS = [
  { field: "furnishing_scope", value: "full_furnishing", label: "Furnishing Package selected" },
  { field: "furnishing_scope", value: "owner_furnished", label: "Owner furnished" },
  { field: "furnishing_scope", value: "no_furnishing", label: "Existing home (no furnishing)" },
  { field: "module", value: "pool", label: "Pool at the property" },
  { field: "module", value: "hoa", label: "HOA" },
  { field: "module", value: "new_appliances", label: "New appliances" },
  { field: "module", value: "existing_appliances", label: "Existing appliances" },
  { field: "module", value: "smart_lock", label: "Smart lock" },
  { field: "module", value: "cameras", label: "Cameras" },
  { field: "module", value: "landscaping", label: "Landscaping" },
  { field: "module", value: "active_owner", label: "Active Owner" },
] as const;

export type ConditionClause = { field: "furnishing_scope" | "module"; value: string };
export type StepCondition = { all: ConditionClause[] } | null;

const key = (c: ConditionClause) => `${c.field}=${c.value}`;

export function isKnownClause(c: ConditionClause) {
  return CONDITION_OPTIONS.some((o) => o.field === c.field && o.value === c.value);
}

/** Reads stored JSON; unknown clauses are kept and reported, never silently dropped. */
export function readCondition(raw: unknown): { condition: StepCondition; unknown: ConditionClause[] } {
  const all = (raw as { all?: unknown } | null)?.all;
  if (!Array.isArray(all) || all.length === 0) return { condition: null, unknown: [] };
  const clauses = all
    .filter((c): c is ConditionClause => !!c && typeof c === "object" && "field" in c && "value" in c)
    .map((c) => ({ field: c.field, value: String(c.value) }) as ConditionClause);
  return { condition: { all: clauses }, unknown: clauses.filter((c) => !isKnownClause(c)) };
}

export function clauseLabel(c: ConditionClause) {
  return CONDITION_OPTIONS.find((o) => o.field === c.field && o.value === c.value)?.label ?? `Unknown: ${key(c)}`;
}

export function describeCondition(condition: StepCondition) {
  if (!condition?.all.length) return "Applies to every home using this template";
  return "Only when " + condition.all.map(clauseLabel).join(" AND ");
}

export type ProjectScope = { furnishing_scope: string | null; modules: string[] | null };

/** A step with no conditions applies to every project; otherwise ALL clauses must hold. */
export function stepApplies(condition: StepCondition, project: ProjectScope) {
  if (!condition?.all.length) return true;
  return condition.all.every((c) =>
    c.field === "furnishing_scope"
      ? project.furnishing_scope === c.value
      : (project.modules ?? []).includes(c.value),
  );
}

/** CSV form: "furnishing_scope=full_furnishing; module=pool". */
export function conditionToCsv(condition: StepCondition) {
  return condition?.all.map(key).join("; ") ?? "";
}

export function conditionFromCsv(text: string): { condition: StepCondition; error: string | null } {
  const parts = text.split(";").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return { condition: null, error: null };
  const clauses: ConditionClause[] = [];
  for (const p of parts) {
    const [field, value] = p.split("=").map((s) => s?.trim());
    const clause = { field, value } as ConditionClause;
    if (!value || !isKnownClause(clause)) {
      return { condition: null, error: `Unsupported condition "${p}". Use values like furnishing_scope=full_furnishing or module=pool.` };
    }
    if (!clauses.some((c) => key(c) === key(clause))) clauses.push(clause);
  }
  return { condition: { all: clauses }, error: null };
}
