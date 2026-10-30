import type { SupabaseClient } from "@supabase/supabase-js";
import { assertOwnerAccountRoles } from "./active-owner-enrollment";
import { findOrCreateOwnerLogin } from "./active-owner-enrollment.server";

export type AddCoOwnerResult = {
  memberId: string;
  userId: string;
  linkedExisting: boolean;
  welcomeQueued: boolean;
  held: boolean;
};

/** Before 05 is applied the database functions do not exist; say so plainly. */
export const CO_OWNERS_NOT_READY = "Co-owner logins are not turned on yet.";
export function isMissingFunction(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return error.code === "PGRST202" || error.code === "42883" || /Could not find the function/i.test(error.message ?? "");
}

/**
 * Add a co-owner. The caller's own session runs every check first (authority, staff email,
 * primary, duplicate); a login is created only after the database says one is needed, then the
 * same guarded function links it, grants the owner role only, records history and queues the
 * co-owner's welcome in one transaction.
 */
export async function addCoOwner(
  db: SupabaseClient,
  actor: SupabaseClient,
  input: { programId: string; name: string; email: string },
): Promise<AddCoOwnerResult> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  async function call(accountId: string | null) {
    const r = await actor.rpc("add_program_co_owner" as never, {
      _program_id: input.programId, _full_name: name, _email: email, _account_id: accountId,
    } as never);
    if (isMissingFunction(r.error)) throw new Error(CO_OWNERS_NOT_READY);
    if (r.error) throw new Error(r.error.message);
    return r.data as unknown as (AddCoOwnerResult & { needsAccount?: boolean }) | null;
  }
  const first = await call(null);
  if (!first) throw new Error("The co-owner was not confirmed. Please retry.");
  if (!first.needsAccount) return first;
  const { id } = await findOrCreateOwnerLogin(db, email, name);
  try {
    const roles = await db.from("user_roles").select("role").eq("user_id", id);
    if (roles.error) throw new Error("Could not verify the homeowner's access.");
    assertOwnerAccountRoles((roles.data ?? []).map((r) => String(r.role)));
    const done = await call(id);
    if (!done || done.needsAccount) throw new Error("The co-owner was not confirmed. Please retry.");
    return done;
  } catch (error) {
    // Never hide a created login: Retry links the same login instead of creating another.
    const problem = new Error(error instanceof Error ? error.message : "The login exists but setup needs attention.");
    Object.assign(problem, { accountId: id });
    throw problem;
  }
}
