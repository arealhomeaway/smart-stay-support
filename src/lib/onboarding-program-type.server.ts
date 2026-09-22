/**
 * Switch a home between the standard program and the Active Owner Program
 * while onboarding is under way.
 *
 * Active Owner is scope, so the change runs through updateProject: history
 * records the reason, enrollment is created when the home joins, and the
 * target handoff date follows the matching rule (three weeks standard, four
 * weeks Active Owner) unless someone has typed their own date.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { updateProject } from "./onboarding-project.server";
import { autoHandoffDate, type HandoffDateSource } from "./onboarding-dates";
import type { ModuleKey } from "./onboarding-scope";

type Client = SupabaseClient<Database>;

export async function setOnboardingProgramType(
  supabase: Client,
  userId: string,
  input: { propertyId: string; activeOwner: boolean; reason: string },
) {
  const projects = await supabase
    .from("onboarding_projects")
    .select("id, modules, target_handoff_source")
    .eq("property_id", input.propertyId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1);
  if (projects.error) throw projects.error;
  const project = projects.data?.[0];
  if (!project)
    throw new Error("Start onboarding for this home before choosing its program type.");

  const current = (project.modules ?? []) as ModuleKey[];
  const isActive = current.includes("active_owner");
  if (isActive === input.activeOwner) return { ok: true as const, changed: false };

  const modules: ModuleKey[] = input.activeOwner
    ? [...current, "active_owner" as ModuleKey]
    : current.filter((m) => m !== "active_owner");

  const property = await supabase
    .from("properties")
    .select("actual_access_on")
    .eq("id", input.propertyId)
    .maybeSingle();
  if (property.error) throw property.error;

  const source = (project.target_handoff_source as HandoffDateSource) ?? "auto";
  const targetHandoffOn =
    source === "manual"
      ? undefined
      : (autoHandoffDate(property.data?.actual_access_on ?? null, input.activeOwner) ?? null);

  await updateProject(supabase, userId, {
    projectId: project.id,
    modules,
    ...(targetHandoffOn !== undefined ? { targetHandoffOn } : {}),
    reason: input.reason,
  });

  return { ok: true as const, changed: true, activeOwner: input.activeOwner, targetHandoffOn };
}
