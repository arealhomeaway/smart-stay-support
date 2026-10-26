import type { OpportunityContent } from "./v2-workflow.functions";

/** Older imports stored only title/what/why/how. Fill the rest so the step window opens and saves complete. */
export function completeOpportunity(stored: unknown, fallbackTitle: string): OpportunityContent {
  const o = (stored && typeof stored === "object" ? stored : {}) as Partial<Record<keyof OpportunityContent, unknown>>;
  const text = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    title: typeof o.title === "string" && o.title.trim() ? o.title : fallbackTitle,
    what: text(o.what),
    why: text(o.why),
    how: text(o.how),
    resources: Array.isArray(o.resources) ? o.resources.filter((r): r is string => typeof r === "string") : [],
    ways_to_document: text(o.ways_to_document),
    suggested_minutes: typeof o.suggested_minutes === "number" ? o.suggested_minutes : null,
  };
}

export const HANDOFF_LOCK_NOTE =
  "Homeowner and Active Owner work never blocks handoff. You can still change everything else on this step.";

/** Mirrors the database rule owner_work_never_blocks_handoff. */
export function handoffLocked(step: { requires_owner_approval?: boolean | null; tags?: string[] | null }) {
  return Boolean(step.requires_owner_approval) || (step.tags ?? []).includes("active_owner");
}
