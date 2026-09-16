import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;
export async function readOnboardingAssignmentAuthority(supabase: Client) {
  const { data, error } = await supabase.rpc("read_onboarding_assignment_authority");
  const authority = Array.isArray(data) && data.length === 1 ? data[0] : undefined;
  if (error || !authority) {
    throw new Error("Could not verify Onboarding responsibility assignments.");
  }
  return { canAssign: authority.can_assign === true, directorId: authority.director_id };
}

export async function assertEligibleProjectAssignees(supabase: Client, ids: (string | null)[]) {
  for (const id of new Set(ids.filter((id): id is string => id !== null))) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new Error("Choose an existing staff account for project responsibility.");
    }
    const { data, error } = await supabase.rpc("is_onboarding_staff", { _user_id: id });
    if (error || data !== true) {
      throw new Error(
        "Project responsibility requires an Onboarding or supervisory staff account.",
      );
    }
  }
}

export async function resolveNewProjectAssignments(
  supabase: Client,
  userId: string,
  input: { projectManager: string | null; director: string | null },
) {
  const authority = await readOnboardingAssignmentAuthority(supabase);
  if (!authority.canAssign) {
    if (input.projectManager !== null && input.projectManager !== userId) {
      throw new Error("Only Onboarding leadership can assign another project manager.");
    }
    if (input.director !== null && input.director !== authority.directorId) {
      throw new Error("The Onboarding Director comes from the protected responsibility seat.");
    }
  }
  const assignments = authority.canAssign
    ? input
    : {
        projectManager: userId,
        director: authority.directorId,
      };
  await assertEligibleProjectAssignees(supabase, [
    assignments.projectManager,
    assignments.director,
  ]);
  return assignments;
}
