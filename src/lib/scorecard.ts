/**
 * Vendor scorecard scoring rules (pure, shared by server and UI).
 *
 * Gamification is deliberately PRIVATE: a vendor sees their own points, tier,
 * streak and an anonymous percentile. No vendor ever sees another vendor's
 * name, score or rank — public leaderboards push partners away from hard P1
 * jobs and difficult homes, which is the opposite of what we want.
 */

export type RatingInput = {
  thoroughness: number; // 1-5
  communication: number; // 1-5
  timeliness: number; // 1-5
  photosComplete: boolean;
  onTime: boolean;
  reopened: boolean;
  priority?: string | null;
};

/** Average of the three 1-5 scores, rounded to 2dp. */
export function overallScore(r: Pick<RatingInput, "thoroughness" | "communication" | "timeliness">) {
  return Math.round(((r.thoroughness + r.communication + r.timeliness) / 3) * 100) / 100;
}

/**
 * Points reward thoroughness first: a job done all the way (sealed, painted,
 * photographed, no callback) is worth far more than a fast patch.
 */
export function jobPoints(r: RatingInput) {
  let points = 10; // showing up and closing it out
  points += (r.thoroughness - 3) * 8; // thoroughness carries the most weight
  points += (r.communication - 3) * 4;
  points += (r.timeliness - 3) * 4;
  if (r.photosComplete) points += 10;
  if (r.onTime) points += 8;
  if (r.reopened) points -= 20;
  if (r.priority === "p1") points += 6; // urgent work is worth taking
  return Math.max(0, Math.round(points));
}

export const GOLD_STANDARD_JOBS = 5;

export type Tier = "rising" | "trusted" | "gold";

export const TIER_LABEL: Record<Tier, string> = {
  rising: "Rising partner",
  trusted: "Trusted partner",
  gold: "Gold Standard partner",
};

export const TIER_BLURB: Record<Tier, string> = {
  rising: "Complete and score well on your first jobs to unlock Trusted partner.",
  trusted: "You're in our regular rotation. Five above-average jobs unlocks Gold Standard.",
  gold: "Top of our list for urgent work and priority dispatch.",
};

/** Gold Standard = 5+ completed jobs scored above the ARHA vendor average. */
export function tierFor(input: { ratedJobs: number; aboveAverageJobs: number }): Tier {
  if (input.aboveAverageJobs >= GOLD_STANDARD_JOBS) return "gold";
  if (input.ratedJobs >= 2) return "trusted";
  return "rising";
}
