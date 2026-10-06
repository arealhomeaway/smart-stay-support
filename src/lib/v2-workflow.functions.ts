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
  { code: "design_staging", label: "Design" },
  { code: "owner", label: "Owner" },
] as const;

export function roleLabel(code: string | null | undefined) {
  return FUNCTIONAL_ROLES.find((r) => r.code === code)?.label ?? code ?? "Unassigned";
}

const opportunitySchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    what: z.string().trim().max(100000).default(""),
    why: z.string().trim().max(100000).default(""),
    how: z.string().trim().max(100000).default(""),
    resources: z.array(z.string().trim().max(500)).max(10).default([]),
    ways_to_document: z.string().trim().max(100000).default(""),
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
        .select("id, title, detail, breezeway_template_id, stage, sort_order, functional_role, is_required, blocks_handoff, is_active, module, opportunity, offset_days, schedule_anchor, owner_dependency")
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

/**
 * Older imported plans keep stage names only on their steps. Converts every
 * missing stage name into an editable stage in one statement (all or none),
 * in the given order; existing stages are never duplicated and steps keep
 * their stage and order.
 */
export const materializeTemplateStages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ templateId: z.string().uuid(), names: z.array(z.string().trim().min(1).max(80)).min(1).max(50) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const existing = await sb.from("onboarding_template_stages").select("name").eq("template_id", data.templateId);
    fail(existing.error);
    const have = new Set((existing.data ?? []).map((r) => r.name));
    const names = [...new Set(data.names)].filter((n) => !have.has(n));
    if (!names.length) return { ok: true, created: 0 };
    const { error } = await sb.from("onboarding_template_stages").insert(
      names.map((name, i) => ({ template_id: data.templateId, name, active: true, sort_order: (have.size + i + 1) * 10 })),
    );
    fail(error);
    return { ok: true, created: names.length };
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
        title: z.string().trim().min(3).max(200).optional(),
        detail: z.string().trim().max(5000).nullable().optional(),
        breezewayTemplateId: z.string().trim().max(80).nullable().optional(),
        functionalRole: z.string().trim().max(60).nullable(),
        isRequired: z.boolean(),
        blocksHandoff: z.boolean(),
        isActive: z.boolean(),
        ownerDependency: z.enum(["none", "information", "feedback", "acknowledge", "business_decision"]).optional(),
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
        ...(data.title ? { title: data.title } : {}),
        ...(data.detail !== undefined ? { detail: data.detail } : {}),
        ...(data.breezewayTemplateId !== undefined ? { breezeway_template_id: data.breezewayTemplateId || null } : {}),
        functional_role: data.functionalRole || null,
        role: data.functionalRole ? roleLabel(data.functionalRole) : null,
        is_required: data.isRequired,
        blocks_handoff: data.blocksHandoff,
        is_active: data.isActive,
        ...(data.ownerDependency ? { owner_dependency: data.ownerDependency === "none" ? null : data.ownerDependency } : {}),
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
        detail: z.string().trim().max(100000).default(""),
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
      .select("id, title, owner_content, status, due_on, property_id, program_id, completed_at")
      .eq("kind", "opportunity")
      .neq("status", "archived")
      .order("due_on", { ascending: true, nullsFirst: false });
    fail(error);
    return (data ?? []).map((w) => ({
      ...w,
      owner_content: (w.owner_content ?? null) as OpportunityContent | null,
      propertyName: "Your home",
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
    if (data.send) {
      const { vagueOpportunityReason } = await import("./owner-opportunity");
      const vague = vagueOpportunityReason(data.content.title, [data.content.what, data.content.how].join("\n"));
      if (vague) throw new Error(vague);
    }
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

/* ------------------------------------ ARHA-provided owner collaboration */

export const RESPONSE_TYPES = [
  { code: "acknowledge", label: "Review / Acknowledge" },
  { code: "feedback", label: "Written Feedback" },
  { code: "documentation", label: "Upload / Documentation" },
  { code: "decision", label: "Business Decision" },
] as const;
export type ResponseType = (typeof RESPONSE_TYPES)[number]["code"];

const resourceInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("file"), document_id: z.string().uuid() }),
  z.object({
    kind: z.literal("link"),
    label: z.string().trim().min(1, "Give the link a display name").max(120),
    url: z.string().trim().max(2000).regex(/^https:\/\/\S+$/i, "Links must be a secure address starting with https://"),
    note: z.string().trim().max(2000).optional(),
    resource_type: z.enum(["video", "document", "reference", "other"]).optional(),
  }),
]);
export type ResourceInput = z.infer<typeof resourceInput>;

export type OwnerResponse = {
  kind: string; decision: string | null; text: string | null; at: string;
  by?: string; task_approval?: "approved" | "still_waiting";
};

const COLLAB_COLUMNS =
  "id, title, owner_content, status, linked_task_id, source, source_department, library_template_id, source_task_id, response_types, sent_at, viewed_at, responded_at, completed_at, owner_response, created_at, program_id, property_id, owner_priority, needs_owner_attention";

type CollabRow = {
  id: string;
  owner_priority: number | null;
  needs_owner_attention: boolean;
  title: string;
  owner_content: unknown;
  status: string;
  linked_task_id: string | null;
  source: string | null;
  source_department: string | null;
  library_template_id: string | null;
  source_task_id: string | null;
  response_types: string[];
  sent_at: string | null;
  viewed_at: string | null;
  responded_at: string | null;
  completed_at: string | null;
  owner_response: unknown;
  created_at: string;
  program_id: string | null;
  property_id: string | null;
};

async function withResources(sb: import("@supabase/supabase-js").SupabaseClient, rows: CollabRow[]) {
  const ids = rows.map((r) => r.id);
  const res = ids.length
    ? await sb
        .from("work_item_resources")
        .select("id, work_item_id, kind, document_id, label, url, note, resource_type, sort_order, documents(title, original_filename)")
        .in("work_item_id", ids)
        .is("removed_at", null)
        .order("sort_order")
    : { data: [], error: null };
  fail(res.error);
  type R = { id: string; work_item_id: string; kind: string; document_id: string | null; label: string | null; url: string | null; note: string | null; resource_type: string | null; documents: { title: string | null; original_filename: string | null } | null };
  const list = (res.data ?? []) as unknown as R[];
  // Owners can read a resource row (RLS) but not always the document row it
  // points at. Resolve only the filename for resources already visible.
  const missing = list.filter((r) => r.kind === "file" && r.document_id && !r.label && !r.documents).map((r) => r.document_id!);
  const names = new Map<string, string>();
  if (missing.length) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const d = await supabaseAdmin.from("documents").select("id, title, original_filename").in("id", missing);
    for (const x of d.data ?? []) names.set(x.id, x.title || x.original_filename || "");
  }
  return rows.map((o) => ({
    ...o,
    owner_content: (o.owner_content ?? null) as OpportunityContent | null,
    response_types: (o.response_types ?? []) as ResponseType[],
    owner_response: (Array.isArray(o.owner_response) ? o.owner_response : []) as OwnerResponse[],
    resources: list
      .filter((r) => r.work_item_id === o.id)
      .map((r) => ({
        id: r.id,
        kind: r.kind as "file" | "link",
        documentId: r.document_id,
        label:
          r.kind === "file"
            ? r.label || r.documents?.title || r.documents?.original_filename || names.get(r.document_id ?? "") || "File"
            : (r.label ?? ""),
        url: r.url,
        note: r.note,
        resourceType: r.resource_type,
      })),
  }));
}

/** Staff view: every Opportunity on one home plus its enrolment, files and Tasks. */
export const readOwnerCollaboration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const [opps, tasks, home, files] = await Promise.all([
      sb.from("work_items").select(COLLAB_COLUMNS).eq("kind", "opportunity").eq("property_id", data.propertyId).neq("status", "archived").order("created_at", { ascending: false }),
      sb.from("onboarding_tasks").select("id, title").eq("property_id", data.propertyId).is("archived_at", null).order("title"),
      sb.from("properties").select("actual_closing_on, planned_closing_on").eq("id", data.propertyId).single(),
      sb.from("documents").select("id, title, original_filename, category, note, work_item_id, uploaded_by, uploaded_at, created_at").eq("property_id", data.propertyId).is("deleted_at", null).is("archived_at", null).eq("upload_status", "stored").order("created_at", { ascending: false }).limit(1000),
    ]);
    fail(opps.error);
    fail(tasks.error);
    fail(files.error);
    const rows = await withResources(sb, (opps.data ?? []) as CollabRow[]);
    // Older Opportunities pointed at the Task's mirror; resolve that to the real Task.
    const mirrorIds = rows.map((r) => r.linked_task_id).filter((x): x is string => Boolean(x));
    const mirrors = mirrorIds.length ? await sb.from("work_items").select("id, source_id").in("id", mirrorIds) : { data: [] };
    const toTask = new Map((mirrors.data ?? []).map((m) => [m.id, m.source_id as string | null]));
    return {
      opportunities: rows.map((r) => ({ ...r, taskId: r.source_task_id ?? (r.linked_task_id ? toTask.get(r.linked_task_id) ?? null : null) })),
      tasks: tasks.data ?? [],
      files: (files.data ?? []).map((f) => ({ id: f.id, title: f.title ?? f.original_filename ?? "File", filename: f.original_filename, category: f.category, note: f.note, workItemId: f.work_item_id, uploadedAt: f.uploaded_at ?? f.created_at })),
      actualClosingOn: home.data?.actual_closing_on ?? null,
      plannedClosingOn: home.data?.planned_closing_on ?? null,
    };
  });

/**
 * Presentation order for ARHA Opportunities within one home: saved priority
 * first, then unprioritised (newly sent) at the BOTTOM, oldest sent first, so
 * each new Opportunity appends without disturbing the curated order.
 */
export function compareArhaPriority(
  a: { owner_priority: number | null; sent_at: string | null; created_at: string },
  b: { owner_priority: number | null; sent_at: string | null; created_at: string },
) {
  const pa = a.owner_priority, pb = b.owner_priority;
  if (pa == null && pb != null) return 1;
  if (pb == null && pa != null) return -1;
  if (pa != null && pb != null && pa !== pb) return pa - pb;
  return (a.sent_at ?? a.created_at).localeCompare(b.sent_at ?? b.created_at);
}

/** Staff: save the owner-facing order of sent ARHA Opportunities on one home. Presentation only. */
export const reorderArhaOpportunities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: z.string().uuid(), ids: z.array(z.string().uuid()).min(1).max(200) }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("reorder_arha_opportunities", { _property_id: data.propertyId, _ids: data.ids });
    fail(error);
    return { ok: true };
  });

export const saveArhaOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().nullable(),
        propertyId: z.string().uuid(),
        sourceTaskId: z.string().uuid().nullable(),
        content: opportunitySchema.unwrap(),
        responseTypes: z.array(z.enum(["acknowledge", "feedback", "documentation", "decision"])).min(1, "Choose at least one owner response type").max(4),
        resources: z.array(resourceInput).max(20),
        send: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    if (data.send) {
      const { vagueOpportunityReason } = await import("./owner-opportunity");
      const vague = vagueOpportunityReason(data.content.title, [data.content.what, data.content.how].join("\n"));
      if (vague) throw new Error(vague);
    }
    const { data: id, error } = await context.supabase.rpc("save_arha_opportunity", {
      _id: data.id as string,
      _property_id: data.propertyId,
      _source_task_id: data.sourceTaskId as string,
      _title: data.content.title,
      _content: { ...data.content, resources: [] },
      _response_types: data.responseTypes,
      _resources: data.resources,
      _send: data.send,
    });
    fail(error);
    return { id: id as string };
  });

/** Owner: Opportunities with resources and their own responses. */
export const listMyCollaboration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("work_items")
      .select(COLLAB_COLUMNS + ", due_on")
      .eq("kind", "opportunity")
      .neq("status", "archived")
      .neq("status", "draft")
      .is("retired_at", null)
      .order("sent_at", { ascending: false, nullsFirst: false });
    fail(error);
    const rows = (data ?? []) as unknown as (CollabRow & { due_on: string | null })[];
    const withRes = await withResources(context.supabase, rows);
    // Who spoke last on each thread (derived, never stored) drives the owner's workflow filters.
    const ids = rows.map((r) => r.id);
    const msgs = ids.length
      ? await context.supabase
          .from("owner_request_messages")
          .select("id, work_item_id, author_type, author_name, body, event, request_kind, created_at")
          .in("work_item_id", ids)
      : { data: [], error: null };
    fail(msgs.error);
    const { buildThread, lastSpeaker, openResponseRequest } = await import("./owner-conversation");
    return withRes.map((r, i) => {
      const mine = (msgs.data ?? []).filter((m) => m.work_item_id === r.id);
      const legacy = (Array.isArray(r.owner_response) ? r.owner_response : []) as never[];
      const thread = buildThread(legacy, mine as never);
      return { ...r, due_on: rows[i]!.due_on, last_speaker: lastSpeaker(thread), open_request: openResponseRequest(thread) };
    });
  });

/** Staff only: flag or clear the owner-priority "Needs Your Attention" marker. Never changes workflow status. */
export const setOwnerAttention = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), on: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    fail((await context.supabase.rpc("set_owner_attention", { _id: data.id, _on: data.on })).error);
    return { ok: true as const };
  });

export const markOpportunityViewed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    fail((await context.supabase.rpc("mark_owner_opportunity_viewed", { _id: data.id })).error);
    return { ok: true };
  });

export const respondToOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        kind: z.enum(["acknowledge", "feedback", "decision"]),
        decision: z.enum(["authorize", "changes"]).nullable().default(null),
        text: z.string().max(5000).default(""),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    fail(
      (
        await context.supabase.rpc("respond_owner_opportunity", {
          _id: data.id,
          _kind: data.kind,
          _decision: data.decision as string,
          _text: data.text,
        })
      ).error,
    );
    return { ok: true };
  });

/** Open a resource file. Readable resource row (RLS) is the permission. */
export const opportunityResourceUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ resourceId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const row = await context.supabase
      .from("work_item_resources")
      .select("document_id, kind")
      .eq("id", data.resourceId)
      .is("removed_at", null)
      .maybeSingle();
    if (row.error || !row.data || row.data.kind !== "file" || !row.data.document_id) throw new Error("That resource is not available.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const doc = await supabaseAdmin
      .from("documents")
      .select("storage_path, deleted_at, upload_status")
      .eq("id", row.data.document_id)
      .maybeSingle();
    if (!doc.data?.storage_path || doc.data.deleted_at || doc.data.upload_status !== "stored") throw new Error("That file is no longer on file.");
    const signed = await supabaseAdmin.storage.from("resolve-attachments").createSignedUrl(doc.data.storage_path, 300);
    if (signed.error) throw new Error("Resolve could not open that file.");
    return { url: signed.data.signedUrl };
  });
