export type BreezewaySending = { mode: "all_verified" | "pilot_only"; homeIds: string[] };
export const DEFAULT_BREEZEWAY_SENDING: BreezewaySending = { mode: "all_verified", homeIds: [] };
export function sendingAllowsHome(setting: BreezewaySending, homeId: string): boolean {
  return setting.mode === "all_verified" || setting.homeIds.includes(homeId);
}
/** Breezeway appointment fields are local Central time, not UTC clock time. */
export function acceptedVendorAppointment(personId: unknown, scheduledFor: string | null | undefined) {
  const id = Number(personId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("The accepted vendor has no Breezeway person mapping. Add the mapping before sending.");
  if (!scheduledFor || !Number.isFinite(Date.parse(scheduledFor))) throw new Error("The agreed appointment date and time are missing. Set the appointment before sending.");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(scheduledFor));
  const p = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return { assigneeIds: [id], scheduledDate: `${p['year']}-${p['month']}-${p['day']}`, scheduledTime: `${p['hour']}:${p['minute']}:${p['second']}` };
}
/**
 * Staff-composed Breezeway sends (onboarding Tasks and Tickets) use the same
 * rule as accepted-vendor dispatch: never undated, never unassigned.
 * Returns a plain message to show, or null when the send may go ahead.
 */
/**
 * A date is always required. Who does the work is required for Ticket and
 * Work Order sends, but optional for onboarding Tasks, which are sent before
 * closing and assigned once the closing date is firm.
 */
export function dispatchBasicsProblem(input: {
  scheduledDate?: string | null;
  assigneeIds?: unknown[] | null;
  sourceType?: string | null;
}): string | null {
  if (!String(input.scheduledDate ?? "").trim()) return "Choose the date for this work before sending it to Breezeway.";
  if (input.sourceType === "onboarding_task") return null;
  if (!(input.assigneeIds ?? []).length) return "Choose who is doing the work before sending it to Breezeway.";
  return null;
}
