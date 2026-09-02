/**
 * Authored Playbook content — layer B of the Contextual Playbooks model.
 *
 * Layer A (deterministic truth) lives in the policy engines: recovery-policy,
 * maintenance-policy, claims, work-orders, evidence and the work-type SLA
 * columns. Layer B is human-approved judgment: what to consider, what to do
 * first, when to bring someone else in. It never restates a dollar threshold
 * or an SLA — if authored text contains one, it has drifted from layer A and
 * must be flagged for review rather than shown over it.
 *
 * The authored shape deliberately mirrors the Coach output schema
 * (`src/lib/coach-schema.ts`), so guidance the team already recognises can be
 * reviewed, approved and published without a second vocabulary.
 */

/**
 * Lifecycle. `active` is the legacy stored value for an approved Playbook and
 * is normalised to `approved` on read, so nothing already published breaks.
 */
export type PlaybookStatus = "draft" | "in_review" | "approved" | "retired";

export const STATUS_LABELS: Record<PlaybookStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
  retired: "Retired",
};

/** Only an approved Playbook may guide frontline work. */
export function isApproved(pb: { status: PlaybookStatus; effective_on?: string | null }): boolean {
  if (pb.status !== "approved") return false;
  if (!pb.effective_on) return true;
  return new Date(pb.effective_on).getTime() <= Date.now();
}

/** Where the authored text came from. */
export type PlaybookSource = "authored" | "ai_draft" | "imported";

export const SOURCE_LABELS: Record<PlaybookSource, string> = {
  authored: "Written by the team",
  ai_draft: "AI draft from existing policy",
  imported: "Imported from an earlier system",
};

/** Operational objects a Playbook may attach to. */
export type PlaybookSubject = "ticket" | "work_order" | "recovery" | "claim";


/** A short "consider this" prompt. Same shape as the Coach's risk flags. */
export type RiskFlag = { title: string; why: string | null };

/** Same shape as the Coach's vendor brief. */
export type VendorBrief = {
  scope: string | null;
  must_check: string[];
  must_not_do: string[];
  evidence_required: string[];
  before_leaving: string[];
};

/**
 * Deterministic match facts stored on a Playbook. Every field is optional and
 * every present field must be satisfied by the context (AND), except the
 * name/category/situation lists, where any one member matching is enough (OR
 * within the list). No fuzzy text matching, no AI.
 */
export type PlaybookMatcher = {
  /** Objects this Playbook may be surfaced on. Falls back to `applies_to`. */
  objects?: PlaybookSubject[];
  /** Work type names, matched case-insensitively. */
  work_types?: string[];
  /** Ticket categories. */
  categories?: string[];
  /** Situation ids from `src/lib/situations.ts`. */
  situations?: string[];
  /** Priorities this Playbook speaks to. */
  priorities?: Array<"p1" | "p2" | "p3">;
  /** Operational conditions that must all hold. */
  requires?: PlaybookCondition[];
};

/**
 * Conditions the resolver can evaluate from live operational state. Each maps
 * to a field the caller derives from a policy engine — never to a value the
 * Playbook itself asserts.
 */
export type PlaybookCondition =
  | "guest_in_home"
  | "stay_impacted"
  | "owner_approval_required"
  | "emergency_mitigation"
  | "warranty_applies"
  | "vendor_missed"
  | "evidence_incomplete"
  | "deadline_approaching"
  | "escalated";

/** A Playbook row as the app consumes it, after parsing the jsonb columns. */
export type AuthoredPlaybook = {
  id: string;
  playbook_key: string;
  version: number;
  status: PlaybookStatus;
  title: string;
  category: string;
  summary: string | null;
  effective_on: string | null;
  applies_to: PlaybookSubject[];
  matcher: PlaybookMatcher;
  priority_reason: string | null;
  risk_flags: RiskFlag[];
  immediate_actions: string[];
  escalate_if: string[];
  vendor_brief: VendorBrief | null;
};

const SUBJECTS: PlaybookSubject[] = ["ticket", "work_order", "recovery", "claim"];

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim());
}

function asRiskFlags(value: unknown): RiskFlag[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const title = typeof row['title'] === "string" ? row['title'].trim() : "";
    if (!title) return [];
    return [{ title, why: typeof row['why'] === "string" && row['why'].trim() ? row['why'].trim() : null }];
  });
}

function asVendorBrief(value: unknown): VendorBrief | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const brief: VendorBrief = {
    scope: typeof row['scope'] === "string" && row['scope'].trim() ? row['scope'].trim() : null,
    must_check: asStringList(row['must_check']),
    must_not_do: asStringList(row['must_not_do']),
    evidence_required: asStringList(row['evidence_required']),
    before_leaving: asStringList(row['before_leaving']),
  };
  const empty =
    !brief.scope &&
    !brief.must_check.length &&
    !brief.must_not_do.length &&
    !brief.evidence_required.length &&
    !brief.before_leaving.length;
  return empty ? null : brief;
}

function asMatcher(value: unknown): PlaybookMatcher {
  if (!value || typeof value !== "object") return {};
  const row = value as Record<string, unknown>;
  const matcher: PlaybookMatcher = {};
  const objects = asStringList(row['objects']).filter((o): o is PlaybookSubject =>
    (SUBJECTS as string[]).includes(o),
  );
  if (objects.length) matcher.objects = objects;
  const workTypes = asStringList(row['work_types']);
  if (workTypes.length) matcher.work_types = workTypes;
  const categories = asStringList(row['categories']);
  if (categories.length) matcher.categories = categories;
  const situations = asStringList(row['situations']);
  if (situations.length) matcher.situations = situations;
  const priorities = asStringList(row['priorities']).filter(
    (p): p is "p1" | "p2" | "p3" => p === "p1" || p === "p2" || p === "p3",
  );
  if (priorities.length) matcher.priorities = priorities;
  const requires = asStringList(row['requires']) as PlaybookCondition[];
  if (requires.length) matcher.requires = requires;
  return matcher;
}

/** Row shape as it arrives from the database, before parsing. */
export type PlaybookRow = {
  id: string;
  title: string;
  category: string;
  summary?: string | null;
  active?: boolean | null;
  playbook_key?: string | null;
  version?: number | null;
  status?: string | null;
  effective_on?: string | null;
  applies_to?: string[] | null;
  matcher?: unknown;
  priority_reason?: string | null;
  risk_flags?: unknown;
  immediate_actions?: string[] | null;
  escalate_if?: string[] | null;
  vendor_brief?: unknown;
};

/** Normalise a database row into the shape the resolver and card consume. */
export function parsePlaybook(row: PlaybookRow): AuthoredPlaybook {
  const status: PlaybookStatus =
    row.status === "draft" || row.status === "retired" || row.status === "active"
      ? row.status
      : row.active === false
        ? "retired"
        : "active";
  const applies = (row.applies_to ?? []).filter((s): s is PlaybookSubject =>
    (SUBJECTS as string[]).includes(s),
  );
  return {
    id: row.id,
    playbook_key: row.playbook_key ?? row.id,
    version: row.version ?? 1,
    status,
    title: row['title'],
    category: row.category,
    summary: row.summary ?? null,
    effective_on: row.effective_on ?? null,
    applies_to: applies.length ? applies : ["ticket"],
    matcher: asMatcher(row.matcher),
    priority_reason: row.priority_reason?.trim() || null,
    risk_flags: asRiskFlags(row.risk_flags),
    immediate_actions: asStringList(row.immediate_actions),
    escalate_if: asStringList(row.escalate_if),
    vendor_brief: asVendorBrief(row.vendor_brief),
  };
}

/** True when a Playbook carries approved judgment content, not just steps. */
export function hasAuthoredGuidance(pb: AuthoredPlaybook): boolean {
  return Boolean(
    pb.priority_reason ||
      pb.risk_flags.length ||
      pb.immediate_actions.length ||
      pb.escalate_if.length ||
      pb.vendor_brief,
  );
}

/**
 * Authored guidance must never state a threshold — those live in the policy
 * engines and change without the Playbook knowing. Text that names a dollar
 * amount or an SLA is a drift defect: flag it, never render it as authority.
 */
const THRESHOLD_PATTERN = /(\$\s?\d)|(\b\d+\s?(minutes|minute|hours|hour)\b)/i;

export function driftWarnings(pb: AuthoredPlaybook): string[] {
  const texts = [
    pb.priority_reason ?? "",
    ...pb.risk_flags.flatMap((f) => [f.title, f.why ?? ""]),
    ...pb.immediate_actions,
    ...pb.escalate_if,
  ];
  return texts
    .filter((t) => THRESHOLD_PATTERN.test(t))
    .map((t) => `Authored guidance states a threshold, which the policy engine owns: "${t}"`);
}
