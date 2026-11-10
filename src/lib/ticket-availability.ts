/**
 * What a person sees when a link (an alert, a search result, an old bookmark) points at a
 * ticket they can no longer work: a removed ticket, or an archived one for anyone who
 * cannot restore it (register H6 and the Archive rule: Archive hides it, only an Admin
 * restores). Never an error message.
 */
export const TICKET_UNAVAILABLE = "This ticket is no longer available.";

export type TicketAvailability = "open" | "unavailable" | "other_lens";

export function ticketAvailability(input: {
  /** The ticket row came back under the current demo or real lens. */
  found: boolean;
  /** The ticket exists, but only under the other lens (demo versus real). */
  foundInOtherLens: boolean;
  archived: boolean;
  canRestore: boolean;
}): TicketAvailability {
  if (!input.found) return input.foundInOtherLens ? "other_lens" : "unavailable";
  if (input.archived && !input.canRestore) return "unavailable";
  return "open";
}
