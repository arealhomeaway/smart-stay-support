/**
 * Onboarding escalations: an owner card (or its Task) escalated to the Director of Onboarding.
 * They reuse the Operations escalations table, marked by the Director of Onboarding role and an
 * owner card or Task instead of a ticket (docs/pending/onboarding-notify-escalate). Every write goes
 * through the caller-authenticated database actions, which check scope and send the alert.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();
export const ESCALATIONS_NOT_YET = "Escalations start once the Admin approves the database change.";

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;
type Sb = { rpc: Rpc; from: (t: string) => any };

function missing(e: { message?: string; code?: string } | null) {
  return Boolean(e && (e.code === "PGRST202" || e.code === "42883" || e.code === "42703" || /could not find the function|does not exist/i.test(e.message ?? "")));
}

export type OnboardingEscalation = {
  id: string;
  workItemId: string | null;
  taskId: string | null;
  title: string;
  reason: string;
  raisedBy: string;
  raisedById: string;
  raisedAt: string;
};

export const raiseOnboardingEscalationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ workItemId: uuid.nullable(), taskId: uuid.nullable(), reason: z.string().trim().min(3).max(2000) })
      .refine((v) => v.workItemId || v.taskId, "Pick an owner item or a Task.")
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase as unknown as Sb;
    const { data: id, error } = await sb.rpc("raise_onboarding_escalation", {
      _work_item_id: data.workItemId, _task_id: data.taskId, _reason: data.reason,
    });
    if (error) throw new Error(missing(error) ? ESCALATIONS_NOT_YET : (error.message ?? "Could not escalate."));
    return { id: String(id) };
  });

export const resolveOnboardingEscalationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid, note: z.string().trim().max(2000) }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as unknown as Sb;
    const { error } = await sb.rpc("resolve_onboarding_escalation", { _id: data.id, _note: data.note });
    if (error) throw new Error(missing(error) ? ESCALATIONS_NOT_YET : (error.message ?? "Could not close it."));
    return { ok: true };
  });

/** Every open escalation on one home, newest first. Empty (ready: false) until the change is applied. */
export const listOnboardingEscalationsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: uuid }).parse(d))
  .handler(async ({ context, data }): Promise<{ ready: boolean; rows: OnboardingEscalation[] }> => {
    const sb = context.supabase as unknown as Sb;
    const res = await sb
      .from("escalations")
      .select("id, work_item_id, onboarding_task_id, reason, escalated_by, created_at")
      .eq("property_id", data.propertyId)
      .eq("escalated_to_role", "onboarding_director")
      .eq("status", "open")
      .order("created_at", { ascending: false });
    if (res.error) {
      if (missing(res.error)) return { ready: false, rows: [] };
      throw new Error(res.error.message);
    }
    const rows = (res.data ?? []) as { id: string; work_item_id: string | null; onboarding_task_id: string | null; reason: string; escalated_by: string; created_at: string }[];
    const wiIds = [...new Set(rows.map((r) => r.work_item_id).filter(Boolean))] as string[];
    const taskIds = [...new Set(rows.map((r) => r.onboarding_task_id).filter(Boolean))] as string[];
    const people = [...new Set(rows.map((r) => r.escalated_by))];
    const [wi, tasks, prof] = await Promise.all([
      wiIds.length ? sb.from("work_items").select("id, title").in("id", wiIds) : Promise.resolve({ data: [] }),
      taskIds.length ? sb.from("onboarding_tasks").select("id, title").in("id", taskIds) : Promise.resolve({ data: [] }),
      people.length ? sb.from("profiles").select("id, full_name, email").in("id", people) : Promise.resolve({ data: [] }),
    ]);
    const title = new Map<string, string>([
      ...((wi.data ?? []) as { id: string; title: string }[]).map((x) => [`w:${x.id}`, x.title] as [string, string]),
      ...((tasks.data ?? []) as { id: string; title: string }[]).map((x) => [`t:${x.id}`, x.title] as [string, string]),
    ]);
    const who = new Map(((prof.data ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((p) => [p.id, p.full_name || p.email || "A teammate"]));
    return {
      ready: true,
      rows: rows.map((r) => ({
        id: r.id,
        workItemId: r.work_item_id,
        taskId: r.onboarding_task_id,
        title: (r.work_item_id && title.get(`w:${r.work_item_id}`)) || (r.onboarding_task_id && title.get(`t:${r.onboarding_task_id}`)) || "Owner item",
        reason: r.reason,
        raisedBy: who.get(r.escalated_by) ?? "A teammate",
        raisedById: r.escalated_by,
        raisedAt: r.created_at,
      })),
    };
  });
