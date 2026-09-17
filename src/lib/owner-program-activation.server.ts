import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Preserve the version actually reviewed by staff; never substitute a fresh read. */
export async function activateOwnerProgramAtomically(
  supabase: SupabaseClient<Database>,
  input: { programId: string; expectedVersion: string; startedOn: string },
) {
  const { data, error } = await supabase.rpc("activate_owner_program", {
    _program_id: input.programId,
    _expected_version: input.expectedVersion,
    _started_on: input.startedOn,
  });
  if (error) throw error;
  if (!data) throw new Error("The program changed. Review current details before activating.");
  return { ok: true as const };
}
