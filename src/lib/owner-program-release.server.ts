import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { assertActiveOwnerEnrollAuthority } from "./owner-program.server";

const previewSchema = z.object({
  programId: z.string(), count: z.number().int().nonnegative(),
  missing: z.number().int().nonnegative(), prepared: z.number().int().nonnegative(),
  homes: z.array(z.string()), reportVersion: z.string(),
});
const receiptSchema = z.object({
  programId: z.string(), added: z.number().int().nonnegative(),
  opened: z.number().int().nonnegative(), summaryId: z.string().nullable(),
});

export async function programActivityRelease(
  supabase: SupabaseClient<Database>, userId: string,
  input: { programId: string; expectedVersion: string; preview: boolean; expectedCount?: number },
) {
  await assertActiveOwnerEnrollAuthority(supabase, userId);
  // Narrow adapter for approval-only SQL; generated types change only when it is applied.
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: "release_owner_program_activities",
    args: { _program_id: string; _expected_version: string; _preview: boolean; _expected_count: number | null },
  ) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
  const { data, error } = await rpc("release_owner_program_activities", {
    _program_id: input.programId, _expected_version: input.expectedVersion,
    _preview: input.preview, _expected_count: input.expectedCount ?? null,
  });
  if (error) {
    if (error.code === "PGRST202") throw new Error("Activity release is waiting for its approved release update.");
    throw new Error(error.message);
  }
  if (input.preview) {
    const preview = previewSchema.parse(data);
    if (preview.programId !== input.programId) throw new Error("The program could not be confirmed.");
    return { preview, receipt: null };
  }
  const receipt = receiptSchema.parse(data);
  if (receipt.programId !== input.programId) throw new Error("The release could not be confirmed.");
  return { preview: null, receipt };
}