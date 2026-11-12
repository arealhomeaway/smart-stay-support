/**
 * Server actions for Kati's onboarding tickets (Build 15): bulk complete on a
 * home's Plan tab, and the Breezeway section on "Work order:" steps.
 * Every action runs as the signed-in teammate; the database functions
 * bulk_complete_onboarding_tasks and save_onboarding_task_breezeway re-check
 * who may act. Nothing here writes to Breezeway unless the onboarding send
 * switch is on, and then only through the existing outbound path.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Rpc = (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
type Loose = {
  from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

export type BulkCompleteResult = {
  ready: { taskId: string; title: string }[];
  held: { taskId: string; title: string; reason: string }[];
  completed: number;
  completedAt?: string;
  doneBeforeResolve?: string | null;
};

export const bulkCompleteHomeTasksFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        taskIds: z.array(z.string().uuid()).min(1).max(200),
        note: z.string().trim().max(1000).default(""),
        doneOn: z.string().date().nullable().default(null),
        fileTaskId: z.string().uuid().nullable().default(null),
        dryRun: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: out, error } = await (context.supabase.rpc as unknown as Rpc)("bulk_complete_onboarding_tasks", {
      _property_id: data.propertyId,
      _task_ids: data.taskIds,
      _note: data.note,
      _done_on: data.doneOn,
      _file_task_id: data.fileTaskId,
      _dry_run: data.dryRun,
    });
    if (error) throw new Error(error.message);
    return out as BulkCompleteResult;
  });

export type OnboardingBreezewayState = {
  taskTitle: string;
  link: {
    tentative_date: string | null;
    assignee_choice: "unassigned" | "person" | null;
    breezeway_person_id: number | null;
    assignee_name: string | null;
    breezeway_task_id: number | null;
    breezeway_url: string | null;
    updated_at: string;
  } | null;
  sentTaskId: number | null;
  mirror: {
    name: string | null;
    status: string | null;
    stage: string | null;
    scheduled_date: string | null;
    assignee_names: string;
    finished_at: string | null;
    last_synced_at: string | null;
  } | null;
  comments: { author: string | null; body: string | null; commented_at: string | null }[];
  photos: { url: string | null; caption: string | null }[];
  people: { id: number; name: string }[];
  history: number;
  sendSwitchOn: boolean;
  home: { eligible: boolean; reason: string | null } | null;
};

export const onboardingBreezewayStateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ taskId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<OnboardingBreezewayState> => {
    const db = context.supabase as unknown as Loose;
    const [task, link, outbound, people, flag, history] = await Promise.all([
      db.from("onboarding_tasks").select("id, title, property_id").eq("id", data.taskId).maybeSingle(),
      db.from("onboarding_task_breezeway_links").select("*").eq("task_id", data.taskId).maybeSingle(),
      db.from("breezeway_outbound_tasks").select("breezeway_task_id, status, created_at")
        .eq("onboarding_task_id", data.taskId).order("created_at", { ascending: false }).limit(1),
      db.from("breezeway_people").select("breezeway_person_id, first_name, last_name")
        .eq("active", true).eq("is_integration_identity", false).order("first_name").limit(500),
      db.from("feature_flags").select("enabled").eq("key", "onboarding_breezeway_send").maybeSingle(),
      db.from("onboarding_task_breezeway_events").select("id", { count: "exact", head: true }).eq("task_id", data.taskId),
    ]);
    for (const r of [task, link, outbound, people, flag]) if (r.error) throw new Error(r.error.message);
    if (!task.data) throw new Error("That task is not available.");
    const sentTaskId = (outbound.data?.[0]?.breezeway_task_id as number | null) ?? null;
    const bzId = (link.data?.breezeway_task_id as number | null) ?? sentTaskId;
    let mirror: OnboardingBreezewayState["mirror"] = null;
    let comments: OnboardingBreezewayState["comments"] = [];
    let photos: OnboardingBreezewayState["photos"] = [];
    if (bzId) {
      const [wo, c, p] = await Promise.all([
        db.from("breezeway_work_orders")
          .select("name, status, stage, scheduled_date, assignees, finished_at, last_synced_at")
          .eq("breezeway_task_id", bzId).maybeSingle(),
        db.from("breezeway_work_order_comments").select("author, body, commented_at")
          .eq("breezeway_task_id", bzId).order("commented_at", { ascending: false }).limit(5),
        db.from("breezeway_work_order_photos").select("url, caption")
          .eq("breezeway_task_id", bzId).order("breezeway_created_at", { ascending: false }).limit(6),
      ]);
      for (const r of [wo, c, p]) if (r.error) throw new Error(r.error.message);
      mirror = wo.data
        ? {
            name: wo.data.name ?? null,
            status: wo.data.status ?? null,
            stage: wo.data.stage ?? null,
            scheduled_date: wo.data.scheduled_date ?? null,
            assignee_names: (Array.isArray(wo.data.assignees) ? wo.data.assignees : [])
              .map((a: { name?: string; first_name?: string; last_name?: string }) =>
                a?.name || [a?.first_name, a?.last_name].filter(Boolean).join(" "))
              .filter(Boolean)
              .join(", "),
            finished_at: wo.data.finished_at ?? null,
            last_synced_at: wo.data.last_synced_at ?? null,
          }
        : null;
      comments = c.data ?? [];
      photos = p.data ?? [];
    }
    const sendSwitchOn = flag.data?.enabled === true;
    // The home check only matters once the switch is on; it is never asked otherwise.
    let home: OnboardingBreezewayState["home"] = null;
    if (sendSwitchOn) {
      const { outboundEligibility } = await import("@/lib/breezeway-outbound.server");
      const e = await outboundEligibility({ sourceType: "onboarding_task", sourceId: data.taskId });
      home = { eligible: e.eligible, reason: e.reason };
    }
    return {
      taskTitle: task.data.title,
      link: link.data ?? null,
      sentTaskId,
      mirror,
      comments,
      photos,
      people: ((people.data ?? []) as { breezeway_person_id: number; first_name: string | null; last_name: string | null }[])
        .map((p) => ({ id: Number(p.breezeway_person_id), name: [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || `Person ${p.breezeway_person_id}` })),
      history: history.count ?? 0,
      sendSwitchOn,
      home,
    };
  });

export const saveOnboardingBreezewayFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        taskId: z.string().uuid(),
        tentativeDate: z.string().date().nullable().default(null),
        assigneeChoice: z.enum(["unassigned", "person"]).nullable().default(null),
        breezewayPersonId: z.number().int().positive().nullable().default(null),
        breezewayRef: z.string().trim().max(500).default(""),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: out, error } = await (context.supabase.rpc as unknown as Rpc)("save_onboarding_task_breezeway", {
      _task_id: data.taskId,
      _tentative_date: data.tentativeDate,
      _assignee_choice: data.assigneeChoice,
      _breezeway_person_id: data.assigneeChoice === "person" ? data.breezewayPersonId : null,
      _breezeway_ref: data.breezewayRef,
    });
    if (error) throw new Error(error.message);
    const row = (out ?? {}) as { breezeway_task_id?: number | null };
    return { ok: true as const, breezewayTaskId: row.breezeway_task_id ?? null };
  });

/** Send to Breezeway: built, behind onboarding_breezeway_send (OFF). Refuses before any write while off. */
export const sendOnboardingWorkOrderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        taskId: z.string().uuid(),
        /** B2: the Breezeway template is required; title and description come prefilled from the Task. */
        templateId: z.number().int().positive(),
        priority: z.enum(["low", "normal", "high", "urgent", "watch"]).default("normal"),
        title: z.string().trim().min(3).max(200).optional(),
        description: z.string().trim().max(4000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as Loose;
    const { sendToBreezewayRefusal, onboardingSendRequestKey } = await import("@/lib/onboarding-breezeway");
    const flag = await db.from("feature_flags").select("enabled").eq("key", "onboarding_breezeway_send").maybeSingle();
    if (flag.error) throw new Error(flag.error.message);
    const switchOn = flag.data?.enabled === true;
    if (!switchOn) {
      return { ok: false as const, message: sendToBreezewayRefusal({ switchOn, homeEligible: false, tentativeDate: null, alreadyLinked: false })! };
    }
    const staff = await context.supabase.rpc("is_onboarding_staff", { _user_id: context.userId });
    if (staff.error || !staff.data) throw new Error("Onboarding staff access is required.");
    const [task, link] = await Promise.all([
      db.from("onboarding_tasks").select("id, title, detail, property_id").eq("id", data.taskId).maybeSingle(),
      db.from("onboarding_task_breezeway_links").select("*").eq("task_id", data.taskId).maybeSingle(),
    ]);
    if (task.error) throw new Error(task.error.message);
    if (link.error) throw new Error(link.error.message);
    if (!task.data) throw new Error("That task is not available.");
    const { outboundEligibility, createOutboundTask } = await import("@/lib/breezeway-outbound.server");
    const home = await outboundEligibility({ sourceType: "onboarding_task", sourceId: data.taskId });
    const refusal = sendToBreezewayRefusal({
      switchOn,
      homeEligible: home.eligible,
      homeReason: home.reason,
      tentativeDate: link.data?.tentative_date ?? null,
      alreadyLinked: Boolean(link.data?.breezeway_task_id),
    });
    if (refusal) return { ok: false as const, message: refusal };
    if (!link.data?.assignee_choice) return { ok: false as const, message: "Choose a Breezeway person, or Leave unassigned, and save first." };
    return createOutboundTask(
      {
        sourceType: "onboarding_task",
        sourceId: data.taskId,
        requestKey: onboardingSendRequestKey(data.taskId),
        title: data.title ?? String(task.data.title).replace(/^\s*(draft\s+)?work order\s*:\s*/i, "").slice(0, 200),
        description: data.description !== undefined ? data.description : task.data.detail ? String(task.data.detail).slice(0, 4000) : null,
        department: "maintenance",
        priority: data.priority,
        scheduledDate: link.data.tentative_date,
        scheduledTime: null,
        templateId: data.templateId,
        assigneeIds: link.data.assignee_choice === "person" && link.data.breezeway_person_id ? [Number(link.data.breezeway_person_id)] : [],
        resolveEvidenceNote: null,
      },
      context.userId,
    );
  });

export const breezewayHomeLinkFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as Loose;
    const r = await db.from("properties")
      .select("breezeway_property_id, breezeway_mapping_state, breezeway_mapping_verified_at")
      .eq("id", data.propertyId).maybeSingle();
    if (r.error) throw new Error(r.error.message);
    return {
      breezewayPropertyId: (r.data?.breezeway_property_id as string | number | null) ?? null,
      mappingState: (r.data?.breezeway_mapping_state as string | null) ?? null,
      verifiedAt: (r.data?.breezeway_mapping_verified_at as string | null) ?? null,
    };
  });

/** B2: Breezeway's own active templates for the Work order section (onboarding staff, read only). */
export const onboardingBreezewayTemplatesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const staff = await context.supabase.rpc("is_onboarding_staff", { _user_id: context.userId });
    if (staff.error || !staff.data) throw new Error("Onboarding staff access is required.");
    const { listBreezewayTemplates } = await import("@/lib/breezeway-directory.server");
    const templates = await listBreezewayTemplates().catch(() => []);
    return { templates: templates.map((t) => ({ id: t.id, name: t.name, department: t.department ?? null })) };
  });
