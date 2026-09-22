/**
 * Owner-facing onboarding projection rules (browser-safe, data only).
 *
 * The homeowner sees how their onboarding is progressing and what is waiting
 * on them — never task titles, assignees, blockers, vendors or costs. The
 * four tracks are the same ones the project manager works from, so staff and
 * homeowner are always reading the same plan.
 */

import { WORKSTREAMS, trackForTask, type WorkstreamKey } from "./onboarding-workstreams";

export type OwnerTaskRow = { title: string; stage: string; status: string };

export type OwnerTrackProgress = {
  key: WorkstreamKey;
  label: string;
  done: number;
  total: number;
  percent: number;
};

const FINISHED = new Set(["complete", "carryover"]);

function percentOf(done: number, total: number) {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

/** Counts only. One meter per track, plus the overall figure. */
export function ownerTrackProgress(tasks: OwnerTaskRow[]) {
  const tracks: OwnerTrackProgress[] = WORKSTREAMS.map((meta) => {
    const inTrack = tasks.filter((t) => trackForTask(t) === meta.key);
    const done = inTrack.filter((t) => FINISHED.has(t.status)).length;
    return {
      key: meta.key,
      label: meta.label,
      done,
      total: inTrack.length,
      percent: percentOf(done, inTrack.length),
    };
  });
  const done = tracks.reduce((n, t) => n + t.done, 0);
  const total = tracks.reduce((n, t) => n + t.total, 0);
  return { tracks, done, total, percent: percentOf(done, total) };
}

/** Onboarding decisions are shown in their own section, not with the rest. */
export function isOnboardingAction(approval: { entity_type?: string | null }) {
  return approval.entity_type === "onboarding_task";
}
