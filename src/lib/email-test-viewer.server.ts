import type { SupabaseClient } from "@supabase/supabase-js";
import { loadTeamRoleSeats } from "@/lib/access-seats";
import { seesEmailTestRecords } from "@/lib/email-intake";

/**
 * Register E1 (a): whether this person runs the email intake test plan (Admin, Operations
 * Supervisor held or covered, Director of Operations, Director of Onboarding), read with the
 * same database questions the app already asks for these roles. A failed read grants nothing.
 */
export async function canSeeEmailTests(db: SupabaseClient, userId: string): Promise<boolean> {
  const rpc = db.rpc.bind(db) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;
  const [roles, onboardingDirector, opsDirector, seats] = await Promise.all([
    db.from("user_roles").select("role").eq("user_id", userId),
    rpc("is_onboarding_director", { _user_id: userId }),
    rpc("is_director", { _user_id: userId }),
    loadTeamRoleSeats(db, userId),
  ]);
  const list = roles.error ? [] : ((roles.data ?? []) as { role: string }[]).map((r) => r.role);
  return seesEmailTestRecords(list, {
    opsSupervisor: seats.opsSupervisor === true,
    opsDirector: !opsDirector.error && opsDirector.data === true,
    onboardingDirector: !onboardingDirector.error && onboardingDirector.data === true,
  });
}
