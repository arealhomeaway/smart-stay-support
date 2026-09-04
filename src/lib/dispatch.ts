/**
 * Nearest-and-best vendor ranking (pure, shared by server and UI).
 *
 * Three things decide who gets a job, in the order a coordinator would weigh
 * them on the phone: can they be there fast (distance), do they do the work
 * all the way (score / Gold Standard), and are they already buried in open
 * jobs (current load).
 */

import { TIER_LABEL, type Tier } from "./scorecard";

export type VendorCandidate = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  tier: Tier;
  points: number;
  ratedJobs: number;
  averageOverall: number | null;
  fleetAverage: number | null;
  /** Metres from the home, using the vendor's most recent site check-in. */
  distanceM: number | null;
  /** When that location reading was taken. */
  lastSeenAt: string | null;
  /** Open jobs already dispatched to them. */
  openJobs: number;
  score: number;
  reasons: string[];
};

const TIER_WEIGHT: Record<Tier, number> = { gold: 30, trusted: 15, rising: 0 };

/** 0-100-ish fit score. Higher is a better dispatch for this ticket. */
export function candidateScore(input: {
  tier: Tier;
  averageOverall: number | null;
  ratedJobs: number;
  distanceM: number | null;
  openJobs: number;
  urgent: boolean;
}) {
  // Distance: full marks inside 5 km, fading to zero at 60 km. Unknown
  // location sits mid-pack so a new vendor isn't buried for lack of data.
  let proximity = 18;
  if (input.distanceM != null) {
    const km = input.distanceM / 1000;
    proximity = km <= 5 ? 40 : Math.max(0, Math.round(40 - ((km - 5) / 55) * 40));
  }
  if (input.urgent) proximity = Math.round(proximity * 1.25);

  const quality =
    (input.averageOverall != null ? ((input.averageOverall - 1) / 4) * 30 : 12) +
    TIER_WEIGHT[input.tier];

  const experience = Math.min(10, input.ratedJobs * 2);
  const load = Math.min(20, input.openJobs * 7);

  return Math.max(0, Math.round(proximity + quality + experience - load));
}

export function candidateReasons(c: {
  tier: Tier;
  distanceM: number | null;
  averageOverall: number | null;
  fleetAverage: number | null;
  openJobs: number;
  ratedJobs: number;
}) {
  const reasons: string[] = [];
  if (c.distanceM != null) {
    const km = c.distanceM / 1000;
    reasons.push(km < 1 ? "Last seen at this home" : `Last worked ${formatKm(c.distanceM)} away`);
  } else {
    reasons.push("No recent location on file");
  }
  if (c.tier === "gold") reasons.push(TIER_LABEL.gold);
  else if (c.tier === "trusted") reasons.push(TIER_LABEL.trusted);
  if (c.averageOverall != null) {
    const vsFleet =
      c.fleetAverage != null
        ? c.averageOverall >= c.fleetAverage
          ? " (above average)"
          : " (below average)"
        : "";
    reasons.push(
      `${c.averageOverall.toFixed(1)}/5 across ${c.ratedJobs} scored job${c.ratedJobs === 1 ? "" : "s"}${vsFleet}`,
    );
  } else {
    reasons.push("No scored jobs yet");
  }
  if (c.openJobs > 0)
    reasons.push(`${c.openJobs} open job${c.openJobs === 1 ? "" : "s"} right now`);
  return reasons;
}

export function formatKm(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}
