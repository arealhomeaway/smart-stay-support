/**
 * Assessments & Forms for a property (browser-safe, pure).
 *
 * There is no separate form record: every onboarding assessment/form already
 * lives on an existing workflow Task. This module only recognizes which Task
 * carries which form, so Property Details opens the SAME record the Task does.
 * It never creates work and never changes handoff state.
 *
 * Source labels are honest: Breezeway inspections and Smartsheet forms are
 * external documents, not native Resolve forms.
 */

export type FormKey =
  | "new_house_assessment"
  | "pre_work"
  | "standard"
  | "mid_project"
  | "final_assessment"
  | "handoff_form";

export type FormSource = "breezeway" | "smartsheet" | "resolve_task";

export const FORM_SOURCE_LABELS: Record<FormSource, string> = {
  breezeway: "External — Breezeway inspection",
  smartsheet: "External — Smartsheet form",
  resolve_task: "Recorded on the Resolve Task",
};

type FormDef = { key: FormKey; label: string; source: FormSource; patterns: RegExp[] };

/** Matched against current template Task titles, most specific first. */
export const FORM_DEFS: FormDef[] = [
  {
    key: "new_house_assessment",
    label: "New house assessment",
    source: "breezeway",
    patterns: [/initial property assessment/i, /conduct home assessment/i, /new house setup form results/i],
  },
  { key: "pre_work", label: "Pre-work", source: "breezeway", patterns: [/pre-?work review/i, /work order for pre-?work inspection/i] },
  {
    key: "standard",
    label: "Standard",
    source: "breezeway",
    patterns: [/standard installation/i, /work order for standard inspection/i, /review the standard inspection results/i],
  },
  { key: "mid_project", label: "Mid-project review", source: "resolve_task", patterns: [/mid[- ]project review/i] },
  {
    key: "final_assessment",
    label: "Final assessment",
    source: "resolve_task",
    patterns: [/guest-readiness assessment/i],
  },
  { key: "handoff_form", label: "Handoff form", source: "smartsheet", patterns: [/new house handoff form/i] },
];

export type FormTask = {
  id: string;
  title: string;
  status: string;
  assigned_to: string | null;
  updated_at: string;
  completed_at: string | null;
  archived_at?: string | null;
};

export type PropertyForm = {
  key: FormKey;
  label: string;
  source: FormSource;
  sourceLabel: string;
  tasks: FormTask[];
  status: "not_found" | "not_started" | "in_progress" | "complete";
  lastUpdate: string | null;
  responsible: string | null;
};

export function formKeyForTitle(title: string): FormKey | null {
  for (const def of FORM_DEFS) if (def.patterns.some((p) => p.test(title))) return def.key;
  return null;
}

export function propertyForms(tasks: FormTask[]): PropertyForm[] {
  const live = tasks.filter((t) => !t.archived_at);
  return FORM_DEFS.map((def) => {
    const matched = live.filter((t) => formKeyForTitle(t.title) === def.key);
    const done = matched.length > 0 && matched.every((t) => t.status === "complete");
    const started = matched.some((t) => t.status === "complete" || t.status === "in_progress");
    const lastUpdate =
      matched.map((t) => t.completed_at ?? t.updated_at).sort().at(-1) ?? null;
    const open = matched.find((t) => t.status !== "complete") ?? matched[0];
    return {
      key: def.key,
      label: def.label,
      source: def.source,
      sourceLabel: FORM_SOURCE_LABELS[def.source],
      tasks: matched,
      status: matched.length === 0 ? "not_found" : done ? "complete" : started ? "in_progress" : "not_started",
      lastUpdate,
      responsible: open?.assigned_to ?? null,
    };
  });
}
