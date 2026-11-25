/**
 * Homeowners reopen what they finished or submitted (approved Nov 18): Edit and Add more on her own
 * hours, Add more on finished Opportunities and owner items. Nothing she sent is lost: each change
 * goes through one database action that keeps the original and records "Homeowner updated" for the
 * team. Pure rules here (browser-safe, tested); the save calls are in homeowner-reopen.data.ts.
 */
export const REOPEN_COPY = {
  edit: "Edit",
  addMore: "Add more",
  addMoreTitle: "Add more or update",
  notOn: "This is not switched on yet. Your words are still here; try again later.",
  keepNote: "What you sent before stays on file. Your team sees the change.",
} as const;

/** The line the team sees for one homeowner change. */
export function homeownerUpdatedLine(title: string, at: string | null | undefined): string {
  const day = at && !Number.isNaN(Date.parse(at))
    ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric" }).format(new Date(at))
    : "";
  return `Homeowner updated ${title}${day ? ` on ${day}` : ""}`;
}

/** Who may change an hours entry from the homeowner portal: only her own, current entry. */
export function canChangeOwnEntry(entry: { owner_user_id?: string | null; superseded?: boolean }, userId: string | null, readOnly: boolean): boolean {
  return !readOnly && Boolean(userId) && entry.owner_user_id === userId && !entry.superseded;
}

export type HoursChange = {
  mode: "edit" | "add";
  activity: string;
  entryDate: string;
  minutes: number;
  note: string;
  newFiles: number;
};

/** What is wrong with a change before saving, or null. Mirrors the database checks. */
export function hoursChangeProblem(
  c: HoursChange,
  original: { activity: string; entry_date: string; minutes: number },
  today: string,
): string | null {
  if (c.mode === "add") {
    if (!c.note.trim() && c.newFiles === 0) return "Add a note or a file first.";
    if (c.note.trim().length > 1000) return "Keep your note under 1,000 characters.";
    return null;
  }
  if (!Number.isFinite(c.minutes) || c.minutes < 1 || c.minutes > 1440) return "Minutes spent must be a whole number from 1 to 1,440.";
  const act = c.activity.trim();
  if (act.length < 3) return "What did you do? needs at least 3 characters.";
  if (act.length > 2000) return "What did you do? can be up to 2,000 characters.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.entryDate)) return "Choose the date you did the work.";
  if (c.entryDate > today) return "Choose a date no later than today.";
  if (c.note.trim().length > 1000) return "Keep your note under 1,000 characters.";
  const same = act === original.activity.trim() && c.entryDate === original.entry_date && c.minutes === original.minutes;
  if (same && !c.note.trim() && c.newFiles === 0) return "Nothing changed.";
  return null;
}
