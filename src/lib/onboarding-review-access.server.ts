import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  hasOnboardingReview,
  type OnboardingReviewCapabilities,
} from "./onboarding-review-capabilities";
import type { StageAction } from "./onboarding-stage";

type Client = SupabaseClient<Database>;
export async function readOnboardingReviewCapabilities(
  db: Client,
): Promise<OnboardingReviewCapabilities> {
  const { data, error } = await db.rpc("read_onboarding_review_capabilities");
  const capabilities = Array.isArray(data) && data.length === 1 ? data[0] : undefined;
  if (error || !capabilities)
    throw new Error("Could not verify your Onboarding review responsibility.");
  return capabilities;
}

export async function assertOnboardingStageAccess(
  db: Client,
  userId: string,
  propertyId: string,
  action?: StageAction,
) {
  const capabilities = await readOnboardingReviewCapabilities(db);
  const project = await db
    .from("onboarding_projects")
    .select("id, project_manager, status")
    .eq("property_id", propertyId)
    .neq("status", "cancelled")
    .maybeSingle();
  if (project.error) throw project.error;
  if (!project.data) throw new Error("Start onboarding before capturing a stage.");
  const execution = capabilities.is_admin || project.data.project_manager === userId;
  const reviewing = action && ["approve", "return", "reopen"].includes(action);
  const allowed = action
    ? reviewing
      ? capabilities.can_review_stages
      : execution
    : execution || hasOnboardingReview(capabilities);
  if (!allowed)
    throw new Error(
      reviewing
        ? "The Director of Onboarding must review this stage."
        : "This stage work is not assigned to you as PM; review access follows the protected leadership seats.",
    );
  return capabilities;
}
