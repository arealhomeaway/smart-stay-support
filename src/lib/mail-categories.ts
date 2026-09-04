/**
 * The Outlook category protocol for email intake.
 *
 * A message only becomes work in Resolve when a person in the shared inbox
 * deliberately applies a trigger category. Resolve then moves that one
 * category forward through the message's life — created, then closed — and
 * never touches any other category the team uses for its own filing.
 *
 * Pure string handling only, so it can be unit tested without Microsoft.
 */

/** Applied by a person. Opens exactly one Ticket. */
export const CREATE_TICKET_TAG = "Resolve: create ticket";
/** Applied by a person. Opens exactly one Lead in the Tenant Lead workflow. */
export const CREATE_LEAD_TAG = "Resolve: lead management- create a ticket";
/** Applied by Resolve, only once the Ticket or Lead exists and is saved. */
export const CREATED_TAG = "Resolve: ticket created";
/** Applied by Resolve when the linked record reaches a terminal state. */
export const CLOSED_TAG = "Resolve: ticket closed";

/**
 * Applied by a person to a homeowner's reply. Files that reply against the
 * decision it answers. It never decides anything on the homeowner's behalf.
 */
export const OWNER_RESPONSE_TAG = "Resolve: Owner Approval Response";
/** Applied by Resolve once the reply is filed and visible to staff. */
export const OWNER_RESPONSE_FILED_TAG = "Resolve: owner response received";

/**
 * The retired "task" vocabulary. Never written again, but still recognised so
 * mail handled under the old protocol is never reprocessed into a duplicate.
 */
export const LEGACY_CREATE_TAG = "Resolve: create task";
export const LEGACY_CREATED_TAG = "Resolve: task created";
export const LEGACY_COMPLETED_TAG = "Resolve task: task completed";

/** Every category Resolve is allowed to add or remove. */
export const RESOLVE_TAGS = [
  CREATE_TICKET_TAG,
  CREATE_LEAD_TAG,
  CREATED_TAG,
  CLOSED_TAG,
  OWNER_RESPONSE_TAG,
  OWNER_RESPONSE_FILED_TAG,
  LEGACY_CREATE_TAG,
  LEGACY_CREATED_TAG,
  LEGACY_COMPLETED_TAG,
];


export type TriggerKind = "ticket" | "lead";

type Categories = readonly (string | null | undefined)[] | null | undefined;

function clean(categories: Categories) {
  return (categories ?? []).map((c) => (c ?? "").trim()).filter(Boolean);
}

/** Exact, case-insensitive match — "resolve: create ticket please" does not count. */
export function hasTag(categories: Categories, tag: string) {
  const wanted = tag.toLowerCase();
  return clean(categories).some((c) => c.toLowerCase() === wanted);
}

/**
 * What a person asked Resolve to create, if anything.
 *
 * Nothing is ever created without one of these. If both trigger categories are
 * somehow present, the Lead wins: it is the more specific instruction, and
 * creating the wrong object type is worse than creating the narrower one.
 */
export function triggerKind(categories: Categories): TriggerKind | null {
  if (hasTag(categories, CREATE_LEAD_TAG)) return "lead";
  if (hasTag(categories, CREATE_TICKET_TAG)) return "ticket";
  return null;
}

/** True when a person asked for this message to become work of any kind. */
export function requestsRecord(categories: Categories) {
  return triggerKind(categories) !== null;
}

/** True when a person marked this message as a homeowner's answer. */
export function requestsOwnerResponse(categories: Categories) {
  return hasTag(categories, OWNER_RESPONSE_TAG) && !hasTag(categories, OWNER_RESPONSE_FILED_TAG);
}

/** True when Resolve has already acted on this message. */
export function alreadyTagged(categories: Categories) {
  return (
    hasTag(categories, CREATED_TAG) ||
    hasTag(categories, CLOSED_TAG) ||
    hasTag(categories, OWNER_RESPONSE_FILED_TAG) ||
    hasTag(categories, LEGACY_CREATED_TAG) ||
    hasTag(categories, LEGACY_COMPLETED_TAG)
  );
}


/**
 * Swaps every Resolve category for one, keeping each unrelated category the
 * team applied — de-duplicated, order preserved.
 */
export function withTag(categories: Categories, tag: string): string[] {
  const keep = clean(categories).filter((c) => !RESOLVE_TAGS.some((t) => t.toLowerCase() === c.toLowerCase()));
  const seen = new Set<string>();
  return [...keep, tag].filter((c) => {
    const key = c.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Categories to write once the Ticket or Lead is confirmed saved. */
export function categoriesAfterCreate(categories: Categories) {
  return withTag(categories, CREATED_TAG);
}

/** Categories to write once the linked record is closed, converted or lost. */
export function categoriesAfterClose(categories: Categories) {
  return withTag(categories, CLOSED_TAG);
}

/** Categories to write when a closed Ticket is reopened. */
export function categoriesAfterReopen(categories: Categories) {
  return withTag(categories, CREATED_TAG);
}
