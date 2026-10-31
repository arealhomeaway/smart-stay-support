import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OwnerFollowUpRow = {
  id: string;
  property_id: string;
  title: string;
  link_path: string;
  item_count: number;
  no_project_manager: boolean;
  created_at: string;
};

/** The signed-in teammate's open owner follow-ups. */
export const myOwnerFollowUps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { followUpsNotReady } = await import("./owner-followups.server");
    const res = await (context.supabase as never as import("@supabase/supabase-js").SupabaseClient)
      .from("owner_followup_tasks")
      .select("id, property_id, title, link_path, item_count, no_project_manager, created_at")
      .eq("assigned_to", context.userId)
      .eq("status", "open")
      .order("created_at");
    if (followUpsNotReady(res.error)) return { ready: false, rows: [] as OwnerFollowUpRow[] };
    if (res.error) throw new Error("Owner follow-ups could not be loaded.");
    return { ready: true, rows: (res.data ?? []) as OwnerFollowUpRow[] };
  });

/** "Reached out": closes the follow-up and records who and when. */
export const closeOwnerFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await (context.supabase as never as import("@supabase/supabase-js").SupabaseClient).rpc(
      "close_owner_followup",
      { _task_id: data.id },
    );
    if (error) throw new Error(error.message || "This follow-up could not be closed.");
    return { ok: true };
  });
