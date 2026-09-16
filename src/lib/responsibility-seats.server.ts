import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export function isProtectedResponsibilitySeat(code: string | null) {
  return code !== null && ["director_onboarding", "director_ops", "ops_supervisor"].includes(code);
}

/** Return the caller client so the database verifies the same administrator. */
export async function responsibilitySeatWriter(
  context: { supabase: SupabaseClient<Database>; userId: string },
  code: string,
  elevated: () => Promise<SupabaseClient<Database>>,
) {
  if (!isProtectedResponsibilitySeat(code)) return elevated();
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || data !== true) {
    throw new Error(
      "Only a platform administrator can change this responsibility seat or its cover.",
    );
  }
  return context.supabase;
}
