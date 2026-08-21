import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = "admin" | "manager" | "tech";
export const APP_ROLES: AppRole[] = ["admin", "manager", "tech"];

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
