/**
 * "Ways to participate this week" — stage-aware suggestions for the homeowner.
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
  "These are opportunities to take part in running your home. Log only the time you actually spend. ARHA does not provide tax advice and does not promise any outcome from your participation.";

const RELEVANCE_DECISION = "A decision you make about your own home.";
const RELEVANCE_GUEST = "Shapes what your guests see and experience.";
const RELEVANCE_OPERATING = "Hands-on work in operating your rental.";
const RELEVANCE_OVERSIGHT = "Oversight of the work happening at your home.";

const ONBOARDING_PROMPTS: ParticipationPrompt[] = [
  {
    id: "mood-board",
    title: "Review the design direction",
    description:
      "Look through the mood boards and layout ideas your team has shared, then approve them or tell us what you would change.",
    relevance: RELEVANCE_DECISION,
  },
  {
    id: "guidebook",
    title: "Curate local recommendations",
    description:
      "Write down the restaurants, coffee shops and walks you would send a friend to, so we can build them into the digital guidebook.",
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
    id: "access",
    title: "Set your access and Wi-Fi preferences",
    description:
      "Confirm how you want the smart lock, Wi-Fi network and entry instructions set up for guests and vendors.",
    relevance: RELEVANCE_DECISION,
  },
];

const ONGOING_PROMPTS: ParticipationPrompt[] = [
  {
    id: "work-review",
    title: "Review recent property work",
    description:
      "Read through what happened at your homes recently and add your own notes or questions for the team.",
    relevance: RELEVANCE_OVERSIGHT,
  },
  {
    id: "guidebook-refresh",
    title: "Refresh your local recommendations",
    description:
      "Update the guidebook with new places you have tried, seasonal events and anything that has closed.",
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
    id: "planning",
    title: "Plan the season ahead",
    description:
      "Think through pricing preferences, blocked dates and any upgrades you want to consider at your homes.",
    relevance: RELEVANCE_DECISION,
  },
];

const PENDING_DECISION_PROMPT: ParticipationPrompt = {
  id: "pending-actions",
  title: "Answer what is waiting on you",
  description:
    "Your team has sent items for your review. Working through them keeps your home moving forward.",
  relevance: RELEVANCE_DECISION,
};

/**
 * Three to four suggestions, ordered so anything already waiting on the
 * homeowner comes first. Deterministic — the same inputs always produce the
 * same cards, so the portal does not reshuffle between renders.
 */
export function buildParticipationPrompts(input: {
  phase: string | null | undefined;
  pendingOnboardingActions?: number;
  openReviews?: number;
}): ParticipationPrompt[] {
  const onboarding = (input.phase ?? "").toLowerCase() === "onboarding";
  const base = onboarding ? ONBOARDING_PROMPTS : ONGOING_PROMPTS;
  const waiting = (input.pendingOnboardingActions ?? 0) + (input.openReviews ?? 0) > 0;
  const prompts = waiting ? [PENDING_DECISION_PROMPT, ...base] : base;
  return prompts.slice(0, 4);
}
