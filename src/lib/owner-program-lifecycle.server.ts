import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;
export type OwnerProgramChange = {
  programId: string;
  expectedVersion: string;
  action:
    "add_property" | "remove_property" | "confirm_closing" | "settings" | "status" | "seed_roadmap";
  propertyId?: string;
  closingDate?: string | null;
  settings?: Json;
  status?: string;
  reason?: string;
  phase?: string;
};
export async function changeOwnerProgramAtomically(supabase: Client, input: OwnerProgramChange) {
  const { data, error } = await supabase.rpc("change_owner_program", {
    _program_id: input.programId,
    _expected_version: input.expectedVersion,
    _action: input.action,
    ...(input.propertyId ? { _property_id: input.propertyId } : {}),
    ...(input.closingDate ? { _closing_date: input.closingDate } : {}),
    ...(input.settings ? { _settings: input.settings } : {}),
    ...(input.status ? { _status: input.status } : {}),
    ...(input.reason ? { _reason: input.reason } : {}),
    ...(input.phase ? { _phase: input.phase } : {}),
  });
  if (error) throw error;
  const receipt = z
    .object({
      programId: z.string(),
      added: z.number().int().nonnegative(),
      reportVersion: z.string(),
    })
    .parse(data);
  if (receipt.programId !== input.programId)
    throw new Error("The program change was not confirmed. Refresh before trying again.");
  return receipt;
}
export async function createOwnerProgramAtomically(supabase: Client, propertyId: string) {
  const { data, error } = await supabase.rpc("create_owner_program", { _property_id: propertyId });
  if (error) throw error;
  return z.object({ programId: z.string(), alreadyExists: z.boolean() }).parse(data);
}
