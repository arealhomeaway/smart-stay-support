import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

export type LeadershipRole = "platform_owner" | "director" | "onboarding_director";

/**
 * Who may read program-wide homeowner data.
 *
 * Only the platform owner (admin) and directors (manager) qualify. Everyone
 * else — coordinators, onboarding staff, vendors and homeowners — is refused,
 * and the refusal happens server-side so hiding a menu item is never the only
 * protection.
 */
export async function requireLeadership(
  supabase: Client,
  userId: string,
  what: string,
  opts: { allowOnboardingDirector?: boolean } = {},
): Promise<LeadershipRole> {
  const [admin, manager] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "manager" }),
  ]);
  if (admin.error || manager.error) throw new Error("Could not verify your access level.");
  if (admin.data) return "platform_owner";
  if (manager.data) return "director";
  // The Onboarding Director manages owner participation during setup, so the
  // Active Owner views that need it accept that seat — never Operations.
  if (opts.allowOnboardingDirector) {
    const seat = await supabase.rpc("is_onboarding_director", { _user_id: userId });
    if (seat.error) throw new Error("Could not verify your access level.");
    if (seat.data) return "onboarding_director";
  }
  throw new Error(`${what} is limited to directors and the platform owner.`);
}

/**
 * Records who looked at homeowner-wide data, in what role, and when.
 * Reads are logged as well as writes because this data is personal.
 */
export async function recordOversightAccess(input: {
  actorId: string;
  role: LeadershipRole;
  action: "oversight_viewed" | "homeowner_directory_viewed" | "oversight_access_log_viewed";
  entityType: string;
  recordCount: number;
}) {
  const { writeAudit } = await import("./audit.server");
  await writeAudit({
    actorId: input.actorId,
    actorLabel: input.role,
    action: input.action,
    entityType: input.entityType,
    entityLabel: `${input.recordCount} record${input.recordCount === 1 ? "" : "s"}`,
    after: { role: input.role, records: input.recordCount, viewed_at: new Date().toISOString() },
  });
}
