import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** The service-only transaction verifies the account's current confirmed email itself. */
export async function redeemOwnerInviteAtomically(
  admin: SupabaseClient<Database>,
  userId: string,
  code: string,
) {
  const { data, error } = await admin.rpc("redeem_owner_invite", {
    _user_id: userId,
    _code: code.trim().toUpperCase(),
  });
  if (error) throw error;
  if (!data) throw new Error("The owner invitation could not be redeemed. Please try again.");
  return { ok: true as const, programId: data };
}
