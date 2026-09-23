/**
 * Optional, self-directed participation opportunities for the homeowner.
 *
 * These are NOT tasks. Anything the ARHA team needs from the homeowner lives
 * in "Needs your attention" instead. Everything here is something the
 * homeowner may choose to do on their own initiative and record afterwards.
 *
 * Two rules govern everything in this file:
 *  1. No time figures. ARHA never suggests, estimates or implies how long an
 *     activity should take. The homeowner logs the real time they spent.
 *  2. No tax advice. Wording describes an opportunity to participate in
 *     operating their own rental — never a promised benefit or outcome.
 */

export type ParticipationPrompt = {
  id: string;
  title: string;
  description: string;
  /** Why this matters for their own participation record. Never tax advice. */
  relevance: string;
};

export const PARTICIPATION_PROMPT_NOTE =
  "These are optional opportunities to take part in running your home — nobody is waiting on them. Log only the time you actually spend. ARHA does not provide tax advice and does not promise any outcome from your participation.";

const RELEVANCE_DECISION = "A decision you make about your own home.";
const RELEVANCE_GUEST = "Shapes what your guests see and experience.";
const RELEVANCE_OPERATING = "Hands-on work in operating your rental.";
const RELEVANCE_OVERSIGHT = "Oversight of the work happening at your home.";
const RELEVANCE_MARKET = "Your own read on the market your home competes in.";

/** Opportunities that suit a home still being set up. */
const ONBOARDING_PROMPTS: ParticipationPrompt[] = [
  {
    id: "guidebook",
    title: "Build your local area and dining guide",
    description:
      "Write down the restaurants, coffee shops, walks and day trips you would send a friend to, so we can build them into the digital guidebook.",
    relevance: RELEVANCE_GUEST,
  },
  {
    id: "house-notes",
    title: "Write your guest experience and house notes",
    description:
      "Capture the quirks of the home in your own words: how the coffee maker works, which door sticks, where the spare blankets live.",
    relevance: RELEVANCE_GUEST,
  },
  {
    id: "supplies",
    title: "Walk the supply list",
    description:
      "Check the linens, kitchen basics and consumables at the home and note what is missing before guests arrive.",
    relevance: RELEVANCE_OPERATING,
  },
  {
    id: "mood-board",
    title: "Gather design and furnishing inspiration",
    description:
      "Collect the looks, pieces and layouts you would like to see at your home and share them with your design team.",
    relevance: RELEVANCE_DECISION,
  },
  {
    id: "amenity-ideas",
    title: "Think through seasonal amenity ideas",
    description:
      "Consider what would make your home stand out season by season — patio setup, games, holiday touches, cold-weather comforts.",
    relevance: RELEVANCE_GUEST,
  },
  {
    id: "market-inspiration",
    title: "Study comparable homes nearby",
    description:
      "Browse listings similar to yours, note what they photograph, price and promise, and share anything worth copying.",
    relevance: RELEVANCE_MARKET,
  },
];

/** Opportunities that suit a home already hosting guests. */
const ONGOING_PROMPTS: ParticipationPrompt[] = [
  {
    id: "guidebook-refresh",
    title: "Refresh your local area and dining guide",
    description:
      "Update the guidebook with new places you have tried, seasonal events and anything that has closed.",
    relevance: RELEVANCE_GUEST,
  },
  {
    id: "house-notes-refresh",
    title: "Update your guest experience and house notes",
    description:
      "Read recent guest comments and rewrite the house notes, welcome message or instructions in your own voice.",
    relevance: RELEVANCE_GUEST,
  },
  {
    id: "supplies-ongoing",
    title: "Check supplies and small repairs",
    description:
      "Look over consumables, linens and small wear-and-tear items, and send us anything you want handled.",
    relevance: RELEVANCE_OPERATING,
  },
  {
    id: "amenity-ideas",
    title: "Plan seasonal amenity ideas",
    description:
      "Decide what you would like added or swapped for the coming season, from patio furniture to holiday touches.",
    relevance: RELEVANCE_GUEST,
  },
  {
    id: "market-inspiration",
    title: "Study comparable homes nearby",
    description:
      "Browse listings competing with yours, note their photos, amenities and positioning, and share what stands out.",
    relevance: RELEVANCE_MARKET,
  },
  {
    id: "planning",
    title: "Review recent work and plan ahead",
    description:
      "Read through what happened at your homes recently, then think through pricing preferences, blocked dates and upgrades worth considering.",
    relevance: RELEVANCE_OVERSIGHT,
  },
];

/**
 * Stage-aware optional opportunities. Deterministic — the same inputs always
 * produce the same cards, so the portal does not reshuffle between renders.
 * Nothing assigned by the ARHA team ever appears here.
 */
export function buildParticipationPrompts(input: {
  phase: string | null | undefined;
}): ParticipationPrompt[] {
  const onboarding = (input.phase ?? "").toLowerCase() === "onboarding";
  return onboarding ? ONBOARDING_PROMPTS : ONGOING_PROMPTS;
}
