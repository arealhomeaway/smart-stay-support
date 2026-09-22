import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getOnboardingWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadOnboardingWorkspace } = await import("./onboarding.server");
    return loadOnboardingWorkspace(context.supabase, context.userId);
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
        ownerApprovalStatus: z
          .enum([
            "not_required",
            "pending",
            "awaiting_owner",
            "changes_requested",
            "approved",
            "declined",
          ])
          .default("pending"),
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
        expectedStep: z.string().min(1).max(60),
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

export const reopenOnboardingTaskFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ taskId: z.string().uuid(), reason: z.string().min(3) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { reopenOnboardingTask } = await import("./onboarding.server");
    return reopenOnboardingTask(context.supabase, context.userId, data);
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

/** Dashboard date row: closing, access and target handoff in one save. */
export const saveOnboardingMilestonesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        plannedClosingOn: z.string().date().nullable().default(null),
        actualClosingOn: z.string().date().nullable().default(null),
        actualAccessOn: z.string().date().nullable().default(null),
        targetHandoffOn: z.string().date().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { saveOnboardingMilestones } = await import("./onboarding-milestones.server");
    return saveOnboardingMilestones(context.supabase, context.userId, data);
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
        anchor: z
          .enum(["planned_closing", "actual_closing", "actual_access"])
          .nullable()
          .default(null),
        offsetDays: z.number().int().min(-365).max(365).nullable().default(null),
        manualOverride: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { setTaskSchedule } = await import("./onboarding-schedule.server");
    return setTaskSchedule(context.supabase, context.userId, data);
  });

export const repaceProjectFromAccessFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ propertyId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { repaceProjectFromAccess } = await import("./onboarding-schedule.server");
    return repaceProjectFromAccess(context.supabase, context.userId, data);
  });

export const previewOnboardingTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        templateId: z.string().uuid().nullable().default(null),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { previewOnboardingTemplate } = await import("./onboarding-template.server");
    return previewOnboardingTemplate(context.supabase, context.userId, data);
  });

export const applyOnboardingTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        templateId: z.string().uuid().nullable().default(null),
      })
      .parse(data),
  )
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

export const sendTaskToOwnerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        taskId: z.string().uuid(),
        note: z.string().trim().min(5).max(2000),
        version: z.string().trim().max(120).default(""),
        documentIds: z.array(z.string().uuid()).max(25).default([]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { sendTaskToOwner } = await import("./onboarding.server");
    return sendTaskToOwner(context.supabase, context.userId, data);
  });

export const recordOwnerTaskDecisionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        taskId: z.string().uuid(),
        approved: z.boolean(),
        note: z.string().trim().min(3).max(1000),
        evidenceUrl: z.string().trim().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { recordOwnerTaskDecision } = await import("./onboarding.server");
    return recordOwnerTaskDecision(context.supabase, context.userId, data);
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

/* ------------------------------------------------ Onboarding Project record */

const moduleEnum = z.enum([
  "pool",
  "hoa",
  "utilities",
  "repairs",
  "existing_appliances",
  "new_appliances",
  "smart_lock",
  "cameras",
  "furniture_warranty",
  "landscaping",
  "active_owner",
]);

export const getOnboardingProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadProjectsForActor } = await import("./onboarding-project.server");
    return loadProjectsForActor(context.supabase, context.userId);
  });

export const getPropertyProject = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ propertyId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { loadPropertyProjectForActor } = await import("./onboarding-project.server");
    return loadPropertyProjectForActor(context.supabase, context.userId, data.propertyId);
  });

export const startOnboardingProjectFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        branch: z.string().trim().max(80).nullable().default(null),
        projectManager: z.string().uuid().nullable().default(null),
        director: z.string().uuid().nullable().default(null),
        utilityManager: z.string().uuid().nullable().default(null),
        templateId: z.string().uuid().nullable().default(null),
        plannedClosingOn: z.string().date().nullable().default(null),
        possessionOn: z.string().date().nullable().default(null),
        targetHandoffOn: z.string().date().nullable().default(null),
        furnishingScope: z.enum(["full_furnishing", "owner_furnished", "no_furnishing"]),
        modules: z.array(moduleEnum).max(20).default([]),
        poolLocation: z.enum(["none", "neighborhood", "property"]).default("none"),

        notes: z.string().trim().max(2000).nullable().default(null),
        externalRefs: z.record(z.string(), z.string().trim().max(300)).default({}),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { startOnboardingProject } = await import("./onboarding-project.server");
    return startOnboardingProject(context.supabase, context.userId, data);
  });

export const updateOnboardingProjectFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        branch: z.string().trim().max(80).nullable().optional(),
        projectManager: z.string().uuid().nullable().optional(),
        director: z.string().uuid().nullable().optional(),
        utilityManager: z.string().uuid().nullable().optional(),
        plannedClosingOn: z.string().date().nullable().optional(),
        possessionOn: z.string().date().nullable().optional(),
        targetHandoffOn: z.string().date().nullable().optional(),
        furnishingScope: z
          .enum(["full_furnishing", "owner_furnished", "no_furnishing"])
          .optional(),
        modules: z.array(moduleEnum).max(20).optional(),
        poolLocation: z.enum(["none", "neighborhood", "property"]).optional(),

        notes: z.string().trim().max(2000).nullable().optional(),
        externalRefs: z.record(z.string(), z.string().trim().max(300)).optional(),
        reason: z.string().trim().max(500).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { updateProject } = await import("./onboarding-project.server");
    return updateProject(context.supabase, context.userId, data);
  });

export const overrideOnboardingTaskDateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        taskId: z.string().uuid(),
        expectedUpdatedAt: z.string().datetime({ offset: true }),
        dueOn: z.string().date().nullable(),
        reason: z.string().trim().min(3).max(1000),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { overrideOnboardingTaskDate } = await import("./onboarding.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return overrideOnboardingTaskDate(context.supabase, context.userId, data, supabaseAdmin);
  });

/** Supervisors move a home between Onboarding and Active operations. */
export const switchPropertyLifecycleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        target: z.enum(["onboarding", "active_operations"]),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { switchPropertyLifecycle } = await import("./property-lifecycle.server");
    return switchPropertyLifecycle(context.supabase, context.userId, data);
  });

/** Move a home between the standard and Active Owner program mid-onboarding. */
export const setOnboardingProgramTypeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        activeOwner: z.boolean(),
        reason: z.string().trim().min(5).max(500),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { setOnboardingProgramType } = await import("./onboarding-program-type.server");
    return setOnboardingProgramType(context.supabase, context.userId, data);
  });
