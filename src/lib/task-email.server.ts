/**
 * After a homeowner email from an onboarding Task is accepted for delivery,
 * record it on the Task's project history and the home's activity history.
 * Writes go through the caller's own client, so existing RLS applies.
 * History failures never undo or repeat the send; they are logged.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { taskEmailEventSummary } from "./task-email";

export async function recordTaskEmailEvents(
  supabase: SupabaseClient,
  input: { taskId: string; propertyId: string; isDemo: boolean; subject: string; actor: string },
) {
  const summary = taskEmailEventSummary(input.subject);
  const { data: project } = await supabase
    .from("onboarding_projects" as never)
    .select("id")
    .eq("property_id", input.propertyId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const projectId = (project as { id: string } | null)?.id ?? null;
  if (projectId) {
    const { error } = await supabase.from("onboarding_project_events" as never).insert({
      project_id: projectId,
      property_id: input.propertyId,
      kind: "homeowner_emailed",
      summary,
      new_value: input.taskId,
      actor: input.actor,
      is_demo: input.isDemo,
    } as never);
    if (error) console.error("task email: project event not saved", error.message);
  }
  const { error: logError } = await supabase.from("property_activity_log" as never).insert({
    property_id: input.propertyId,
    category: "administrative",
    what_happened: summary,
    outcome: "Email sent from an onboarding Task.",
    is_demo: input.isDemo,
  } as never);
  if (logError) console.error("task email: home history not saved", logError.message);
}
