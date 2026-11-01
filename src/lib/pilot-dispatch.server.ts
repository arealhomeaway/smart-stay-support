import { DEFAULT_BREEZEWAY_SENDING, sendingAllowsHome, type BreezewaySending } from "./pilot-dispatch";
export async function assertPilotHome(propertyId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient;
  const { data, error } = await db.from("breezeway_sending_settings").select("mode,home_ids").maybeSingle();
  if (error && !["PGRST205", "42P01"].includes(error.code)) throw new Error("Could not check Breezeway sending settings. Nothing was sent.");
  const setting: BreezewaySending | undefined = data ? { mode: data.mode, homeIds: data.home_ids } : undefined;
  if (setting && !["all_verified", "pilot_only"].includes(setting.mode)) throw new Error("Breezeway sending settings need Admin review.");
  if (!sendingAllowsHome(setting ?? DEFAULT_BREEZEWAY_SENDING, propertyId)) throw new Error("This home is not in the Breezeway pilot yet");
}