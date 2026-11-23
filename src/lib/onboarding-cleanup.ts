import type { EnrollmentReceipt } from "./active-owner-enrollment";

export type IntakeReceipt = {
  propertyId: string | null;
  propertyName: string;
  steps: { key: "property" | "plan" | "activeOwner"; status: "done" | "failed" | "not_reached" | "not_requested"; detail?: string }[];
  enrollment: EnrollmentReceipt | null;
};

/** Retain the canonical home on failure. Retries never replay a successful intake. */
/**
 * Active Owner is open to everyone who can add a home (Admin, Nov 23): the enrollment runs on the
 * server through the one automatic path; a missing detail comes back as a notice, never a block.
 */
export async function runPropertySetup(options: { startPlan: boolean; activeOwner: boolean }, previous: IntakeReceipt | null, actions: {
  intake: () => Promise<{ id: string; name: string }>;
  plan: (id: string) => Promise<unknown>;
  enroll: (id: string) => Promise<EnrollmentReceipt & { notice?: string | null }>;
}): Promise<IntakeReceipt> {
  const result: IntakeReceipt = previous ? structuredClone(previous) : { propertyId: null, propertyName: "", enrollment: null,
    steps: [{ key: "property", status: "not_reached" }, { key: "plan", status: options.startPlan ? "not_reached" : "not_requested" }, { key: "activeOwner", status: options.activeOwner ? "not_reached" : "not_requested" }] };
  for (const step of result.steps) {
    if (step.status === "done" || step.status === "not_requested") continue;
    try {
      if (step.key === "property") { const home = await actions.intake(); result.propertyId = home.id; result.propertyName = home.name; }
      else {
        if (!result.propertyId) throw new Error("Add the property before continuing.");
        if (step.key === "plan") await actions.plan(result.propertyId);
        else {
          const { notice, ...enrollment } = await actions.enroll(result.propertyId);
          result.enrollment = enrollment;
          if (!enrollment.complete) throw new Error(notice || "Active Owner setup needs attention. Retry the unfinished steps.");
          step.status = "done"; delete step.detail;
          if (notice) step.detail = notice;
          continue;
        }
      }
      step.status = "done"; delete step.detail;
    } catch (e) { step.status = "failed"; step.detail = e instanceof Error ? e.message : "This step did not finish."; return result; }
  }
  return result;
}

export type OwnerTabItem = { id: string; kind: "request" | "review" | "ops"; title: string; status: string; sentAt: string | null; completedAt: string | null; ownerAt: string | null; staffAt: string | null; activity: string; fromOperations?: boolean; ticketId?: string | null; typeLabel?: string | undefined };
export function ownerTabGroup(item: OwnerTabItem) {
  if (["complete", "completed", "closed"].includes(item.status)) return "completed";
  if (["draft", "prepared"].includes(item.status)) return "drafts";
  if (item.ownerAt && (!item.staffAt || item.ownerAt > item.staffAt)) return "attention";
  return "waiting";
}
export function groupOwnerTab(items: OwnerTabItem[]) {
  const groups = { attention: [] as OwnerTabItem[], waiting: [] as OwnerTabItem[], completed: [] as OwnerTabItem[], drafts: [] as OwnerTabItem[] };
  for (const item of items) groups[ownerTabGroup(item)].push(item);
  return groups;
}
export function waitingDays(sentAt: string | null, now: number) { return sentAt ? Math.max(0, Math.floor((now - Date.parse(sentAt)) / 86400000)) : null; }

export type HandoffRequirement = { id: string; title: string; stage: string; assigned_seat: string | null; due_on: string | null; status: string; tags: string[] | null };
export function handoffSummary<T extends HandoffRequirement>(requirements: T[], today: string) {
  const done = requirements.filter((t) => ["complete", "done"].includes(t.status));
  const open = requirements.filter((t) => !["complete", "done"].includes(t.status));
  const overdue = open.filter((t) => t.due_on && t.due_on < today).sort((a,b) => (a.due_on ?? "").localeCompare(b.due_on ?? ""));
  const next = open.filter((t) => t.due_on && t.due_on >= today).sort((a,b) => (a.due_on ?? "").localeCompare(b.due_on ?? "")).slice(0,5);
  const stages = [...new Set(requirements.map((t) => t.stage))].map((stage) => { const tasks = requirements.filter((t) => t.stage === stage); return { stage, tasks, done: tasks.filter((t) => ["complete","done"].includes(t.status)).length, total: tasks.length }; });
  return { total: requirements.length, done: done.length, open, overdue, next, stages };
}