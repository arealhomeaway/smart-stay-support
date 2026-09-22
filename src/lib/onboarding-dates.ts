/**
 * Onboarding milestone dates (pure).
 *
 * The target handoff date follows the access (possession) date: three weeks
 * for a standard home, four weeks for an Active Owner home. It keeps following
 * access until someone types their own date, at which point it is "manual" and
 * is never recalculated.
 */

export const STANDARD_HANDOFF_DAYS = 21;
export const ACTIVE_OWNER_HANDOFF_DAYS = 28;

export type HandoffDateSource = "auto" | "manual";

export function addDays(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function handoffOffsetDays(activeOwner: boolean): number {
  return activeOwner ? ACTIVE_OWNER_HANDOFF_DAYS : STANDARD_HANDOFF_DAYS;
}

/** The handoff date this home should carry, given its access date. */
export function autoHandoffDate(accessOn: string | null, activeOwner: boolean): string | null {
  if (!accessOn) return null;
  return addDays(accessOn, handoffOffsetDays(activeOwner));
}

/**
 * Resolve the handoff date after a date edit. A typed handoff date wins and
 * latches to manual; otherwise the date is recomputed from access.
 */
export function resolveHandoff(input: {
  accessOn: string | null;
  activeOwner: boolean;
  current: string | null;
  currentSource: HandoffDateSource;
  /** undefined = not edited; null = cleared back to automatic. */
  typed?: string | null | undefined;
}): { targetHandoffOn: string | null; source: HandoffDateSource } {
  if (input.typed !== undefined) {
    if (input.typed === null || input.typed === "")
      return {
        targetHandoffOn: autoHandoffDate(input.accessOn, input.activeOwner),
        source: "auto",
      };
    return { targetHandoffOn: input.typed, source: "manual" };
  }
  if (input.currentSource === "manual") return { targetHandoffOn: input.current, source: "manual" };
  return { targetHandoffOn: autoHandoffDate(input.accessOn, input.activeOwner), source: "auto" };
}

export function handoffExplainer(activeOwner: boolean, source: HandoffDateSource): string {
  if (source === "manual") return "Set by hand — it no longer follows the access date.";
  return activeOwner
    ? "Four weeks after access (Active Owner home). Type your own date to override."
    : "Three weeks after access (standard home). Type your own date to override.";
}
