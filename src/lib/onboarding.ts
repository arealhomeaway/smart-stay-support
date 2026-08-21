/** Property lifecycle + onboarding model (browser-safe). */

export type LifecycleStatus =
  | "onboarding"
  | "handoff_requested"
  | "handoff_corrections"
  | "active_operations"
  | "paused"
  | "offboarded";

export const LIFECYCLE: { value: LifecycleStatus; label: string; tone: string; blurb: string }[] = [
  {
    value: "onboarding",
    label: "Onboarding",
    tone: "bg-primary/10 text-primary border-primary/20",
    blurb: "Pre-handoff work. Not yet an operational home.",
  },
  {
    value: "handoff_requested",
    label: "Handoff requested",
    tone: "bg-amber-100 text-amber-900 border-amber-200",
    blurb: "Waiting on an Operations Supervisor review.",
  },
  {
    value: "handoff_corrections",
    label: "Corrections required",
    tone: "bg-destructive/10 text-destructive border-destructive/20",
    blurb: "Returned to onboarding with required corrections.",
  },
  {
    value: "active_operations",
    label: "Active operations",
    tone: "bg-emerald-100 text-emerald-900 border-emerald-200",
    blurb: "Accepted by operations. Full homeowner portal is live.",
  },
  {
    value: "paused",
    label: "Paused",
    tone: "bg-muted text-muted-foreground border-border",
    blurb: "Temporarily out of service.",
  },
  {
    value: "offboarded",
    label: "Offboarded",
    tone: "bg-muted text-muted-foreground border-border",
    blurb: "No longer managed. History retained.",
  },
];

export function lifecycleMeta(value: string | null | undefined) {
  return LIFECYCLE.find((l) => l.value === value) ?? LIFECYCLE[3]!;
}

export const ONBOARDING_STAGES = [
  { value: "intake", label: "Intake & agreement" },
  { value: "records", label: "Records & systems" },
  { value: "readiness", label: "Property readiness" },
  { value: "listing", label: "Listing & launch prep" },
  { value: "verification", label: "Inspection & verification" },
] as const;

export type OnboardingStage = (typeof ONBOARDING_STAGES)[number]["value"];

export function stageLabel(value: string | null | undefined) {
  return ONBOARDING_STAGES.find((s) => s.value === value)?.label ?? "Intake & agreement";
}

export const TASK_STATUSES = ["open", "blocked", "complete", "carryover"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type HandoffCheck = {
  key: string;
  label: string;
  passed: boolean;
  blocking: boolean;
  detail: string;
};

export type OnboardingTask = {
  id: string;
  property_id: string;
  stage: string;
  title: string;
  detail: string | null;
  assigned_to: string | null;
  due_on: string | null;
  blocker: string | null;
  requires_owner_approval: boolean;
  owner_approval_status: string;
  evidence_required: boolean;
  evidence_note: string | null;
  status: string;
  blocks_handoff: boolean;
  carryover_reason: string | null;
  completed_at: string | null;
  created_at: string;
};

export function isOverdue(task: Pick<OnboardingTask, "due_on" | "status">) {
  if (!task.due_on || task.status === "complete") return false;
  return new Date(task.due_on) < new Date(new Date().toDateString());
}
