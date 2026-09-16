import type { Database } from "@/integrations/supabase/types";
import { validateHandoff } from "./onboarding";
import { handoffReadiness } from "./onboarding-state";
import { projectScope, splitByScope } from "./onboarding-scope";
import type { StageCapture } from "./onboarding-stage";

type Tables = Database["public"]["Tables"];
export type OnboardingHandoffSnapshot = {
  property: Tables["properties"]["Row"];
  project: Tables["onboarding_projects"]["Row"] | null;
  tasks: Tables["onboarding_tasks"]["Row"][];
  stageCaptures: StageCapture[];
  pendingFacts: { id: string }[];
};

export function prepareOnboardingHandoff(
  snapshot: OnboardingHandoffSnapshot,
  carryoverAccepted: boolean,
) {
  if (
    !snapshot?.property ||
    !snapshot.project ||
    !["planning", "active"].includes(snapshot.project.status)
  ) {
    throw new Error("Start an active Onboarding Project before requesting handoff.");
  }
  const applicable = splitByScope(snapshot.tasks, projectScope(snapshot.project)).inScope;
  const { checks, openBlocking } = validateHandoff(snapshot.property, applicable);
  const readiness = handoffReadiness(
    {
      property: snapshot.property,
      project: snapshot.project,
      tasks: applicable,
      stageCaptures: snapshot.stageCaptures,
      handoff: null,
    },
    checks,
    { pendingFacts: snapshot.pendingFacts.length },
  );
  if (readiness.blocked)
    throw new Error(
      `Handoff is blocked and cannot be requested: ${readiness.hardReasons.map((r) => r.label).join("; ")}.`,
    );
  const carryover = applicable.filter((t) => t.status !== "complete");
  if (carryover.length && !carryoverAccepted)
    throw new Error(
      "Explicitly accept the remaining items as carryover before requesting handoff.",
    );
  if (carryover.some((t) => !t.assigned_to || !t.due_on || !t.carryover_reason?.trim()))
    throw new Error(
      "Every carried-over item needs an assigned owner, a due date and a carryover reason before handoff.",
    );
  return {
    checks,
    openBlocking,
    ready: readiness.ready,
    openTaskIds: carryover.map((t) => t.id),
    applicableTaskIds: applicable.map((t) => t.id),
  };
}
