import { DEFAULT_BREEZEWAY_SENDING, sendingAllowsHome, type BreezewaySending } from "./pilot-dispatch";
export async function assertPilotHome(propertyId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("app_settings").select("value").eq("key", "breezeway_sending").maybeSingle();
  if (error) throw new Error("Could not check Breezeway sending settings. Nothing was sent.");
  const setting = data?.value as BreezewaySending | undefined;
  if (setting && !["all_verified", "pilot_only"].includes(setting.mode)) throw new Error("Breezeway sending settings need Admin review.");
  if (!sendingAllowsHome(setting ?? DEFAULT_BREEZEWAY_SENDING, propertyId)) throw new Error("This home is not in the Breezeway pilot yet");
}