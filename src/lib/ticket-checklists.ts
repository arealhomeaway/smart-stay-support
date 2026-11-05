/**
 * Guided ticket checklists. Pure and browser-safe.
 *
 * A checklist is DATA stored on a versioned playbook row (`playbooks.checklist`).
 * This file only knows how to walk one: which step is current, what counts as
 * a valid answer, and which existing category/situation it maps to. Routing,
 * seat, SLA, refund limits and repair limits are never decided here.
 */
import { evaluateAuthority } from "@/lib/work-orders";
import { RECOVERY_POLICY } from "@/lib/recovery-policy";

/** Existing actions a step may open. Each maps to a screen that already exists. */
export const CHECKLIST_ACTIONS = [
  "refund",
  "claim",
  "fix_flow",
  "work_order",
  "purchase",
  "calendar_block",
  "escalate",
  "follow_up",
  "close",
] as const;
export type ChecklistAction = (typeof CHECKLIST_ACTIONS)[number];

export const ACTION_LABELS: Record<ChecklistAction, string> = {
  refund: "Open the refund or credit form",
  claim: "Open the claim",
  fix_flow: "Choose the vendor and send the work order",
  work_order: "Open the work order",
  purchase: "Log the purchase",
  calendar_block: "Calendar block",
  escalate: "Send to the Supervisor",
  follow_up: "Open a follow-up ticket",
  close: "Close the ticket",
};

/** Facts Resolve already knows; shown for the coordinator to confirm. */
export const CHECKLIST_FACTS = ["guest", "lock_system", "reservation", "last_stay", "next_clean", "next_arrival", "repair_band", "refund_limits"] as const;
export type ChecklistFact = (typeof CHECKLIST_FACTS)[number];

export type ChecklistOption = {
  value: string;
  label: string;
  /** Jump to this step key after this answer (skips steps between). */
  goto?: string;
  /** Answer is recorded but the step stays current (for example "Not yet"). */
  keepsOpen?: boolean;
  /** A one-line note is required with this answer. */
  noteRequired?: boolean;
  /** Existing action this answer opens. */
  action?: ChecklistAction;
  /** Short consequence shown under the button. */
  effect?: string;
};

export type ChecklistField = { key: string; label: string; required: boolean; kind: "text" | "money" | "datetime" };

export type ChecklistStep = {
  key: string;
  /** Display number, for example "3a". */
  label: string;
  question: string;
  help?: string;
  options: ChecklistOption[];
  fields?: ChecklistField[];
  action?: ChecklistAction;
  /** Shown only when an earlier step was answered with one of these values. */
  showIf?: { step: string; answers: string[] };
  /**
   * Shown only when the amount entered on another step needs approval or an
   * owner FYI under the existing Work Order spending authority.
   */
  showIfApproval?: { step: string; field: string };
  /** Shown only when a guest is active (in the home or arriving within 48 hours). */
  activeGuestOnly?: boolean;
  /** This is a guest-response step: Yes records the guest update and asks when the next is due. */
  guestResponse?: boolean;
  facts?: ChecklistFact[];
};

export type ChecklistTemplate = {
  category: ChecklistCategoryId;
  title: string;
  /** Future link to the source SOP. */
  sopUrl: string | null;
  /** Starting priority when the template sets one; null = existing priority rules. */
  priority: { activeGuest: "p1" | "p2" | "p3"; otherwise: "p1" | "p2" | "p3" } | null;
  /** Editable values (for example fees) shown in step text as {key}. */
  settings?: ChecklistSetting[];
  steps: ChecklistStep[];
};

export type ChecklistSetting = { key: string; label: string; value: string };

export const NOT_APPLICABLE = "not_applicable";

export type ChecklistAnswer = {
  stepKey: string;
  value: string;
  note?: string | null;
  fields?: Record<string, string> | null;
  answeredBy?: string | null;
  answeredAt?: string | null;
};

// ---------------------------------------------------------------------------
// Categories

export type ChecklistCategoryId = "lockout" | "cleaning" | "maintenance" | "other_complaint" | "damage" | "booking";

export type ChecklistCategory = {
  id: ChecklistCategoryId | "other";
  label: string;
  hint: string;
  icon: "KeyRound" | "Sparkles" | "Wrench" | "MessageSquareWarning" | "ShieldAlert" | "CalendarDays" | "CircleHelp";
  /** Feature flag; off = today's flow. "other" has none and always uses today's flow. */
  flag: string | null;
  /**
   * Existing situation the category stands for, so the work type, seat, SLA
   * and priority rules are exactly what picking that situation gives today.
   */
  situation: (activeGuest: boolean) => string | null;
};

export const CHECKLIST_CATEGORIES: ChecklistCategory[] = [
  { id: "lockout", label: "Lockout or access problem", hint: "Codes, locks, doors.", icon: "KeyRound", flag: "checklist_lockout", situation: () => "locked_out" },
  { id: "cleaning", label: "Cleaning complaint", hint: "The home wasn't clean.", icon: "Sparkles", flag: "checklist_cleaning", situation: (g) => (g ? "clean_now" : "clean_ongoing") },
  { id: "maintenance", label: "Maintenance or repair", hint: "Something is broken.", icon: "Wrench", flag: "checklist_maintenance", situation: (g) => (g ? "broken_now" : "broken_later") },
  { id: "other_complaint", label: "Other guest complaint", hint: "Wi-Fi, noise, amenities, listing.", icon: "MessageSquareWarning", flag: "checklist_other_complaint", situation: () => "guest_needs_now" },
  { id: "damage", label: "Damage and claim", hint: "Something was damaged.", icon: "ShieldAlert", flag: "checklist_damage", situation: () => "damage_claim" },
  { id: "booking", label: "Booking or reservation issue", hint: "Dates, check-in, cancel, payment.", icon: "CalendarDays", flag: "checklist_booking", situation: () => "reservation_change" },
  { id: "other", label: "Other", hint: "Anything else.", icon: "CircleHelp", flag: null, situation: () => null },
];

export const CHECKLIST_FLAG_KEYS = CHECKLIST_CATEGORIES.map((c) => c.flag).filter(Boolean) as string[];

export function categoryById(id: string | null | undefined) {
  return CHECKLIST_CATEGORIES.find((c) => c.id === id) ?? null;
}

/** A category uses its checklist only when its flag is on; otherwise today's flow. */
export function categoryUsesChecklist(id: string | null | undefined, enabled: (flag: string) => boolean): boolean {
  const c = categoryById(id);
  return Boolean(c?.flag && enabled(c.flag));
}

// ---------------------------------------------------------------------------
// Active guest and priority

const HOURS_48 = 48 * 60 * 60 * 1000;

/** Active guest = in the home now, or arriving within 48 hours. */
export function isActiveGuest(input: { inHome: boolean; nextArrival: string | null | undefined }, now = new Date()): boolean {
  if (input.inHome) return true;
  if (!input.nextArrival) return false;
  const t = new Date(input.nextArrival.length === 10 ? `${input.nextArrival}T16:00:00` : input.nextArrival).getTime();
  return Number.isFinite(t) && t >= now.getTime() - 24 * 60 * 60 * 1000 && t - now.getTime() <= HOURS_48;
}

export function templatePriority(t: Pick<ChecklistTemplate, "priority"> | null | undefined, activeGuest: boolean) {
  if (!t?.priority) return null;
  return activeGuest ? t.priority.activeGuest : t.priority.otherwise;
}

// ---------------------------------------------------------------------------
// Walking a checklist

export function stepVisible(step: ChecklistStep, answers: Map<string, ChecklistAnswer>, activeGuest: boolean): boolean {
  if (step.activeGuestOnly && !activeGuest) return false;
  if (step.showIf) {
    const a = answers.get(step.showIf.step);
    if (!a || !step.showIf.answers.includes(a.value)) return false;
  }
  if (step.showIfApproval) {
    const a = answers.get(step.showIfApproval.step);
    const amount = a?.fields?.[step.showIfApproval.field];
    if (!a || amount === undefined || amount === "") return false;
    // The owner email is owed at the permanent-repair band even in an emergency.
    const band = repairBand(Number(amount), false);
    if (!band || !(band.ownerApprovalRequired || band.supervisorApprovalRequired)) return false;
  }
  return true;
}

export type ChecklistProgress = {
  current: ChecklistStep | null;
  /** The open answer on the current step, for example "Not yet". */
  pending: ChecklistAnswer | null;
  done: { step: ChecklistStep; answer: ChecklistAnswer; option: ChecklistOption | null }[];
  total: number;
};

/** Latest answer per step wins. */
export function latestAnswers(rows: ChecklistAnswer[]): Map<string, ChecklistAnswer> {
  const m = new Map<string, ChecklistAnswer>();
  for (const r of [...rows].sort((a, b) => String(a.answeredAt ?? "").localeCompare(String(b.answeredAt ?? "")))) m.set(r.stepKey, r);
  return m;
}

export function checklistProgress(t: ChecklistTemplate, rows: ChecklistAnswer[], activeGuest: boolean): ChecklistProgress {
  const answers = latestAnswers(rows);
  const done: ChecklistProgress["done"] = [];
  const steps = t.steps;
  const total = steps.filter((s) => stepVisible(s, answers, activeGuest)).length;
  let i = 0;
  let guard = 0;
  while (i < steps.length && guard++ < 500) {
    const s = steps[i]!;
    if (!stepVisible(s, answers, activeGuest)) { i++; continue; }
    const a = answers.get(s.key);
    const opt = a ? (s.options.find((o) => o.value === a.value) ?? null) : null;
    if (!a || (opt?.keepsOpen && a.value !== NOT_APPLICABLE)) return { current: s, pending: a ?? null, done, total };
    done.push({ step: s, answer: a, option: opt });
    const target = a.value !== NOT_APPLICABLE && opt?.goto ? steps.findIndex((x) => x.key === opt.goto) : -1;
    i = target > i ? target : i + 1;
  }
  return { current: null, pending: null, done, total };
}

/** Returns a plain-language problem, or null when the answer can be saved. */
export function answerProblem(step: ChecklistStep, a: { value: string; note?: string | null; fields?: Record<string, string> | null }): string | null {
  if (a.value === NOT_APPLICABLE) {
    return (a.note ?? "").trim().length >= 3 ? null : "Say in one line why this doesn't apply.";
  }
  const opt = step.options.find((o) => o.value === a.value);
  if (!opt) return "Choose one of the answers.";
  if (opt.noteRequired && !(a.note ?? "").trim()) return "Add a short note with this answer.";
  if (!opt.keepsOpen) {
    for (const f of step.fields ?? []) {
      if (f.required && !String(a.fields?.[f.key] ?? "").trim()) return `Fill in "${f.label}".`;
      if (f.kind === "money" && a.fields?.[f.key] && !Number.isFinite(Number(a.fields[f.key]))) return `"${f.label}" must be a number.`;
    }
  }
  return null;
}

/** One line for the ticket activity log. */
export function answerHistoryLine(step: ChecklistStep, a: { value: string; note?: string | null; fields?: Record<string, string> | null }): string {
  const label = a.value === NOT_APPLICABLE ? "This doesn't apply" : (step.options.find((o) => o.value === a.value)?.label ?? a.value);
  const fields = (step.fields ?? []).map((f) => (a.fields?.[f.key] ? `${f.label}: ${a.fields[f.key]}` : null)).filter(Boolean);
  const note = (a.note ?? "").trim();
  return [`Checklist step ${step.label}, "${step.question}": ${label}.`, ...fields, note ? `Note: ${note}` : null].filter(Boolean).join(" ");
}

export function fillQuestion(q: string, facts: { lockSystem?: string | null }, settings: ChecklistSetting[] = []) {
  let out = q.replace(/\{lock_system\}/g, facts.lockSystem?.trim() || "the home's lock system");
  for (const st of settings) out = out.split(`{${st.key}}`).join(st.value);
  return out;
}

// ---------------------------------------------------------------------------
// Existing limits, referenced (never stored in a template)

/** Repair band text from the existing Work Order spending authority. */
export function repairBand(amount: number | null, emergency: boolean) {
  if (amount === null || !Number.isFinite(amount)) return null;
  const v = evaluateAuthority({ phase: emergency ? "mitigation" : "permanent", emergency_reason: emergency ? "active_property_damage" : null, quote_amount: amount });
  return { label: v.label, reason: v.reason, ownerApprovalRequired: v.ownerApprovalRequired, supervisorApprovalRequired: v.supervisorApprovalRequired };
}

/** Refund limits text from the existing refund policy. */
export function refundLimitsText() {
  const pc = RECOVERY_POLICY.pcApprovalCeiling;
  const sup = RECOVERY_POLICY.supervisorApprovalCeiling;
  return `Coordinator up to $${pc}, Supervisor over $${pc}, Director over $${sup.toLocaleString("en-US")}. A reason is always required.`;
}

// ---------------------------------------------------------------------------
// Template shape check (editor and seed)

export function templateProblems(t: ChecklistTemplate): string[] {
  const out: string[] = [];
  const keys = new Set<string>();
  t.steps.forEach((s, idx) => {
    if (!s.key || keys.has(s.key)) out.push(`Step ${idx + 1} needs a unique key.`);
    keys.add(s.key);
    if (!s.question.trim()) out.push(`Step ${s.label} needs a question.`);
    if (s.options.length === 0) out.push(`Step ${s.label} needs at least one answer.`);
    if (s.action && !CHECKLIST_ACTIONS.includes(s.action)) out.push(`Step ${s.label} opens an unknown action.`);
    const known = new Set(["lock_system", ...(t.settings ?? []).map((x) => x.key)]);
    for (const m of `${s.question} ${s.help ?? ""}`.matchAll(/\{(\w+)\}/g)) {
      if (!known.has(m[1]!)) out.push(`Step ${s.label} uses {${m[1]}}, which is not a setting.`);
    }
  });
  for (const st of t.settings ?? []) if (!st.value.trim()) out.push(`Setting "${st.label}" needs a value.`);
  t.steps.forEach((s, idx) => {
    for (const o of s.options) {
      if (!o.goto) continue;
      const target = t.steps.findIndex((x) => x.key === o.goto);
      if (target < 0) out.push(`Step ${s.label} answer "${o.label}" goes to a step that doesn't exist.`);
      else if (target <= idx) out.push(`Step ${s.label} answer "${o.label}" must go forward.`);
    }
    if (s.showIfApproval && !keys.has(s.showIfApproval.step)) out.push(`Step ${s.label} depends on a step that doesn't exist.`);
    if (s.showIf && !keys.has(s.showIf.step)) out.push(`Step ${s.label} depends on a step that doesn't exist.`);
  });
  return out;
}

/** Read a stored checklist row. Returns null when the shape is not usable. */
export function parseChecklistRow(row: {
  id: string; title: string; version: number; checklist: unknown; checklist_category: string | null; sop_url?: string | null;
}): (ChecklistTemplate & { id: string; version: number }) | null {
  const body = row.checklist as { steps?: unknown; priority?: unknown } | null;
  if (!body || !Array.isArray(body.steps) || !categoryById(row.checklist_category)) return null;
  const t: ChecklistTemplate = {
    category: row.checklist_category as ChecklistCategoryId,
    title: row.title,
    sopUrl: row.sop_url ?? null,
    priority: (body.priority as ChecklistTemplate["priority"]) ?? null,
    steps: body.steps as ChecklistStep[],
  };
  const settings = (body as { settings?: unknown }).settings;
  if (Array.isArray(settings)) t.settings = settings as ChecklistSetting[];
  if (t.steps.some((s) => !s || typeof s.key !== "string" || !Array.isArray(s.options))) return null;
  return { ...t, id: row.id, version: row.version };
}
