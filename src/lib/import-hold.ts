/**
 * Imported tickets on a review list ("Backlog review" or "Needs a home") stay
 * out of PC queues, My Work and Team Queue until someone moves them out.
 * Before the pending database change is applied the field is absent, so every
 * ticket counts as not held.
 */
export type ImportHold = "backlog_review" | "needs_home";
export const IMPORT_HOLD_LABELS: Record<ImportHold, string> = {
  backlog_review: "Backlog review",
  needs_home: "Needs a home",
};
export function isImportHeld(t: { import_hold?: string | null }): boolean {
  return t.import_hold === "backlog_review" || t.import_hold === "needs_home";
}
export function withoutImportHeld<T>(rows: T[]): T[] {
  return rows.filter((r) => !isImportHeld(r as { import_hold?: string | null }));
}
export function isNotionImported(t: { external_source?: string | null }): boolean {
  return t.external_source === "notion";
}
