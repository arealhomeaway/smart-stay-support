import type { SupabaseClient } from "@supabase/supabase-js";
import { assertOwnerAccountRoles, runEnrollment, type EnrollmentInput } from "./active-owner-enrollment";

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
      const { applyRole } = await import("./access.server");
      const { writeAudit } = await import("./audit.server");
      async function find() {
        const r = await db.from("profiles").select("id").ilike("email", input.email).maybeSingle();
        if (r.error) throw new Error("Could not check the homeowner login.");
        return r.data?.id as string | undefined;
      }
      let id = await find();
      let created = false;
      if (!id) {
        const r = await db.auth.admin.createUser({ email: input.email,
          password: crypto.randomUUID() + crypto.randomUUID(), email_confirm: true,
          user_metadata: { full_name: input.name } });
        id = r.data.user?.id;
        created = Boolean(id);
        if (!id) id = await find();
        if (!id) throw new Error("Could not create the homeowner login. Please retry.");
      }
      // Return the created identity even if role/audit checkpoint fails; never hide an orphaned login.
      await checkpoint("account", id);
      const roles = await db.from("user_roles").select("role").eq("user_id", id);
      if (roles.error) throw new Error("Could not verify the homeowner's access.");
      const list = (roles.data ?? []).map((r) => String(r.role));
      assertOwnerAccountRoles(list);
      if (!list.includes("owner")) await applyRole(id, "owner");
      if (created) await writeAudit({ actorId, actorLabel: null, action: "user.created_for_active_owner",
        entityType: "user", entityId: id, entityLabel: input.email,
        after: { role: "owner", method: "active_owner_setup", property_id: input.propertyId } });
      return { id, created };
    },
    step: (step, id) => checkpoint(step, id),
  });
}