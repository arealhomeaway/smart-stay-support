import type { SupabaseClient } from "@supabase/supabase-js";
import {
  OPS_SUPERVISOR_ROLE_CODE,
  PROJECT_MANAGER_ROLE_CODES,
  UTILITIES_ROLE_CODES,
  seatsFromRoleCodes,
  type AccessSeats,
} from "@/lib/permissions";

const CODES = [OPS_SUPERVISOR_ROLE_CODE, ...PROJECT_MANAGER_ROLE_CODES, ...UTILITIES_ROLE_CODES];

/**
 * The team roles that carry a permission (Operations Supervisor, Project
 * Manager, Utilities) for one person, read with the existing database rules:
 * held seats, role pools and today's cover for the Operations Supervisor.
 * A failed read grants nothing.
 */
export async function loadTeamRoleSeats(
  supabase: SupabaseClient,
  userId: string,
): Promise<Pick<AccessSeats, "opsSupervisor" | "projectManager" | "utilities">> {
  const [held, pools, cover] = await Promise.all([
    supabase.from("functional_roles").select("code").eq("current_seat_holder", userId).eq("active", true).in("code", CODES),
    supabase.from("functional_role_members").select("role_code").eq("user_id", userId).in("role_code", CODES),
    supabase.rpc("seat_holder_at" as never, { _role_code: OPS_SUPERVISOR_ROLE_CODE } as never),
  ]);
  const codes = [
    ...((held.error ? [] : held.data) ?? []).map((r) => (r as { code: string }).code),
    ...((pools.error ? [] : pools.data) ?? []).map((r) => (r as { role_code: string }).role_code),
  ];
  if (!cover.error && cover.data === userId) codes.push(OPS_SUPERVISOR_ROLE_CODE);
  return seatsFromRoleCodes(codes);
}
