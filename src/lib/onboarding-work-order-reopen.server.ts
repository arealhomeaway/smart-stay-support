/**
 * Five-minute pass: a Task done because its Breezeway work order was created reopens for the
 * Project Manager when that work order is canceled in Breezeway or passes its date unfinished.
 * The rule lives only in DB reopen_tasks_for_work_orders, which reads the synced Breezeway
 * mirror and never writes to Breezeway. Skipped until the staged change is applied.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function runWorkOrderReopenPass(admin: SupabaseClient) {
  const rpc = admin.rpc.bind(admin) as unknown as (name: string) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>;
  const r = await rpc("reopen_tasks_for_work_orders");
  if (r.error) {
    if (r.error.code === "PGRST202" || r.error.code === "42883") return { skipped: true, reason: "not_applied" };
    throw new Error(`Work order reopen pass failed: ${r.error.code ?? "error"}`);
  }
  return r.data;
}
