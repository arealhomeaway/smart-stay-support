/**
 * Homeowner-facing save errors. A message written for homeowners passes through; anything with
 * internal or technical wording is replaced by one plain sentence. Display only.
 */
export const OWNER_SAVE_FALLBACK =
  "This could not save. Your entry is still here. Please try again, and if it happens again, message your ARHA contact.";

/** The limit on "What did you do?" for owner hours. Mirrors the database check. */
export const OWNER_ACTIVITY_MAX = 2000;

const INTERNAL = [
  /participation scope/i,
  /canonical/i,
  /ticket context/i,
  /\bopportunity\b/i,
  /\bprogram\b/i,
  /\bphase\b/i,
  /allowed limits/i,
  /permission|not allowed|violates|constraint|relation|column|function|schema|null value|syntax|duplicate key/i,
  /PGRST|SQLSTATE|JWT|token|fetch|network|timeout|status code/i,
  /rpc|uuid|json|undefined|TypeError|Error:/i,
  /[_{}[\]<>]/,
];

export function ownerSaveMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const text = raw.trim();
  if (!text || text.length > 200 || INTERNAL.some((p) => p.test(text))) return OWNER_SAVE_FALLBACK;
  return text;
}

/** "517 / 2,000" under the field. */
export function activityCounter(text: string): string {
  return `${text.length.toLocaleString("en-US")} / ${OWNER_ACTIVITY_MAX.toLocaleString("en-US")}`;
}

/** Which field failed, in plain words, or null when the entry looks fine. */
export function ownerEntryProblem(input: { activity: string; minutes: string | number }): string | null {
  const act = input.activity.trim();
  if (act.length < 3) return "What did you do? needs at least 3 characters.";
  if (act.length > OWNER_ACTIVITY_MAX) return "What did you do? can be up to 2,000 characters.";
  const m = typeof input.minutes === "number" ? input.minutes : Number(input.minutes);
  if (!String(input.minutes).trim() || !Number.isInteger(m) || m < 1 || m > 1440) return "Minutes spent must be a whole number from 1 to 1,440.";
  return null;
}
