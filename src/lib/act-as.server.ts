import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAudit } from "./audit.server";

/**
 * Staff "Act as" test mode.
 *
 * A supervisor can step fully into a homeowner's account to test what that
 * homeowner actually experiences. It is not a lens: a genuine session for the
 * target account is minted, so every RLS policy and `auth.uid()` check applies
 * unchanged. Entering and leaving are both audited.
 */

/** Leadership or whoever holds the Onboarding Director seat — nobody else. */
async function assertSupervisor(db: SupabaseClient, userId: string) {
  const [sup, dir] = await Promise.all([
    db.rpc("is_supervisor", { _user_id: userId }),
    db.rpc("is_onboarding_director", { _user_id: userId }),
  ]);
  if (!sup.data && !dir.data)
    throw new Error("Acting as a homeowner is limited to leadership and the Onboarding Director.");
}

export type ActAsGrant = {
  tokenHash: string;
  email: string;
  name: string;
  userId: string;
};

/** Mint a one-time sign-in for an Active Owner account. Supervisors only. */
export async function startActAs(
  db: SupabaseClient,
  actorId: string,
  targetUserId: string,
): Promise<ActAsGrant> {
  await assertSupervisor(db, actorId);
  if (actorId === targetUserId) throw new Error("You are already signed in as this account.");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Only homeowner accounts that actually hold a program may be acted as —
  // never another staff or admin account.
  const { data: program } = await supabaseAdmin
    .from("owner_programs")
    .select("id")
    .eq("owner_user_id", targetUserId)
    .limit(1)
    .maybeSingle();
  if (!program) throw new Error("This account is not an Active Owner, so it cannot be tested.");

  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", targetUserId);
  const roleList = (roles ?? []).map((r) => r.role as string);
  if (roleList.some((r) => r === "admin" || r === "manager")) {
    throw new Error("Staff accounts cannot be acted as.");
  }

  const { data: account, error: accountError } =
    await supabaseAdmin.auth.admin.getUserById(targetUserId);
  const email = account?.user?.email;
  if (accountError || !email) throw new Error("This homeowner has no portal login yet.");

  const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    throw new Error(linkError?.message ?? "Could not open a test session for this homeowner.");
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", targetUserId)
    .maybeSingle();
  const name = profile?.full_name || email;

  await writeAudit({
    actorId,
    action: "act_as_started",
    entityType: "user",
    entityId: targetUserId,
    entityLabel: name,
    reason: "Staff test mode — acting as this homeowner.",
  });

  return { tokenHash, email, name, userId: targetUserId };
}

/** Record the return to the staff account. Called once the staff session is back. */
export async function endActAs(db: SupabaseClient, actorId: string, targetUserId: string) {
  await assertSupervisor(db, actorId);
  await writeAudit({
    actorId,
    action: "act_as_ended",
    entityType: "user",
    entityId: targetUserId,
    reason: "Returned to own staff account.",
  });
  return { ok: true };
}
