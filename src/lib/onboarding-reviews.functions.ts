/**
 * Review steps in onboarding plans. Every rule (who reviews, time limits,
 * blocking, no-second-look skip) lives in the database RPCs; these functions
 * only validate input and pass the signed-in user's session through.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ReviewState, StepReviewSettings } from "./onboarding-reviews";

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export const readStepReviewSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ stepId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const r = await context.supabase.from("onboarding_step_review_settings").select("*").eq("template_task_id", data.stepId).maybeSingle();
    fail(r.error);
    return (r.data ?? null) as StepReviewSettings | null;
  });

export const saveStepReviewSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        stepId: z.string().uuid(),
        reviewerRoles: z.array(z.string().min(1)).max(2),
        timeLimitDays: z.number().int().min(1).max(30),
        alertsEnabled: z.boolean(),
        blocks: z.enum(["nothing", "steps", "handoff", "stage"]),
        blockedStepIds: z.array(z.string().uuid()).max(200),
        blockedStage: z.string().max(200).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("set_onboarding_step_review_settings", {
      _step_id: data.stepId,
      _reviewer_roles: data.reviewerRoles,
      _time_limit_days: data.timeLimitDays,
      _alerts_enabled: data.alertsEnabled,
      _blocks: data.blocks,
      _blocked_step_ids: data.blockedStepIds,
      _blocked_stage: data.blockedStage ?? "",
    });
    fail(error);
    return { ok: true };
  });

export const readTaskReviewState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ taskId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const r = await context.supabase.rpc("onboarding_task_review_state", { _task_id: data.taskId });
    fail(r.error);
    return (r.data ?? null) as unknown as ReviewState | null;
  });

export const submitTaskReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ taskId: z.string().uuid(), note: z.string().max(4000).optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const r = await context.supabase.rpc("submit_onboarding_task_review", { _task_id: data.taskId, _note: data.note ?? "" });
    fail(r.error);
    return r.data as unknown as { status: string };
  });

export const decideTaskReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ reviewId: z.string().uuid(), decision: z.enum(["approved", "sent_back"]), note: z.string().max(4000).optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const r = await context.supabase.rpc("decide_onboarding_task_review", { _review_id: data.reviewId, _decision: data.decision, _note: data.note ?? "" });
    fail(r.error);
    return r.data as unknown as { status: string };
  });

export const recordReviewEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ reviewId: z.string().uuid(), note: z.string().trim().min(3).max(4000) }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("record_onboarding_review_edit", { _review_id: data.reviewId, _note: data.note });
    fail(error);
    return { ok: true };
  });

export const listMyReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await context.supabase.rpc("my_onboarding_reviews");
    fail(r.error);
    return r.data ?? [];
  });

export const readNoSecondLook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await context.supabase.from("staff_review_preferences").select("user_id, no_second_look");
    fail(r.error);
    return (r.data ?? []).filter((x) => x.no_second_look).map((x) => x.user_id);
  });

export const setNoSecondLook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), on: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("set_staff_no_second_look", { _user_id: data.userId, _on: data.on });
    fail(error);
    return { ok: true };
  });
