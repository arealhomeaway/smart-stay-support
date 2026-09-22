/** Template authoring RPCs. Reading is onboarding staff; writing is supervisor-only. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ANCHOR = z.enum(["planned_closing", "actual_closing", "actual_access"]);

export const listOnboardingTemplatesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listOnboardingTemplates } = await import("./onboarding-template-admin.server");
    return listOnboardingTemplates(context.supabase, context.userId);
  });

export const readOnboardingTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ templateId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { readOnboardingTemplate } = await import("./onboarding-template-admin.server");
    return readOnboardingTemplate(context.supabase, context.userId, data);
  });

export const createOnboardingTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        name: z.string().trim().min(3).max(120),
        description: z.string().trim().max(600).optional(),
        copyBuiltIn: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { createOnboardingTemplate } = await import("./onboarding-template-admin.server");
    return createOnboardingTemplate(context.supabase, context.userId, data);
  });

export const updateOnboardingTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        templateId: z.string().uuid(),
        name: z.string().trim().min(3).max(120).optional(),
        description: z.string().trim().max(600).optional(),
        isArchived: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { updateOnboardingTemplate } = await import("./onboarding-template-admin.server");
    return updateOnboardingTemplate(context.supabase, context.userId, data);
  });

export const setDefaultOnboardingTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ templateId: z.string().uuid().nullable() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { setDefaultOnboardingTemplate } = await import("./onboarding-template-admin.server");
    return setDefaultOnboardingTemplate(context.supabase, context.userId, data);
  });

export const saveTemplateStepFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        templateId: z.string().uuid(),
        stepId: z.string().uuid().optional(),
        stage: z.string().trim().min(1).max(80),
        title: z.string().trim().min(3).max(200),
        role: z.string().trim().max(80).optional(),
        detail: z.string().trim().max(4000).optional(),
        blocksHandoff: z.boolean().default(false),
        requiresOwnerApproval: z.boolean().default(false),
        ownerApprovalWhenActiveOwner: z.boolean().default(false),
        evidenceRequired: z.boolean().default(false),
        scheduleAnchor: ANCHOR.nullable().default(null),
        offsetDays: z.number().int().min(-90).max(365).nullable().default(null),
        breezewayTemplateId: z.string().trim().max(60).optional(),
        subtasks: z.array(z.string().trim().max(200)).max(50).default([]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { saveTemplateStep } = await import("./onboarding-template-admin.server");
    return saveTemplateStep(context.supabase, context.userId, data);
  });

export const deleteTemplateStepFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ templateId: z.string().uuid(), stepId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { deleteTemplateStep } = await import("./onboarding-template-admin.server");
    return deleteTemplateStep(context.supabase, context.userId, data);
  });

export const reorderTemplateStepFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        templateId: z.string().uuid(),
        stepId: z.string().uuid(),
        direction: z.enum(["up", "down"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { reorderTemplateStep } = await import("./onboarding-template-admin.server");
    return reorderTemplateStep(context.supabase, context.userId, data);
  });
