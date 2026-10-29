import { breezewayCompleted, breezewayCompletionAllowed } from "./breezeway-task-completion";
import { loadStageCaptures } from "./onboarding-stage.server";
import type { StateProperty, StateProject } from "./onboarding-state";
import type { WorkflowTask } from "./onboarding-workflow";

/** Called only after an authenticated Breezeway read and verified property mapping, never from an untrusted payload. */
export async function reconcileBreezewayTaskCompletion(input: { id: number; propertyId: string; stage: string | null; status: string | null; updatedAt: string | null }) {
  if (!breezewayCompleted(input.stage, input.status)) return;
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const links = await db.from("breezeway_outbound_tasks").select("id,onboarding_task_id,property_id").eq("breezeway_task_id", input.id).eq("source_type", "onboarding_task").eq("property_id", input.propertyId);
  if (links.error) throw links.error;
  const link = links.data?.[0];
  if (!link?.onboarding_task_id || links.data?.length !== 1) return;
  const [home, project, tasks, captures] = await Promise.all([
    db.from("properties").select("*").eq("id", input.propertyId).is("archived_at", null).maybeSingle(),
    db.from("onboarding_projects").select("*").eq("property_id", input.propertyId).neq("status", "cancelled").maybeSingle(),
    db.from("onboarding_tasks").select("*").eq("property_id", input.propertyId).is("archived_at", null),
    loadStageCaptures(db, input.propertyId),
  ]);
  if (home.error || project.error || tasks.error) throw home.error ?? project.error ?? tasks.error;
  const target = tasks.data?.find(t => t.id === link.onboarding_task_id);
  if (!home.data || !project.data || !target) return;
  if (!breezewayCompletionAllowed(home.data as StateProperty, project.data as StateProject, (tasks.data ?? []) as WorkflowTask[], target.id, captures)) return;
  // Pending approval-only SQL provides row locks, compare-and-save and atomic history. No fallback row update.
  const rpc = db.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ error: { code?: string; message: string } | null }>;
  const result = await rpc("complete_onboarding_from_breezeway", {
    _link_id: link.id, _breezeway_task_id: input.id, _property_id: input.propertyId,
    _status: input.stage ?? input.status, _task_updated_at: target.updated_at,
    _property_updated_at: home.data.updated_at, _project_updated_at: project.data.updated_at,
    _breezeway_updated_at: input.updatedAt,
  });
  if (result.error) throw new Error(`Breezeway Task completion was not saved: ${result.error.code ?? "error"}`);
}