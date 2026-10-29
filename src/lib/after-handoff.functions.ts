import { formatPropertyLabel } from "@/lib/property-label";
/**
 * After-handoff owner plan and follow-up. Every write goes through one
 * caller-authenticated database action that records history in the same
 * transaction. Nothing here sends, releases or notifies.
 */
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PlanItem, ScheduleRow, WaitingItem } from "@/lib/after-handoff";

// The new tables are staged, not yet in the generated types.
const db = (c: unknown) => c as SupabaseClient;

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export const NOT_ENABLED = "The after-handoff plan is not switched on yet.";

function notEnabled(error: { message: string; code?: string } | null) {
  return !!error && (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST202" || /does not exist|schema cache/i.test(error.message));
}

type Option = { id: string; title: string; kind: "template" | "library" };

export const getAfterHandoffPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = db(context.supabase);
    const [items, access, tpls, libs] = await Promise.all([
      s.from("after_handoff_plan_items").select("id,title,source_kind,template_id,library_id,send_after_days,active,sort_order,notes"),
      s.rpc("after_handoff_access"),
      s.from("owner_task_templates").select("id,title").eq("active", true).order("sort_order"),
      s.from("owner_opportunity_library").select("id,title").eq("active", true).order("sort_order"),
    ]);
    if (notEnabled(items.error) || notEnabled(access.error)) return { enabled: false as const };
    fail(items.error); fail(access.error); fail(tpls.error); fail(libs.error);
    const a = (access.data as { can_edit_plan: boolean; can_manage_followup: boolean }[] | null)?.[0];
    const options: Option[] = [
      ...((tpls.data ?? []) as { id: string; title: string }[]).map((t) => ({ ...t, kind: "template" as const })),
      ...((libs.data ?? []) as { id: string; title: string }[]).map((t) => ({ ...t, kind: "library" as const })),
    ];
    return {
      enabled: true as const,
      items: (items.data ?? []) as PlanItem[],
      canEdit: a?.can_edit_plan === true,
      canManage: a?.can_manage_followup === true,
      options,
    };
  });

const source = { source_kind: z.enum(["template", "library"]), source_id: z.string().uuid() };

export const saveAfterHandoffPlanItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid().nullable(), title: z.string().max(200), ...source, send_after_days: z.number().int().min(0).max(3650), notes: z.string().max(2000) }))
  .handler(async ({ context, data }) => {
    const { error } = await db(context.supabase).rpc("after_handoff_plan_save", {
      _id: data.id, _title: data.title, _source_kind: data.source_kind, _source_id: data.source_id, _send_after_days: data.send_after_days, _notes: data.notes,
    });
    fail(error);
    return { ok: true };
  });

export const setAfterHandoffPlanItemActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), active: z.boolean() }))
  .handler(async ({ context, data }) => {
    const { error } = await db(context.supabase).rpc("after_handoff_plan_set_active", { _id: data.id, _active: data.active });
    fail(error);
    return { ok: true };
  });

export const reorderAfterHandoffPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ ids: z.array(z.string().uuid()).max(500) }))
  .handler(async ({ context, data }) => {
    const { error } = await db(context.supabase).rpc("after_handoff_plan_reorder", { _ids: data.ids });
    fail(error);
    return { ok: true };
  });

export const getActiveOwnerFollowup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = db(context.supabase);
    const [sched, access, waiting, progs, tpls, libs] = await Promise.all([
      s.from("after_handoff_schedule").select("id,program_id,property_id,title,source_kind,send_on,status,one_off").order("send_on"),
      s.rpc("after_handoff_access"),
      s.from("work_items").select("id,title,property_id,sent_at,responded_at,status").eq("kind", "opportunity").eq("status", "open").eq("is_demo", false).is("retired_at", null).not("sent_at", "is", null).is("responded_at", null).order("sent_at").limit(500),
      s.from("owner_programs").select("id,owner_name,property_id").eq("status", "active").eq("is_demo", false).is("archived_at", null),
      s.from("owner_task_templates").select("id,title").eq("active", true).order("sort_order"),
      s.from("owner_opportunity_library").select("id,title").eq("active", true).order("sort_order"),
    ]);
    if (notEnabled(sched.error) || notEnabled(access.error)) return { enabled: false as const };
    fail(sched.error); fail(access.error); fail(waiting.error); fail(progs.error); fail(tpls.error); fail(libs.error);
    const programs = (progs.data ?? []) as { id: string; owner_name: string | null; property_id: string | null }[];
    const rows = (sched.data ?? []) as ScheduleRow[];
    const waitingItems = (waiting.data ?? []) as WaitingItem[];
    const propIds = [...new Set([...rows.map((r) => r.property_id), ...waitingItems.map((w) => w.property_id), ...programs.map((p) => p.property_id)].filter(Boolean))] as string[];
    const props = propIds.length
      ? await s.from("properties").select("id, name, address_line1, nickname, unit, city, state, postal_code, ownerrez_property_id").in("id", propIds)
      : { data: [], error: null };
    fail(props.error);
    const a = (access.data as { can_edit_plan: boolean; can_manage_followup: boolean }[] | null)?.[0];
    return {
      enabled: true as const,
      canManage: a?.can_manage_followup === true,
      rows,
      waiting: waitingItems,
      homes: Object.fromEntries((props.data ?? []).map((p) => [p.id, formatPropertyLabel(p).primary])),
      programs,
      options: [
        ...((tpls.data ?? []) as { id: string; title: string }[]).map((t) => ({ ...t, kind: "template" as const })),
        ...((libs.data ?? []) as { id: string; title: string }[]).map((t) => ({ ...t, kind: "library" as const })),
      ] as Option[],
    };
  });

export const updateFollowupItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), action: z.enum(["reschedule", "skip", "cancel"]), send_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), note: z.string().max(1000) }))
  .handler(async ({ context, data }) => {
    const { error } = await db(context.supabase).rpc("after_handoff_schedule_update", { _id: data.id, _action: data.action, _send_on: data.send_on, _note: data.note });
    fail(error);
    return { ok: true };
  });

export const addFollowupOneOff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ program_id: z.string().uuid(), property_id: z.string().uuid(), ...source, send_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), note: z.string().max(1000) }))
  .handler(async ({ context, data }) => {
    const { error } = await db(context.supabase).rpc("after_handoff_schedule_add_one_off", {
      _program_id: data.program_id, _property_id: data.property_id, _source_kind: data.source_kind, _source_id: data.source_id, _title: null, _send_on: data.send_on, _note: data.note,
    });
    fail(error);
    return { ok: true };
  });
