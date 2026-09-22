/**
 * Onboarding deadlines, anchored to the day the team gets access (possession).
 *
 * Source of truth for the named steps is the Asana template
 * "New House Setup - Enhanced 1" — each of those steps keeps the exact day
 * offset the team already works to. Everything else is paced across the
 * setup window in the order the plan runs, so no step lands without a date
 * and nothing is invented out of order.
 *
 * Window: 21 days for a standard home, 28 for an Active Owner home (the
 * owner's participation work needs the extra week).
 */

export const STANDARD_WINDOW_DAYS = 21;
export const ACTIVE_OWNER_WINDOW_DAYS = 28;

export function setupWindowDays(activeOwner: boolean) {
  return activeOwner ? ACTIVE_OWNER_WINDOW_DAYS : STANDARD_WINDOW_DAYS;
}

/**
 * The Asana steps with a stated day offset. Matching is on the meaning of the
 * title, not an exact string, because Resolve's wording of the same step
 * differs slightly from Asana's.
 */
export const ASANA_OFFSETS: { match: RegExp; days: number; asana: string }[] = [
  {
    asana: "Complete New House Onboarding form and email property manager",
    match: /new house onboarding form|warm transfer to pm/i,
    days: 0,
  },
  {
    asana: "Schedule handyman walkthrough",
    match: /schedule .*handyman.*walkthrough|assessment date\/time from realtor/i,
    days: 2,
  },
  {
    asana: "Take measurements and complete New House Setup Form",
    match: /take measurements|complete the new house setup form|new house setup form results/i,
    days: 5,
  },
  {
    asana: "Hold video call w/ realtor during walkthrough",
    match: /video call w\/? realtor|walkthrough videos posted/i,
    days: 5,
  },
  {
    asana: "Set up property in Breezeway",
    match: /set ?up .*breezeway|breezeway .*details.*finalize setup/i,
    days: 7,
  },
  { asana: "Initial owner call", match: /initial owner call|introduction e-?mail to prospective owner/i, days: 7 },
  {
    asana: "Review inspection report / begin compiling repair estimate",
    match: /review .*inspection report|begin compiling repair estimate|save assessment report/i,
    days: 8,
  },
  {
    asana: "Obtain repair estimates from handyman and other vendors",
    match: /repair estimates from handyman/i,
    days: 9,
  },
  { asana: "Purchase curtain panels", match: /purchase curtain panels/i, days: 14 },
  {
    asana: "Purchase curtain rods / door locks / hardware",
    match: /purchase door locks, curtain rods|purchase curtain rods/i,
    days: 14,
  },
  { asana: "Create 3D room models", match: /3d room model/i, days: 14 },
  {
    asana: "Create mood boards / furniture pick list",
    match: /mood board|furniture pick list/i,
    days: 18,
  },
  { asana: "Essentials list to warehouse", match: /essentials list/i, days: 18 },
];

/** The Asana offset for a step title, or null when the plan does not state one. */
export function asanaOffsetFor(title: string): number | null {
  const hit = ASANA_OFFSETS.find((o) => o.match.test(title ?? ""));
  return hit ? hit.days : null;
}

/**
 * Where an unnamed step lands: spread evenly across the window in plan order,
 * so the plan paces itself instead of stacking every remaining step on the
 * same day. Position is 0-based; total is how many steps the plan has.
 */
export function pacedOffset(position: number, total: number, windowDays: number): number {
  if (total <= 1) return windowDays;
  const share = Math.min(Math.max(position, 0), total - 1) / (total - 1);
  return Math.round(share * windowDays);
}

/**
 * The day offset from access for one step. Named Asana steps keep their stated
 * day; on an Active Owner home they stretch with the longer window so the
 * shape of the plan stays the same.
 */
export function offsetFromAccess(input: {
  title: string;
  position: number;
  total: number;
  windowDays: number;
}): number {
  const stated = asanaOffsetFor(input.title);
  if (stated !== null) {
    if (input.windowDays === STANDARD_WINDOW_DAYS) return stated;
    return Math.round((stated * input.windowDays) / STANDARD_WINDOW_DAYS);
  }
  return pacedOffset(input.position, input.total, input.windowDays);
}
