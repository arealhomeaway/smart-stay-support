import type { SupabaseClient } from "@supabase/supabase-js";
import { assertOwnerAccountRoles, runEnrollment, type EnrollmentInput } from "./active-owner-enrollment";

/**
 * The one canonical homeowner login path: reuse the login for this email or create it
 * (random password; the welcome email carries the set-password link). Role assignment is
 * never done here; the caller's guarded database checkpoint grants the owner role only.
 */
export async function findOrCreateOwnerLogin(db: SupabaseClient, email: string, name: string) {
  async function find() {
    const r = await db.from("profiles").select("id").ilike("email", email).maybeSingle();
    if (r.error) throw new Error("Could not check the homeowner login.");
    return r.data?.id as string | undefined;
  }
  let id = await find();
  let created = false;
  if (!id) {
    const r = await db.auth.admin.createUser({ email,
      password: crypto.randomUUID() + crypto.randomUUID(), email_confirm: true,
      user_metadata: { full_name: name } });
    id = r.data.user?.id;
    created = Boolean(id);
    if (!id) id = await find();
    if (!id) throw new Error("Could not create the homeowner login. Please retry.");
  }
  return { id, created };
}

/** Existing enrollment action delegates here; every database checkpoint uses existing canonical RPCs. */
export async function enrollFully(db: SupabaseClient, actor: SupabaseClient, actorId: string, input: EnrollmentInput) {
  async function checkpoint(step: string, accountId?: string) {
    const r = await actor.rpc("active_owner_enrollment_step", {
      _request_id: input.requestId, _step: step, _input: input, _account_id: accountId ?? null,
    });
    if (r.error) throw new Error(r.error.message);
    if (!r.data) throw new Error("Enrollment was not confirmed. Retry before continuing.");
    return r.data as { programId: string; added?: number; held?: boolean };
  }
  return runEnrollment({
    prepare: async () => { await checkpoint("prepare"); },
    account: async () => {
      const { id, created } = await findOrCreateOwnerLogin(db, input.email, input.name);
      // Return the created identity even if role/audit checkpoint fails; never hide an orphaned login.
      try {
      await checkpoint("account", id);
      const roles = await db.from("user_roles").select("role").eq("user_id", id);
      if (roles.error) throw new Error("Could not verify the homeowner's access.");
      const list = (roles.data ?? []).map((r) => String(r.role));
      assertOwnerAccountRoles(list);
      // Role assignment and audit occur under the guarded, atomic account checkpoint.
      } catch (error) {
        const problem = new Error(error instanceof Error ? error.message : "The login exists but setup needs attention.");
        Object.assign(problem, { accountId: id });
        throw problem;
      }
      return { id, created };
    },
    step: (step, id) => checkpoint(step, id),
  });
}