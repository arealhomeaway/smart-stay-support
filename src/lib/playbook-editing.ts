import { z } from "zod";
import type { AccessSeats, AppRole } from "./permissions";
import type { AuthoredPlaybook } from "./playbooks";

export function canManagePlaybooks(roles: readonly AppRole[], seats: AccessSeats = {}) {
  return roles.includes("admin") || Boolean(seats.opsDirector || seats.onboardingDirector);
}
export const playbookStepSchema = z.object({
  instruction: z.string().trim().min(1), detail: z.string().nullable(),
  required: z.boolean(), photo_required: z.boolean(),
});
export const playbookContentSchema = z.object({
  title: z.string().trim().min(1).max(250), summary: z.string().nullable(), category: z.string().trim().min(1),
  applies_to: z.array(z.enum(["ticket", "work_order", "recovery", "claim"])).min(1),
  keywords: z.array(z.string().trim().min(1)),
  risk_flags: z.array(z.object({ title: z.string().trim().min(1), why: z.string().nullable() })),
  immediate_actions: z.array(z.string().trim().min(1)), escalate_if: z.array(z.string().trim().min(1)),
  required_evidence: z.array(z.string().trim().min(1)), steps: z.array(playbookStepSchema),
});
export type PlaybookStepEdit = z.infer<typeof playbookStepSchema>;
export type PlaybookContent = z.infer<typeof playbookContentSchema>;
export function playbookEditContent(pb: AuthoredPlaybook, steps: PlaybookStepEdit[]): PlaybookContent {
  return { title: pb.title, summary: pb.summary, category: pb.category, applies_to: pb.applies_to,
    keywords: pb.matcher.keywords ?? [], risk_flags: pb.risk_flags, immediate_actions: pb.immediate_actions,
    escalate_if: pb.escalate_if, required_evidence: pb.required_evidence, steps };
}
export function reorderPlaybookSteps<T>(steps: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || target < 0 || target >= steps.length) return steps;
  const next = [...steps];
  const a = next[index]; const b = next[target];
  if (a === undefined || b === undefined) return steps;
  next[index] = b; next[target] = a;
  return next;
}