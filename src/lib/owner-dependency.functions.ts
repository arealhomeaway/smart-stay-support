import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SELECTABLE_DEPENDENCIES, effectiveDependency, isProtectedDecision } from "@/lib/owner-dependency";

/**
 * Classify what a live Onboarding Task needs from the homeowner. Director or
 * the home's lead only. Moving a Task off "Business decision" removes only its
 * owner-approval hold (with a written reason, audited); nothing is sent to the
 * homeowner and the Task's status is untouched.
 */
export const setTaskOwnerDependency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        taskId: z.string().uuid(),
        dependency: z.enum(SELECTABLE_DEPENDENCIES as [string, ...string[]]),
        reason: z.string().trim().max(1000).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: task, error: readError } = await sb
      .from("onboarding_tasks")
      .select("id, title, property_id, status, owner_dependency, requires_owner_approval, owner_approval_status")
      .eq("id", data.taskId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!task) throw new Error("That Task was not found.");
    const { onboardingTaskAccess } = await import("./onboarding-task-access.server");
    const access = await onboardingTaskAccess(sb, context.userId, task.property_id, null);
    if (!access.canManage)
      throw new Error("Only the Onboarding Director or this home's lead can change what the Task needs from the homeowner.");

    const before = effectiveDependency(task);
    if (before === data.dependency) return { ok: true as const, changed: false };
    const wasDecision = before === "business_decision";
    if (wasDecision) {
      if (isProtectedDecision(task.title))
        throw new Error("The management agreement is a business decision and stays one.");
      if (task.owner_approval_status === "changes_requested")
        throw new Error("The homeowner asked for changes on this decision. Resolve that before reclassifying it.");
      if (data.reason.length < 5)
        throw new Error("Say why this Task does not need a homeowner decision.");
    }

    const patch: Record<string, unknown> = { owner_dependency: data.dependency };
    if (wasDecision) {
      patch["requires_owner_approval"] = false;
      patch["owner_approval_status"] = "not_required";
    }
    const { error } = await sb.from("onboarding_tasks").update(patch as never).eq("id", data.taskId);
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      action: "onboarding.task_owner_dependency_changed",
      entity_type: "onboarding_task",
      entity_id: data.taskId,
      entity_label: task.title,
      before_value: {
        owner_dependency: before,
        requires_owner_approval: task.requires_owner_approval,
        owner_approval_status: task.owner_approval_status,
      },
      after_value: patch,
      reason: data.reason || null,
    } as never);
    return { ok: true as const, changed: true };
  });
