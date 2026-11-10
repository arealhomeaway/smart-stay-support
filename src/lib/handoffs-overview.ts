/**
 * The read only Handoffs page (register A1, A16; Emily, Nov 9). Pure and browser-safe.
 *
 * The Operations Supervisor sees Onboarding only through this page: every home in
 * onboarding with its handoff status, the Committed Handoff Date, the handoff items
 * still open, the carry over items after handoff and who marked it ready. It reads the
 * same handoff standard the home's handoff tab reads (homeRequirements) and changes nothing.
 */
import { homeLifecycle, type HomeLifecycle } from "@/lib/home-context";
import {
  homeRequirements,
  type HomeDecision,
  type StandardRequirement,
  type StandardTask,
} from "@/lib/handoff-standard";
import { PROPOSED_HANDOFF_STANDARD } from "@/lib/handoff-standard-seed";

export const HANDOFFS_COPY = {
  title: "Handoffs",
  description: "Every home in onboarding and where its handoff stands.",
  committed: "Committed Handoff Date",
  notSet: "Not set",
  readyBy: (role: string, on: string) => `Marked ready by ${role} on ${on}`,
  notReady: "Not marked ready yet",
  openItems: (n: number) => (n === 1 ? "1 handoff item still open" : `${n} handoff items still open`),
  noOpenItems: "No handoff items open",
  carryOvers: (n: number) => (n === 1 ? "1 carry over item" : `${n} carry over items`),
  noCarryOvers: "No carry over items",
  openHome: "Open the home",
  empty: "No homes are in onboarding right now.",
  failed: "Handoffs could not be loaded. Try again in a minute.",
} as const;

/** The role that marked a home ready, by the roles that person holds. Never a name. */
export function readyByRole(input: { isAdmin: boolean; roleCodes: readonly string[] }): string {
  const has = (...codes: string[]) => codes.some((c) => input.roleCodes.includes(c));
  if (has("director_onboarding", "onboarding_director")) return "Director of Onboarding";
  if (has("director_ops")) return "Director of Operations";
  if (input.isAdmin) return "Admin";
  if (has("onboarding_project_manager", "project_manager")) return "Project Manager";
  return "the Onboarding team";
}

export type HandoffProjectRow = {
  id: string;
  property_id: string;
  handoff_state: string | null;
  status: string;
  target_handoff_on: string | null;
  ready_for_ops_at: string | null;
  is_demo: boolean;
};

export type HandoffStandard = {
  available: boolean;
  requirements: StandardRequirement[];
  tasks: StandardTask[];
  decisions: HomeDecision[];
  carryovers: { id: string; ticket_id: string; title: string; status: string; due_on: string }[];
};

export type HandoffOverviewRow = {
  projectId: string;
  propertyId: string;
  home: string;
  place: string;
  status: HomeLifecycle;
  committedOn: string | null;
  readyAt: string | null;
  readyBy: string | null;
  openItems: { id: string; name: string; category: string }[];
  carryOvers: { id: string; ticketId: string; title: string; dueOn: string }[];
  demo: boolean;
};

/** One home's line on the page. */
export function handoffOverviewRow(input: {
  project: HandoffProjectRow;
  home: { primary: string; secondary: string };
  lifecycleStatus: string | null;
  readyBy: string | null;
  standard: HandoffStandard | null;
}): HandoffOverviewRow {
  const s = input.standard;
  const defs = s?.available ? s.requirements : PROPOSED_HANDOFF_STANDARD;
  const req = homeRequirements(defs, s?.tasks ?? [], s?.decisions ?? []);
  const open = req
    .filter((r) => r.state === "open" || r.state === "unlinked")
    .map((r) => ({ id: r.id, name: r.name, category: r.category }));
  return {
    projectId: input.project.id,
    propertyId: input.project.property_id,
    home: input.home.primary,
    place: input.home.secondary,
    status: homeLifecycle({ lifecycleStatus: input.lifecycleStatus, handoffState: input.project.handoff_state }),
    committedOn: input.project.target_handoff_on,
    readyAt: input.project.ready_for_ops_at,
    readyBy: input.project.ready_for_ops_at ? input.readyBy ?? "the Onboarding team" : null,
    // After acceptance the open items live on as carry over items, so they are not repeated.
    openItems: input.project.handoff_state === "accepted" ? [] : open,
    carryOvers: (s?.carryovers ?? []).map((c) => ({ id: c.id, ticketId: c.ticket_id, title: c.title, dueOn: c.due_on })),
    demo: input.project.is_demo,
  };
}

/** Homes on the page: every project still in onboarding, and handed off homes with open carry over items. */
export function handoffsShown(rows: HandoffOverviewRow[], project: (id: string) => HandoffProjectRow | undefined) {
  return rows.filter((r) => {
    const p = project(r.projectId);
    if (!p || p.status === "cancelled") return false;
    return p.handoff_state !== "accepted" || r.carryOvers.length > 0;
  });
}

/** Soonest Committed Handoff Date first; homes with no date after them; then by address. */
export function sortHandoffs<T extends { committedOn: string | null; home: string }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      (a.committedOn ?? "9999-12-31").localeCompare(b.committedOn ?? "9999-12-31") || a.home.localeCompare(b.home),
  );
}
