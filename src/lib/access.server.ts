import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = "admin" | "manager" | "onboarding" | "tech" | "vendor" | "owner";
export const APP_ROLES: AppRole[] = ["admin", "manager", "onboarding", "tech", "vendor", "owner"];

type Client = SupabaseClient<Database>;

/** Throws unless the caller holds the admin role. Uses the caller's own RLS client. */
export async function assertAdmin(supabase: Client, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("Only an admin can change team access.");
}

export async function loadTeamAccess() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [profiles, roles] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, full_name, email").order("full_name"),
    supabaseAdmin.from("user_roles").select("user_id, role"),
  ]);
  if (profiles.error) throw profiles.error;
  if (roles.error) throw roles.error;

  return (profiles.data ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: p.email,
    roles: (roles.data ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as AppRole),
  }));
}

/** Sets a single role for a user, replacing any existing roles. */
export async function applyRole(targetUserId: string, role: AppRole) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const del = await supabaseAdmin.from("user_roles").delete().eq("user_id", targetUserId);
  if (del.error) throw del.error;
  const ins = await supabaseAdmin.from("user_roles").insert({ user_id: targetUserId, role });
  if (ins.error) throw ins.error;
  return { ok: true as const };
}

/** An admin must never remove their own admin access and lock the team out. */
export async function assertNotSelfDemotion(callerId: string, targetUserId: string, role: AppRole) {
  if (callerId === targetUserId && role !== "admin") {
    throw new Error("You cannot remove your own admin access. Ask another admin to do it.");
  }
}

export type AccountState = "invited" | "redeemed" | "active" | "disabled";

/** Admin-only: team list enriched with names and real sign-in state. */
export async function loadTeamAccessDetailed() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [base, profiles, invites, users] = await Promise.all([
    loadTeamAccess(),
    supabaseAdmin.from("profiles").select("id, first_name, last_name"),
    supabaseAdmin.from("team_invites").select("redeemed_by, redeemed_at").not("redeemed_by", "is", null),
    supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  if (profiles.error) throw profiles.error;
  if (users.error) throw new Error(users.error.message);
  const names = new Map((profiles.data ?? []).map((p) => [p.id, p]));
  const redeemed = new Set((invites.data ?? []).map((i) => i.redeemed_by));
  const authById = new Map(users.data.users.map((u) => [u.id, u]));
  return base.map((p) => {
    const u = authById.get(p.id);
    const bannedUntil = (u as { banned_until?: string | null } | undefined)?.banned_until ?? null;
    const disabled = !!bannedUntil && new Date(bannedUntil) > new Date();
    let state: AccountState = "active";
    let reason: string | null = null;
    if (!u) {
      state = "disabled";
      reason = "No sign-in account exists for this profile.";
    } else if (disabled) {
      state = "disabled";
      reason = "Sign-in turned off by an admin.";
    } else if (!u.last_sign_in_at) {
      state = redeemed.has(p.id) ? "redeemed" : "invited";
      if (!u.email_confirmed_at) reason = "Email address not yet confirmed.";
      else reason = "Has never signed in.";
    }
    return {
      ...p,
      first_name: names.get(p.id)?.first_name ?? null,
      last_name: names.get(p.id)?.last_name ?? null,
      state,
      reason,
      lastSignIn: u?.last_sign_in_at ?? null,
      emailConfirmed: !!u?.email_confirmed_at,
    };
  });
}

export async function updateTeammateProfile(
  targetUserId: string,
  input: { firstName: string; lastName: string; displayName: string },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const before = await supabaseAdmin
    .from("profiles")
    .select("first_name, last_name, full_name")
    .eq("id", targetUserId)
    .single();
  if (before.error) throw new Error("That person could not be found.");
  const after = {
    first_name: input.firstName.trim() || null,
    last_name: input.lastName.trim() || null,
    full_name: input.displayName.trim(),
  };
  const { error } = await supabaseAdmin.from("profiles").update(after).eq("id", targetUserId);
  if (error) throw error;
  return { before: before.data, after };
}

/** Disable or re-enable sign-in without deleting the person. */
export async function setTeammateActive(targetUserId: string, active: boolean) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
    ban_duration: active ? "none" : "876000h",
  });
  if (error) throw new Error(error.message);
  return { ok: true as const };
}
