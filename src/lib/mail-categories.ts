/**
 * The Outlook category protocol for email intake.
 *
 * A message only becomes a ticket when someone in the shared inbox has
 * deliberately categorised it. Resolve then moves that one category forward
 * through the message's life — created, then completed — and never touches any
 * other category the team uses for its own filing.
 *
 * Pure string handling only, so it can be unit tested without Microsoft.
 */

/** Set by a person. The only thing that may open a ticket. */
export const CREATE_TAG = "Resolve: create task";
/** Set by Resolve, only after the ticket exists and is saved. */
export const CREATED_TAG = "Resolve: task created";
/** Set by Resolve when the linked ticket is closed. */
export const COMPLETED_TAG = "Resolve task: task completed";

/** Every category Resolve is allowed to add or remove. */
export const RESOLVE_TAGS = [CREATE_TAG, CREATED_TAG, COMPLETED_TAG];

function clean(categories: readonly (string | null | undefined)[] | null | undefined) {
  return (categories ?? []).map((c) => (c ?? "").trim()).filter(Boolean);
}

/** Exact, case-insensitive match — "resolve: create task please" does not count. */
export function hasTag(categories: readonly (string | null | undefined)[] | null | undefined, tag: string) {
  const wanted = tag.toLowerCase();
  return clean(categories).some((c) => c.toLowerCase() === wanted);
}

/** True when a person asked for this message to become a ticket. */
export function requestsTicket(categories: readonly (string | null | undefined)[] | null | undefined) {
  return hasTag(categories, CREATE_TAG);
}

/** True when Resolve has already opened a ticket for this message. */
export function alreadyTagged(categories: readonly (string | null | undefined)[] | null | undefined) {
  return hasTag(categories, CREATED_TAG) || hasTag(categories, COMPLETED_TAG);
}

/**
 * Swaps one Resolve category for another, keeping every unrelated category the
 * team applied — de-duplicated, order preserved.
 */
export function withTag(
  categories: readonly (string | null | undefined)[] | null | undefined,
  tag: string,
): string[] {
  const keep = clean(categories).filter((c) => !RESOLVE_TAGS.some((t) => t.toLowerCase() === c.toLowerCase()));
  const seen = new Set<string>();
  return [...keep, tag].filter((c) => {
    const key = c.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Categories to write once the ticket is confirmed saved. */
export function categoriesAfterCreate(categories: readonly (string | null | undefined)[] | null | undefined) {
  return withTag(categories, CREATED_TAG);
}

/** Categories to write once the linked ticket is closed. */
export function categoriesAfterClose(categories: readonly (string | null | undefined)[] | null | undefined) {
  return withTag(categories, COMPLETED_TAG);
}
