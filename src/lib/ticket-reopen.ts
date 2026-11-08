/**
 * Which Reopen a ticket page offers. Pure and browser-safe.
 *
 * One rule (decided Nov 8, 2026): any staff member who works tickets can
 * reopen any closed ticket with a short reason. It becomes live, its clocks
 * start fresh from that moment, it is assigned to the person who reopened it,
 * a history line is written, and only later work is credited to them.
 *  - "notion": an import not yet live in Resolve. The Imported from Notion box
 *    owns that button (reopen_notion_ticket), so Current Work shows none.
 *  - "closed": a closed ticket. Reason dialog, then the database reopen.
 *  - "resolved": finished work still before closing. The existing Reopen
 *    (back to In progress) is unchanged.
 * Onboarding, owner and vendor accounts never get a Reopen.
 */
import { notionAction, type NotionTicketLike } from "@/lib/notion-ticket-display";

export type ReopenPath = "notion" | "closed" | "resolved" | null;

export type ReopenTicketLike = NotionTicketLike & { record_type?: string | null; archived_at?: string | null };

export function reopenPathFor(t: ReopenTicketLike, canWorkTickets: boolean, now: number = Date.now()): ReopenPath {
  if (!canWorkTickets) return null;
  if (t.archived_at) return null;
  if (notionAction(t, true, now)) return "notion";
  if (t.record_type === "completed_interaction") return null;
  if (t.status === "closed") return "closed";
  if (t.status === "resolved") return "resolved";
  return null;
}

export const REOPEN_COPY = {
  button: "Reopen this ticket",
  title: "Reopen this ticket",
  help: "It becomes live work, assigned to you, with fresh response times starting now. Only your work from now on is credited to you.",
  reasonLabel: "Why are you reopening it?",
  reasonPlaceholder: "A short reason, for example: the guest wrote back about the same issue.",
  cancel: "Cancel",
  confirm: "Reopen and take it",
  done: "Reopened. It is yours now.",
  notReady: "Reopening closed tickets is still being set up. Try again later.",
} as const;
