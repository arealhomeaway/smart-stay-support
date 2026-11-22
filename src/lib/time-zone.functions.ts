/** A person's own time zone (used for the onboarding 8 AM reminder). */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Loose = { from: (t: string) => any; rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string; code?: string } | null }> };

export const getMyTimeZoneFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ready: boolean; timeZone: string | null }> => {
    const sb = context.supabase as unknown as Loose;
    const { data, error } = await sb.from("profiles").select("time_zone").eq("id", context.userId).maybeSingle();
    if (error) return { ready: false, timeZone: null };
    return { ready: true, timeZone: (data?.time_zone as string | null) ?? null };
  });

export const setMyTimeZoneFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ timeZone: z.string().min(3).max(64) }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as unknown as Loose;
    const { error } = await sb.rpc("set_my_time_zone", { _tz: data.timeZone });
    if (error) throw new Error(error.message ?? "Could not save the time zone.");
    return { timeZone: data.timeZone };
  });
