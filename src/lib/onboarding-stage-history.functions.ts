/**
 * The stage trail for one onboarding task: the phase it came from, the stage
 * it sits in now, who owned it at each point, and every later remapping.
 *
 * Read-only. The history itself is written by a database trigger, so no write
 * path can move a task between stages without leaving a record.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function assertStaff(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.rpc("is_staff", { _user_id: userId });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("Only Resolve staff can see a task's stage history.");
}

function uuid(value: unknown): string {
  const id = String(value ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid task reference.");
  return id;
}

export type StageHistoryEntry = {
  id: string;
  fromStage: string | null;
  toStage: string;
  legacyStage: string | null;
  assignedSeat: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  changedBy: string | null;
  changedByName: string | null;
  reason: string | null;
  at: string;
};

export const taskStageHistoryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ({ taskId: uuid((data as { taskId?: string })?.taskId) }))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as SupabaseClient<Database>;
    await assertStaff(supabase, context.userId as string);

    const { data: rows, error } = await supabase
      .from("onboarding_task_stage_history")
      .select("id, from_stage, to_stage, legacy_stage, assigned_seat, assigned_to, changed_by, reason, created_at")
      .eq("task_id", data.taskId)
      .order("created_at", { ascending: true });
    if (error) throw new Error("Could not read this task's stage history.");

    const ids = Array.from(
      new Set((rows ?? []).flatMap((r) => [r.assigned_to, r.changed_by]).filter(Boolean)),
    ) as string[];
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: people } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      for (const p of people ?? []) names.set(p.id, p.full_name ?? "");
    }

    return (rows ?? []).map<StageHistoryEntry>((r) => ({
      id: r.id,
      fromStage: r.from_stage,
      toStage: r.to_stage,
      legacyStage: r.legacy_stage,
      assignedSeat: r.assigned_seat,
      assignedTo: r.assigned_to,
      assignedToName: r.assigned_to ? (names.get(r.assigned_to) || null) : null,
      changedBy: r.changed_by,
      changedByName: r.changed_by ? (names.get(r.changed_by) || null) : null,
      reason: r.reason,
      at: r.created_at,
    }));
  });
