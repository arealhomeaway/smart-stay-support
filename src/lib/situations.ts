/**
 * Situation-first ticket intake.
 *
 * "Make the user choose the situation. Let Resolve choose the work type."
 *
 * Pure presentation: this file maps plain-language situations onto the
 * existing `work_types` catalog by name. It writes nothing, decides no
 * permissions and changes no standards — the resolved work type still
 * supplies category, bucket, owning seat, SLA minutes, closure evidence and
 * playbook exactly as before.
 */

export type SituationGroup = "guest" | "home" | "owner" | "internal";

export type Situation = {
  id: string;
  group: SituationGroup;
  label: string;
  hint: string;
  /** Candidate work type names, best match first. Resolved against live rows. */
  workTypeNames: string[];
  /** Optional starting answers for the two contextual questions. */
  guestImpact?: string;
  occupancy?: string;
  /**
   * Highest priority this situation may reach on its own. Service failures
   * during a stay are time-sensitive, not emergencies — a safety or security
   * impact still overrides the ceiling.
   */
  priorityCeiling?: string;
  /** Words a coordinator is likely to type for this situation. */
  keywords?: string[];
  /** Internal situations open the full catalog instead of resolving one type. */
  openCatalog?: boolean;
};

export const SITUATION_GROUPS: { key: SituationGroup; label: string }[] = [
  { key: "guest", label: "Guest" },
  { key: "home", label: "Home" },
  { key: "owner", label: "Owner" },
  { key: "internal", label: "Internal" },
];

export const SITUATIONS: Situation[] = [
  {
    id: "guest_needs_now",
    group: "guest",
    label: "A guest needs something right now",
    hint: "In the home and waiting on us.",
    workTypeNames: ["Current or past guest request"],
    guestImpact: "active_guest_affected",
    occupancy: "occupied",
    priorityCeiling: "p2",
    keywords: ["guest needs", "guest asked", "towels", "wifi", "parking", "supplies", "request"],
  },
  {
    id: "arrival_info",
    group: "guest",
    label: "Arrival or check-in information",
    hint: "Codes, directions, parking, early access.",
    workTypeNames: ["Arrival information"],
    occupancy: "same_day_arrival",
    keywords: ["check in", "check-in", "arrival", "code", "directions", "early access", "parking"],
  },
  {
    id: "new_booking",
    group: "guest",
    label: "New booking or inquiry",
    hint: "Someone wants to stay.",
    workTypeNames: ["New booking request", "Tenant lead tracker"],
    keywords: ["booking", "inquiry", "wants to stay", "availability", "reservation request"],
  },
  {
    id: "review_log",
    group: "guest",
    label: "Review, survey or rating to log",
    hint: "After the stay.",
    workTypeNames: ["Guest review, survey and rating logs"],
    keywords: ["review", "survey", "rating", "feedback"],
  },
  {
    id: "unsafe",
    group: "home",
    label: "Something is unsafe",
    hint: "Smoke, gas, water, fire or security.",
    workTypeNames: ["Immediate maintenance"],
    guestImpact: "safety_security",
    keywords: ["smoke", "gas", "fire", "flood", "flooding", "sewage", "carbon monoxide", "break in", "break-in", "intruder", "unsafe", "electrical", "sparking", "burst"],
  },
  {
    id: "broken_now",
    group: "home",
    label: "Something is broken and can't wait",
    hint: "No AC, no hot water, appliance down with a guest in the home.",
    workTypeNames: ["Immediate maintenance"],
    guestImpact: "active_guest_affected",
    occupancy: "occupied",
    priorityCeiling: "p2",
    keywords: ["not cooling", "not working", "broken", "no ac", "no a/c", "air conditioning", "hvac", "furnace", "heat", "no hot water", "refrigerator", "fridge", "freezer", "oven", "stove", "dishwasher", "washer", "dryer", "microwave", "leak", "clogged", "toilet", "won\u2019t", "wont", "stopped working"],
  },
  {
    id: "broken_later",
    group: "home",
    label: "Something needs repair, but not today",
    hint: "Wear, small defects, scheduled work.",
    workTypeNames: ["Ongoing maintenance"],
    keywords: ["repair", "replace", "worn", "loose", "scheduled", "touch up", "paint", "landscaping", "when convenient", "not urgent"],
  },
  {
    id: "clean_now",
    group: "home",
    label: "The home isn't clean and a guest is affected",
    hint: "Missed turnover, dirty home on arrival.",
    workTypeNames: ["Immediate cleaning need"],
    guestImpact: "active_guest_affected",
    priorityCeiling: "p2",
    keywords: ["dirty", "not clean", "missed clean", "turnover", "trash left", "unclean", "cleaner did not"],
  },
  {
    id: "clean_ongoing",
    group: "home",
    label: "Cleaning need, no guest waiting",
    hint: "Deep clean, linens, supplies, schedule change.",
    workTypeNames: ["Ongoing cleaning need"],
    keywords: ["deep clean", "linens", "supplies", "restock", "schedule clean"],
  },
  {
    // Someone is standing outside a home they are entitled to be inside.
    // That is a habitability and security failure, so it stays P1.
    id: "locked_out",
    group: "home",
    label: "Someone can't get into the home",
    hint: "Guest, cleaner or vendor locked out right now.",
    workTypeNames: ["Lock offline or low-battery alert"],
    guestImpact: "safety_security",
    occupancy: "occupied",
    keywords: [
      "locked out",
      "lock out",
      "cannot get in",
      "can\u2019t get in",
      "cant get in",
      "code is not working",
      "code not working",
      "keypad code",
      "keypad is not working",
      "keypad not working",
      "door will not open",
      "door won\u2019t open",
      "stuck outside",
    ],
  },
  {
    id: "access",
    group: "home",
    label: "Lock, gate or access device problem",
    hint: "Lockbox, smart lock, gate or garage — nobody is stranded.",
    workTypeNames: ["Lock offline or low-battery alert"],
    keywords: ["lock offline", "low battery", "lockbox", "gate", "garage", "smart lock", "keypad battery"],
  },
  {
    id: "owner_issue",
    group: "owner",
    label: "Owner question, concern or complaint",
    hint: "Anything an owner raised that needs a reply.",
    workTypeNames: ["Escalated owner issue"],
    keywords: ["owner", "homeowner complaint", "owner upset", "owner asked"],
  },
  {
    id: "owner_update",
    group: "owner",
    label: "Property or owner details need updating",
    hint: "Listing facts, contacts, preferences.",
    workTypeNames: ["Property or owner information update"],
    keywords: ["update listing", "owner details", "contact change", "preferences"],
  },
  {
    id: "damage_claim",
    group: "owner",
    label: "Damage or a claim to file",
    hint: "Platform or insurance claim.",
    workTypeNames: ["Claims"],
    keywords: ["damage", "claim", "broke it", "guest damaged", "insurance", "airbnb resolution"],
  },
  {
    id: "internal",
    group: "internal",
    label: "Internal or admin work",
    hint: "Portals, blocks, reviews, interdepartmental. Opens the full catalog.",
    workTypeNames: [],
    openCatalog: true,
  },
];

export function situationById(id: string | null | undefined) {
  return SITUATIONS.find((s) => s.id === id) ?? null;
}

type NamedWorkType = { id: string; name: string };

/**
 * Resolves the situation to a live work type row. Returns null when nothing
 * matches — the caller then falls back to the full work type select, so a
 * renamed catalog entry can never block ticket creation.
 */
export function resolveWorkType<T extends NamedWorkType>(
  situation: Situation | null,
  workTypes: T[] | null | undefined,
): T | null {
  if (!situation || !workTypes?.length) return null;
  for (const name of situation.workTypeNames) {
    const hit = workTypes.find((w) => w.name.toLowerCase() === name.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

/** Plain-language reason for the priority Resolve landed on. */
export function priorityReason(guestImpact: string, occupancy: string, fromWorkType: string) {
  if (guestImpact === "safety_security") return "a safety or security risk is involved";
  if (guestImpact === "active_guest_affected") return "a guest in the home is affected right now";
  if (occupancy === "same_day_arrival") return "a guest arrives today";
  if (occupancy === "occupied") return "the home is occupied";
  return `this kind of work is normally ${fromWorkType.toUpperCase()}`;
}
