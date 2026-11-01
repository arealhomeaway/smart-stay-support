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
  return { assigneeIds: [id], scheduledDate: `${p.year}-${p.month}-${p.day}`, scheduledTime: `${p.hour}:${p.minute}:${p.second}` };
}