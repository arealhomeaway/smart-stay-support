/**
 * Proof that a Task saved (Admin, Nov 17): the "Done by [role] on [date]" line, the Saved message
 * that names what saved, and My Tasks "Done recently". Pure and browser-safe. Display only: no
 * completion, permission or review rule here.
 */
import { centralDay } from "@/lib/homeowner-has";

/** Finished Tasks count as recent for this many days. */
export const DONE_RECENT_DAYS = 7;

/** "Done by Project Manager on 11/16/2026". */
export function doneByLine(role: string | null | undefined, completedAt: string | null | undefined): string {
  const day = centralDay(completedAt);
  return `Done by ${role || "our team"}${day ? ` on ${day}` : ""}`;
}

/** The Saved message after a Task save, naming the Task. */
export function taskSavedMessage(input: { title?: string | null | undefined; status?: string | null | undefined; wasDone?: boolean | undefined }): string {
  const name = (input.title ?? "").trim() || "This Task";
  if (input.status === "complete" && !input.wasDone) return `Saved. "${name}" is marked done.`;
  return `Saved. "${name}" is updated.`;
}

/** The Saved message after files are added to a record. */
export function filesSavedMessage(count: number, where: string): string {
  if (count <= 0) return "";
  return `Saved. ${count === 1 ? "1 file" : `${count} files`} added to ${where}.`;
}

/** "Files: plan.pdf, photo.jpg" or "". */
export function filesLine(names: readonly string[]): string {
  return names.length ? `Files: ${names.join(", ")}` : "";
}

export type DoneTask = { id: string; title: string; property_id: string; status: string; completed_at: string | null; completed_by?: string | null; archived_at?: string | null };

/** The person's own Tasks finished in the last 7 days, newest first. */
export function doneRecently<T extends DoneTask>(tasks: readonly T[], person: string | null, now: Date): T[] {
  if (!person) return [];
  const since = now.getTime() - DONE_RECENT_DAYS * 86_400_000;
  return tasks
    .filter((t) => t.status === "complete" && !t.archived_at && t.completed_by === person && t.completed_at && Date.parse(t.completed_at) >= since)
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
}
