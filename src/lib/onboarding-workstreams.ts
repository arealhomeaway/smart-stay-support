/**
 * Parallel onboarding workstreams.
 *
 * The 26-step master sequence still states the order of authority, but most of
 * the execution work does not have to happen one task at a time. This file
 * groups the plan into four tracks a project manager can push forward at the
 * same time, and answers the one question a PM asks every morning:
 * "what can I actually work on right now?"
 *
 * Data only. Nothing here reads or writes.
 */

import type { TaskView, WorkflowTask } from "@/lib/onboarding-workflow";
import { viewTask } from "@/lib/onboarding-workflow";
import type { ReleaseContext } from "@/lib/onboarding-state";

export const WORKSTREAM_KEYS = [
  "access_utilities",
  "furnishing_staging",
  "media_listing",
  "ops_readiness",
] as const;

export type WorkstreamKey = (typeof WORKSTREAM_KEYS)[number];

export type WorkstreamMeta = {
  key: WorkstreamKey;
  label: string;
  blurb: string;
};

export const WORKSTREAMS: WorkstreamMeta[] = [
  {
    key: "access_utilities",
    label: "Access & Utilities",
    blurb: "Keys, codes, accounts, permits and everything that lets people into the home.",
  },
  {
    key: "furnishing_staging",
    label: "Furnishing & Staging",
    blurb: "Design, purchasing, delivery, installation and the final staged look.",
  },
  {
    key: "media_listing",
    label: "Media & Listing",
    blurb: "Photos, copy, pricing and the listing going out to guests.",
  },
  {
    key: "ops_readiness",
    label: "Ops & Readiness",
    blurb: "Documents, inspections, approvals, handoff and closeout.",
  },
];

export function workstreamMeta(key: WorkstreamKey): WorkstreamMeta {
  return WORKSTREAMS.find((w) => w.key === key)!;
}

/** Title keywords decide the track first — they are the most specific signal. */
const KEYWORD_TRACKS: { track: WorkstreamKey; words: string[] }[] = [
  {
    track: "access_utilities",
    words: [
      "utility",
      "utilities",
      "electric",
      "water",
      "gas ",
      "internet",
      "wifi",
      "wi-fi",
      "trash",
      "lawn",
      "lock",
      "lockbox",
      "gate code",
      "key",
      "access",
      "alarm",
      "security system",
      "permit",
      "hoa",
      "license",
      "compliance",
      "insurance",
    ],
  },
  {
    track: "furnishing_staging",
    words: [
      "design",
      "furnish",
      "furniture",
      "decor",
      "stag",
      "purchas",
      "procure",
      "order",
      "deliver",
      "assembl",
      "install",
      "mattress",
      "linen",
      "kitchen",
      "supply",
      "supplies",
      "artwork",
      "tv ",
      "repair",
      "paint",
      "fieldwork",
      "punch list",
    ],
  },
  {
    track: "media_listing",
    words: [
      "photo",
      "photograph",
      "listing",
      "copy",
      "description",
      "pricing",
      "price",
      "rate",
      "channel",
      "airbnb",
      "vrbo",
      "ownerrez",
      "publish",
      "amenit",
      "welcome book",
      "guest guide",
      "house manual",
    ],
  },
  {
    track: "ops_readiness",
    words: [
      "document",
      "agreement",
      "contract",
      "w-9",
      "assessment",
      "inspection",
      "review",
      "approval",
      "handoff",
      "acceptance",
      "readiness",
      "clean",
      "walkthrough",
      "reconcile",
      "close",
      "budget",
      "scope",
      "invoice",
      "payment",
    ],
  },
];

/** Every remaining task lands in a track by the stage it belongs to. */
const STAGE_TRACKS: Record<string, WorkstreamKey> = {
  intake_identity: "ops_readiness",
  documents_assessment: "ops_readiness",
  scope_utilities_compliance: "access_utilities",
  design_approvals_procurement: "furnishing_staging",
  fieldwork_setup_review: "furnishing_staging",
  listing_final_clean: "media_listing",
  handoff_acceptance: "ops_readiness",
  closeout_stabilization: "ops_readiness",
  post_contract: "ops_readiness",
  phase1_inspection: "ops_readiness",
  phase2_estimates: "furnishing_staging",
  phase3_work_orders: "furnishing_staging",
  phase4_purchasing: "furnishing_staging",
  phase5_monitor: "furnishing_staging",
  phase6_handoff: "media_listing",
};

/** The track a single task belongs to. Never returns null — nothing is hidden. */
export function trackForTask(task: { title: string; stage: string }): WorkstreamKey {
  const title = ` ${task.title.toLowerCase()} `;
  for (const { track, words } of KEYWORD_TRACKS) {
    if (words.some((w) => title.includes(w))) return track;
  }
  return STAGE_TRACKS[task.stage] ?? "ops_readiness";
}

export type WorkstreamGroup = {
  key: WorkstreamKey;
  label: string;
  blurb: string;
  tasks: TaskView[];
  ready: TaskView[];
  waiting: TaskView[];
  done: number;
  total: number;
  /** 0-100, complete and carryover both count as finished work. */
  percent: number;
  state: "empty" | "complete" | "ready" | "waiting";
};

function isFinished(v: TaskView) {
  return v.status === "complete" || v.status === "carryover";
}

/** A task is workable today: actionable, not finished, not waiting on anything. */
export function isReadyNow(v: TaskView) {
  return v.canComplete && !isFinished(v) && (v.status === "ready" || v.status === "in_progress");
}

export function buildWorkstreams(
  tasks: WorkflowTask[],
  release?: ReleaseContext,
): WorkstreamGroup[] {
  const views = tasks.map((t) => viewTask(t, tasks, release));

  return WORKSTREAMS.map((meta) => {
    const inTrack = views
      .filter((v) => trackForTask(v.task) === meta.key)
      .sort((a, b) => a.task.sort_order - b.task.sort_order);
    const done = inTrack.filter(isFinished).length;
    const total = inTrack.length;
    const ready = inTrack.filter(isReadyNow);
    const waiting = inTrack.filter((v) => !isFinished(v) && !isReadyNow(v));

    let state: WorkstreamGroup["state"] = "empty";
    if (total > 0) {
      if (done === total) state = "complete";
      else if (ready.length > 0) state = "ready";
      else state = "waiting";
    }

    return {
      key: meta.key,
      label: meta.label,
      blurb: meta.blurb,
      tasks: inTrack,
      ready,
      waiting,
      done,
      total,
      percent: total === 0 ? 0 : Math.round((done / total) * 100),
      state,
    };
  });
}

export type ReadyItem = { view: TaskView; track: WorkstreamKey; trackLabel: string };

/**
 * Everything unblocked across every track, soonest due first, then overdue
 * work ahead of undated work.
 */
export function readyNowQueue(groups: WorkstreamGroup[]): ReadyItem[] {
  const items: ReadyItem[] = groups.flatMap((g) =>
    g.ready.map((view) => ({ view, track: g.key, trackLabel: g.label })),
  );

  return items.sort((a, b) => {
    if (a.view.overdue !== b.view.overdue) return a.view.overdue ? -1 : 1;
    const da = a.view.task.due_on ?? "";
    const db = b.view.task.due_on ?? "";
    if (da && db && da !== db) return da < db ? -1 : 1;
    if (da !== db) return da ? -1 : 1;
    return a.view.task.sort_order - b.view.task.sort_order;
  });
}

export function overallProgress(groups: WorkstreamGroup[]) {
  const done = groups.reduce((n, g) => n + g.done, 0);
  const total = groups.reduce((n, g) => n + g.total, 0);
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}
