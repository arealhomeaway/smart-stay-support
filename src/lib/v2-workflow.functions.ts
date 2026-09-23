/**
 * V2 workflow RPCs: template configuration (stages, step settings, owner
 * Opportunity content, published versions), the 2-step handoff, and owner
 * Opportunities from the shared Work Item engine.
 *
 * Every rule lives in the database (RLS + security-definer functions); these
 * functions only validate input and pass the signed-in user's session through.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const FUNCTIONAL_ROLES = [
  { code: "onboarding_project_manager", label: "Onboarding Project Manager" },
  { code: "onboarding_director", label: "Onboarding Director" },
  { code: "director_ops", label: "Operations Director" },
  { code: "property_coordinator", label: "Property Coordinator" },
  { code: "utilities", label: "Utilities" },
  { code: "design_staging", label: "Design & Staging" },
  { code: "owner", label: "Owner" },
] as const;

export function roleLabel(code: string | null | undefined) {
  return FUNCTIONAL_ROLES.find((r) => r.code === code)?.label ?? code ?? "Unassigned";
}

const opportunitySchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    what: z.string().trim().max(2000).default(""),
    why: z.string().trim().max(2000).default(""),
    how: z.string().trim().max(2000).default(""),
    resources: z.array(z.string().trim().max(500)).max(10).default([]),
    ways_to_document: z.string().trim().max(2000).default(""),
    suggested_minutes: z.number().int().min(0).max(6000).nullable().default(null),
  })
  .nullable();

export type OpportunityContent = NonNullable<z.infer<typeof opportunitySchema>>;

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------ templates */

export const readTemplateV2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ templateId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const [stages, steps, versions] = await Promise.all([
      sb.from("onboarding_template_stages").select("id, name, sort_order, active").eq("template_id", data.templateId).order("sort_order"),
      sb
        .from("onboarding_template_tasks")
        .select("id, title, stage, sort_order, functional_role, is_required, blocks_handoff, is_active, module, opportunity, offset_days, schedule_anchor")
        .eq("template_id", data.templateId)
        .order("sort_order"),
      sb.from("onboarding_template_versions").select("id, version, published_at").eq("template_id", data.templateId).order("version", { ascending: false }),
    ]);
    fail(stages.error);
    fail(steps.error);
    fail(versions.error);
    return {
      stages: stages.data ?? [],
      steps: (steps.data ?? []).map((s) => ({ ...s, opportunity: (s.opportunity ?? null) as OpportunityContent | null })),
      versions: versions.data ?? [],
    };
  });

export const saveTemplateStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        templateId: z.string().uuid(),
        stageId: z.string().uuid().optional(),
        name: z.string().trim().min(2).max(80),
        active: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    if (data.stageId) {
      const prev = await sb.from("onboarding_template_stages").select("name").eq("id", data.stageId).single();
      fail(prev.error);
      const { error } = await sb.from("onboarding_template_stages").update({ name: data.name, active: data.active }).eq("id", data.stageId);
      fail(error);
      if (prev.data && prev.data.name !== data.name) {
        const r = await sb.from("onboarding_template_tasks").update({ stage: data.name }).eq("template_id", data.templateId).eq("stage", prev.data.name);
        fail(r.error);
      }
    } else {
      const last = await sb.from("onboarding_template_stages").select("sort_order").eq("template_id", data.templateId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
      const { error } = await sb.from("onboarding_template_stages").insert({
        template_id: data.templateId,
        name: data.name,
        active: data.active,
        sort_order: (last.data?.sort_order ?? 0) + 10,
      });
      fail(error);
    }
    return { ok: true };
  });

export const reorderTemplateStages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ templateId: z.string().uuid(), stageIds: z.array(z.string().uuid()).min(1).max(50) }).parse(d))
  .handler(async ({ context, data }) => {
    for (const [i, id] of data.stageIds.entries()) {
      const { error } = await context.supabase
        .from("onboarding_template_stages")
        .update({ sort_order: (i + 1) * 10 })
        .eq("id", id)
        .eq("template_id", data.templateId);
      fail(error);
    }
    return { ok: true };
  });

export const saveTemplateStepV2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        stepId: z.string().uuid(),
        functionalRole: z.string().trim().max(60).nullable(),
        isRequired: z.boolean(),
        blocksHandoff: z.boolean(),
        isActive: z.boolean(),
        module: z.string().trim().max(60).nullable(),
        offsetDays: z.number().int().min(-90).max(365).nullable(),
        opportunity: opportunitySchema,
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("onboarding_template_tasks")
      .update({
        functional_role: data.functionalRole || null,
        role: data.functionalRole ? roleLabel(data.functionalRole) : null,
        is_required: data.isRequired,
        blocks_handoff: data.blocksHandoff,
        is_active: data.isActive,
        module: data.module || null,
        offset_days: data.offsetDays,
        schedule_anchor: data.offsetDays === null ? null : "actual_access",
        opportunity: data.opportunity,
      })
      .eq("id", data.stepId);
    fail(error);
    return { ok: true };
  });

export const publishTemplateVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ templateId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: id, error } = await context.supabase.rpc("publish_onboarding_template", { _template_id: data.templateId });
    fail(error);
    return { versionId: id as string };
  });

/** Start a home on the current published version of the default plan (new homes only). */
export const startProjectOnV2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const tpl = await sb.from("onboarding_templates").select("id").eq("is_default", true).limit(1).single();
    fail(tpl.error);
    const v = await sb.from("onboarding_template_versions").select("id").eq("template_id", tpl.data!.id).order("version", { ascending: false }).limit(1).single();
    if (v.error) throw new Error("Publish the default plan before starting homes on it.");
    const { data: n, error } = await sb.rpc("instantiate_onboarding_v2", { _project_id: data.projectId, _version_id: v.data.id });
    fail(error);
    return { created: n as number };
  });

/* -------------------------------------------------------------- handoff */

export const readHandoffV2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const project = await sb
      .from("onboarding_projects")
      .select("id, handoff_state, ready_for_ops_at, ops_accepted_at, director")
      .eq("property_id", data.propertyId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    fail(project.error);
    const blockers = await sb
      .from("onboarding_tasks")
      .select("id, title, stage, assigned_seat, due_on, tags")
      .eq("property_id", data.propertyId)
      .is("archived_at", null)
      .eq("blocks_handoff", true)
      .eq("is_required", true)
      .not("status", "in", "(complete,done)")
      .order("due_on", { ascending: true, nullsFirst: false });
    fail(blockers.error);
    const seats = await sb.from("functional_roles").select("code, current_seat_holder").in("code", ["onboarding_director", "director_ops"]);
    const holder = (code: string) => seats.data?.find((s) => s.code === code)?.current_seat_holder ?? null;
    const roles = await sb.from("user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = (roles.data ?? []).some((r) => r.role === "admin");
    const p = project.data;
    return {
      project: p,
      blockers: blockers.data ?? [],
      canMarkReady: isAdmin || holder("onboarding_director") === context.userId || p?.director === context.userId,
      canAccept: isAdmin || holder("director_ops") === context.userId,
    };
  });

export const markReadyForOperations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    fail((await context.supabase.rpc("mark_ready_for_operations", { _project_id: data.projectId })).error);
    return { ok: true };
  });

export const acceptIntoOperations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    fail((await context.supabase.rpc("accept_into_operations", { _project_id: data.projectId })).error);
    return { ok: true };
  });

export const logHandoffDeficiency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        title: z.string().trim().min(3).max(200),
        detail: z.string().trim().max(2000).default(""),
        role: z.string().trim().max(60).default("onboarding_project_manager"),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("log_handoff_deficiency", {
      _project_id: data.projectId,
      _title: data.title,
      _detail: data.detail,
      _role: data.role,
    });
    fail(error);
    return { ok: true };
  });

/* --------------------------------------------------- owner Opportunities */

export const listMyOpportunities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("work_items")
      .select("id, title, owner_content, status, due_on, property_id, program_id, completed_at, properties(name)")
      .eq("kind", "opportunity")
      .neq("status", "archived")
      .order("due_on", { ascending: true, nullsFirst: false });
    fail(error);
    return (data ?? []).map((w) => ({
      ...w,
      owner_content: (w.owner_content ?? null) as OpportunityContent | null,
      propertyName: (w.properties as { name: string } | null)?.name ?? "Your home",
    }));
  });

export const completeMyOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    fail((await context.supabase.rpc("complete_owner_opportunity", { _id: data.id })).error);
    return { ok: true };
  });

/* ------------------------------ staff-managed Opportunities for one home */

/** Opportunities (all states) and linkable internal Tasks for one enrolled home. */
export const readPropertyOpportunities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const [opps, tasks, home] = await Promise.all([
      sb
        .from("work_items")
        .select("id, title, owner_content, status, linked_task_id, completed_at, created_at")
        .eq("kind", "opportunity")
        .eq("property_id", data.propertyId)
        .neq("status", "archived")
        .order("created_at", { ascending: false }),
      sb
        .from("work_items")
        .select("id, title")
        .eq("kind", "task")
        .eq("property_id", data.propertyId)
        .neq("status", "archived")
        .order("title"),
      sb.from("properties").select("actual_closing_on, planned_closing_on").eq("id", data.propertyId).single(),
    ]);
    fail(opps.error);
    fail(tasks.error);
    return {
      opportunities: (opps.data ?? []).map((o) => ({ ...o, owner_content: (o.owner_content ?? null) as OpportunityContent | null })),
      tasks: tasks.data ?? [],
      actualClosingOn: home.data?.actual_closing_on ?? null,
      plannedClosingOn: home.data?.planned_closing_on ?? null,
    };
  });

export const saveOwnerOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().nullable(),
        propertyId: z.string().uuid(),
        content: opportunitySchema.unwrap(),
        linkedTaskId: z.string().uuid().nullable(),
        send: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: id, error } = await context.supabase.rpc("save_owner_opportunity", {
      _id: data.id as string,
      _property_id: data.propertyId,
      _title: data.content.title,
      _content: data.content,
      _linked_task_id: data.linkedTaskId as string,
      _send: data.send,
    });
    fail(error);
    return { id: id as string };
  });
