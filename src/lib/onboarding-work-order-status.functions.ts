/**
 * Breezeway status for a list of onboarding Tasks, read as the signed-in teammate (RLS applies).
 * Reads the synced Breezeway mirror only; never calls Breezeway.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { workOrderStatusLabel, type WorkOrderStatusLabel } from "./onboarding-work-order-status";

export type TaskWorkOrderStatus = { label: WorkOrderStatusLabel; reopenReason: string | null };

type Loose = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

export const taskWorkOrderStatusesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ taskIds: z.array(z.string().uuid()).max(5000) }).parse(d))
  .handler(async ({ context, data }): Promise<Record<string, TaskWorkOrderStatus>> => {
    if (data.taskIds.length === 0) return {};
    const db = context.supabase as unknown as Loose;
    const ids = [...new Set(data.taskIds)];
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200));
    const sent: { onboarding_task_id: string; breezeway_task_id: number | null; created_at: string }[] = [];
    const pasted: { task_id: string; breezeway_task_id: number | null }[] = [];
    const watch: { task_id: string; state: string; reopen_reason: string | null; created_at: string }[] = [];
    for (const c of chunks) {
      const [o, l, w] = await Promise.all([
        db.from("breezeway_outbound_tasks").select("onboarding_task_id, breezeway_task_id, created_at").in("onboarding_task_id", c).not("breezeway_task_id", "is", null),
        db.from("onboarding_task_breezeway_links").select("task_id, breezeway_task_id").in("task_id", c).not("breezeway_task_id", "is", null),
        db.from("onboarding_task_work_order_watch").select("task_id, state, reopen_reason, created_at").in("task_id", c),
      ]);
      if (o.error) throw new Error(o.error.message);
      if (l.error) throw new Error(l.error.message);
      sent.push(...(o.data ?? []));
      pasted.push(...(l.data ?? []));
      // Before the staged change the watch table is absent; no reopen reasons yet.
      if (!w.error) watch.push(...(w.data ?? []));
    }
    const bzFor = new Map<string, number>();
    for (const p of pasted) if (p.breezeway_task_id) bzFor.set(p.task_id, Number(p.breezeway_task_id));
    for (const s of [...sent].sort((a, b) => a.created_at.localeCompare(b.created_at)))
      if (s.breezeway_task_id) bzFor.set(s.onboarding_task_id, Number(s.breezeway_task_id));
    const bzIds = [...new Set(bzFor.values())];
    const mirror = new Map<number, { stage: string | null; status: string | null; scheduled_date: string | null }>();
    for (let i = 0; i < bzIds.length; i += 200) {
      const r = await db.from("breezeway_work_orders").select("breezeway_task_id, stage, status, scheduled_date").in("breezeway_task_id", bzIds.slice(i, i + 200));
      if (r.error) throw new Error(r.error.message);
      for (const m of r.data ?? []) mirror.set(Number(m.breezeway_task_id), m);
    }
    const latestWatch = new Map<string, (typeof watch)[number]>();
    for (const w of [...watch].sort((a, b) => a.created_at.localeCompare(b.created_at))) latestWatch.set(w.task_id, w);
    const out: Record<string, TaskWorkOrderStatus> = {};
    for (const [taskId, bz] of bzFor) {
      const m = mirror.get(bz);
      if (!m) continue;
      const w = latestWatch.get(taskId);
      out[taskId] = {
        label: workOrderStatusLabel(m.stage, m.status, m.scheduled_date),
        reopenReason: w?.state === "reopened" ? w.reopen_reason ?? null : null,
      };
    }
    return out;
  });
