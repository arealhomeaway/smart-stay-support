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
        ownerApprovalStatus: z.enum(["not_required", "pending", "awaiting_owner", "changes_requested", "approved", "declined"]).default("pending"),
        evidenceRequired: z.boolean().default(false),
        evidenceNote: z.string().trim().max(1000).default(""),
        status: z.enum(["open", "blocked", "complete", "carryover"]).default("open"),
        blocksHandoff: z.boolean().default(true),
        parentTaskId: z.string().uuid().nullable().optional(),
        dependsOn: z.array(z.string().uuid()).max(20).optional(),
        sortOrder: z.number().int().min(0).max(999).optional(),
        linkedTicketId: z.string().uuid().nullable().optional(),
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
        exceptionReason: z.string().trim().max(1000).optional(),
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

/* Stage 2 — onboarding portal server functions. All of them are internal-only:
 * every handler re-checks onboarding-staff or supervisor access server-side. */

export const addOnboardingNoteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        taskId: z.string().uuid().nullable().default(null),
        body: z.string().trim().min(1).max(4000),
        mentions: z.array(z.string().uuid()).max(20).default([]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { addOnboardingNote } = await import("./onboarding.server");
    return addOnboardingNote(context.supabase, context.userId, data);
  });

export const recordTaskExceptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ taskId: z.string().uuid(), reason: z.string().trim().min(3).max(1000) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { recordTaskException } = await import("./onboarding.server");
    return recordTaskException(context.supabase, context.userId, data);
  });

export const archiveOnboardingTaskFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ taskId: z.string().uuid(), reason: z.string().trim().min(3).max(500) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { archiveOnboardingTask } = await import("./onboarding.server");
    return archiveOnboardingTask(context.supabase, context.userId, data);
  });

export const resolveExternalRecordFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        recordId: z.string().uuid(),
        propertyId: z.string().uuid().nullable().default(null),
        ownerrezPropertyId: z.string().trim().max(60).nullable().default(null),
        decision: z.enum(["match", "review", "archive"]),
        note: z.string().trim().max(1000).default(""),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { resolveExternalRecord } = await import("./onboarding.server");
    return resolveExternalRecord(context.supabase, context.userId, data);
  });

/* Controlled scheduling — preview first, apply only what is confirmed. */

export const saveScheduleAnchorsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        plannedClosingOn: z.string().date().nullable().default(null),
        actualClosingOn: z.string().date().nullable().default(null),
        actualAccessOn: z.string().date().nullable().default(null),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { saveScheduleAnchors } = await import("./onboarding-schedule.server");
    return saveScheduleAnchors(context.supabase, context.userId, data);
  });

export const previewScheduleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ propertyId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { previewScheduleRecalc } = await import("./onboarding-schedule.server");
    return previewScheduleRecalc(context.supabase, context.userId, data);
  });

export const applyScheduleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ propertyId: z.string().uuid(), taskIds: z.array(z.string().uuid()).max(300) })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { applyScheduleRecalc } = await import("./onboarding-schedule.server");
    return applyScheduleRecalc(context.supabase, context.userId, data);
  });

export const setTaskScheduleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        taskId: z.string().uuid(),
        anchor: z.enum(["planned_closing", "actual_closing", "actual_access"]).nullable().default(null),
        offsetDays: z.number().int().min(-365).max(365).nullable().default(null),
        manualOverride: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { setTaskSchedule } = await import("./onboarding-schedule.server");
    return setTaskSchedule(context.supabase, context.userId, data);
  });

export const previewOnboardingTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ propertyId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { previewOnboardingTemplate } = await import("./onboarding-template.server");
    return previewOnboardingTemplate(context.supabase, context.userId, data);
  });

export const applyOnboardingTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ propertyId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { applyOnboardingTemplate } = await import("./onboarding-template.server");
    return applyOnboardingTemplate(context.supabase, context.userId, data);
  });

export const submitOwnerApprovalFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        taskId: z.string().uuid(),
        version: z.string().trim().max(120).default(""),
        note: z.string().trim().max(1000).default(""),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { submitOwnerApproval } = await import("./onboarding.server");
    return submitOwnerApproval(context.supabase, context.userId, data);
  });

export const confirmApprovalRequirementFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        taskId: z.string().uuid(),
        requiresOwnerApproval: z.boolean(),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { confirmApprovalRequirement } = await import("./onboarding.server");
    return confirmApprovalRequirement(context.supabase, context.userId, data);
  });
