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

export const ensureBuiltInTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ensureBuiltInTemplate } = await import("./onboarding-template-admin.server");
    return ensureBuiltInTemplate(context.supabase, context.userId);
  });

export const createOnboardingTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        name: z.string().trim().min(3).max(120),
        description: z.string().trim().max(20000).optional(),
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
        description: z.string().trim().max(20000).optional(),
        isArchived: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { updateOnboardingTemplate } = await import("./onboarding-template-admin.server");
    return updateOnboardingTemplate(context.supabase, context.userId, data);
  });

export const deleteOnboardingTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ templateId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { deleteOnboardingTemplate } = await import("./onboarding-template-admin.server");
    return deleteOnboardingTemplate(context.supabase, context.userId, data);
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
        detail: z.string().trim().max(100000).optional(),
        blocksHandoff: z.boolean().default(false),
        requiresOwnerApproval: z.boolean().default(false),
        ownerApprovalWhenActiveOwner: z.boolean().default(false),
        evidenceRequired: z.boolean().default(false),
        scheduleAnchor: ANCHOR.nullable().default(null),
        offsetDays: z.number().int().min(-90).max(365).nullable().default(null),
        breezewayTemplateId: z.string().trim().max(60).optional(),
        subtasks: z.array(z.string().trim().max(1000)).max(50).default([]),
        tags: z.array(z.string().trim().max(40)).max(10).default([]),
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

export const arrangeTemplateStepsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        templateId: z.string().uuid(),
        order: z
          .array(z.object({ stepId: z.string().uuid(), stage: z.string().min(1) }))
          .min(1)
          .max(1000),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { arrangeTemplateSteps } = await import("./onboarding-template-admin.server");
    return arrangeTemplateSteps(context.supabase, context.userId, data);
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

/**
 * CSV → NEW template. Preview never writes. Save creates a brand-new template
 * through the existing create path (same leadership check and audit), then its
 * stages and Tasks. Never touches existing templates, property plans, owner
 * Opportunities or Breezeway. A failed save removes the half-made template.
 */
export const importTemplateCsvFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      name: z.string().trim().min(3).max(120),
      csv: z.string().min(1).max(2_000_000),
      save: z.boolean().default(false),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { parseTemplateCsv } = await import("./plan-csv-import");
    const preview = parseTemplateCsv(data.csv);
    if (!data.save || preview.errors.length) return { preview, templateId: null as string | null };
    const sb = context.supabase;
    const { createOnboardingTemplate } = await import("./onboarding-template-admin.server");
    const created = await createOnboardingTemplate(sb, context.userId, {
      name: data.name,
      description: "Imported from CSV.",
    });
    try {
      const st = await sb.from("onboarding_template_stages").insert(
        preview.stages.map((s) => ({ template_id: created.id, name: s.name, sort_order: s.order * 10, active: true })),
      );
      if (st.error) throw st.error;
      const rows = preview.stages.flatMap((s) => s.tasks).map((t) => ({
        template_id: created.id, stage: t.stage, title: t.title, detail: t.detail, role: t.role,
        functional_role: t.functionalRole, schedule_anchor: t.scheduleAnchor, offset_days: t.offsetDays,
        is_required: t.isRequired, blocks_handoff: t.blocksHandoff, evidence_required: t.evidenceRequired,
        requires_owner_approval: t.requiresOwnerApproval, owner_dependency: t.ownerDependency,
        module: t.module, breezeway_template_id: t.breezewayTemplateId, opportunity: t.opportunity,
        sort_order: t.sortOrder, is_active: true,
        offset_unit: t.offsetUnit, description: t.description, done_when: t.doneWhen, video_url: t.videoUrl,
        condition: t.condition,
      }));
      const ins = await sb.from("onboarding_template_tasks").insert(rows as never);
      if (ins.error) throw ins.error;
    } catch (e) {
      await sb.from("onboarding_template_tasks").delete().eq("template_id", created.id);
      await sb.from("onboarding_template_stages").delete().eq("template_id", created.id);
      await sb.from("onboarding_templates").delete().eq("id", created.id);
      throw new Error(`The template could not be saved: ${e instanceof Error ? e.message : "unknown error"}. Nothing was kept.`);
    }
    const { writeAudit } = await import("./audit.server");
    await writeAudit({
      actorId: context.userId, action: "onboarding_template_imported_csv", entityType: "onboarding_template",
      entityId: created.id, entityLabel: data.name,
      after: { stages: preview.stages.length, tasks: preview.taskCount, ignored_columns: preview.ignoredColumns },
    });
    return { preview, templateId: created.id };
  });
