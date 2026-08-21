import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getOnboardingWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadOnboardingWorkspace } = await import("./onboarding.server");
    return loadOnboardingWorkspace(context.supabase);
  });

export const saveOnboardingTaskFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        propertyId: z.string().uuid(),
        stage: z.string().min(1).max(40),
        title: z.string().trim().min(3).max(200),
        detail: z.string().trim().max(2000).default(""),
        assignedTo: z.string().uuid().nullable().default(null),
        dueOn: z.string().date().nullable().default(null),
        blocker: z.string().trim().max(500).default(""),
        requiresOwnerApproval: z.boolean().default(false),
        ownerApprovalStatus: z.enum(["not_required", "pending", "approved", "declined"]).default("pending"),
        evidenceRequired: z.boolean().default(false),
        evidenceNote: z.string().trim().max(1000).default(""),
        status: z.enum(["open", "blocked", "complete", "carryover"]).default("open"),
        blocksHandoff: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { saveOnboardingTask } = await import("./onboarding.server");
    return saveOnboardingTask(context.supabase, context.userId, data);
  });

export const setPropertyLifecycleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        status: z.enum([
          "onboarding",
          "handoff_requested",
          "handoff_corrections",
          "active_operations",
          "paused",
          "offboarded",
        ]),
        stage: z.string().max(40).nullable().optional(),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { setPropertyLifecycle } = await import("./onboarding.server");
    return setPropertyLifecycle(context.supabase, context.userId, data);
  });

export const requestHandoffFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        notes: z.string().trim().max(2000).default(""),
        carryoverAccepted: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { requestHandoff } = await import("./onboarding.server");
    return requestHandoff(context.supabase, context.userId, data);
  });

export const reviewHandoffFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        handoffId: z.string().uuid(),
        decision: z.enum(["accepted", "returned"]),
        corrections: z.string().trim().max(2000).default(""),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { reviewHandoff } = await import("./onboarding.server");
    return reviewHandoff(context.supabase, context.userId, data);
  });

export const getAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: allowed, error } = await context.supabase.rpc("is_supervisor", {
      _user_id: context.userId,
    });
    if (error || !allowed) throw new Error("Audit history is limited to supervisors.");
    const { loadAuditLog } = await import("./audit.server");
    return { entries: await loadAuditLog() };
  });
