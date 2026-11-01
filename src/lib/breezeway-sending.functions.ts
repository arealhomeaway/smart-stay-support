import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_BREEZEWAY_SENDING } from "./pilot-dispatch";
import { formatPropertyLabel } from "./property-label";
export const loadBreezewaySending = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { assertAdmin } = await import("./access.server");
  await assertAdmin(context.supabase, context.userId);
  const db = context.supabase as unknown as import("@supabase/supabase-js").SupabaseClient;
  const [setting, history, homes] = await Promise.all([
    db.from("breezeway_sending_settings").select("mode,home_ids").maybeSingle(),
    db.from("breezeway_sending_history").select("id,actor_id,before_value,after_value,created_at").order("created_at", { ascending: false }).limit(30),
    context.supabase.from("properties").select("id,name,address_line1,nickname,unit,city,state,postal_code,ownerrez_property_id").eq("is_demo", false).is("archived_at", null).order("name"),
  ]);
  const pending = setting.error?.code === "PGRST205" || setting.error?.code === "42P01";
  if (!pending && (setting.error || history.error)) throw new Error("Could not read Breezeway sending settings.");
  if (homes.error) throw new Error("Could not read homes.");
  return { pending, setting: setting.data ? { mode: setting.data.mode as "all_verified" | "pilot_only", homeIds: setting.data.home_ids as string[] } : DEFAULT_BREEZEWAY_SENDING,
    homes: (homes.data ?? []).map(p => ({ id: p.id, label: formatPropertyLabel(p).primary })), history: history.data ?? [] };
});
export const saveBreezewaySending = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
 .inputValidator((input: unknown) => z.object({ mode: z.enum(["all_verified","pilot_only"]), homeIds: z.array(z.string().uuid()) }).parse(input))
 .handler(async ({ context, data }) => {
   const { assertAdmin } = await import("./access.server");
   await assertAdmin(context.supabase, context.userId);
   const db = context.supabase as unknown as import("@supabase/supabase-js").SupabaseClient;
   const { error } = await db.rpc("save_breezeway_sending", { _mode: data.mode, _home_ids: [...new Set(data.homeIds)] });
   if (error) throw new Error("Could not save Breezeway sending settings. Nothing changed.");
   return { ok: true };
 });