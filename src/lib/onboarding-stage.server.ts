import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { assertOnboardingStageAccess } from "./onboarding-review-access.server";
import {
  nextStageCapture,
  stageCompletionBlockers,
  type StageAction,
  type StageCapture,
} from "./onboarding-stage";

type Client = SupabaseClient<Database>;

/** Public reads use the same property responsibility boundary as stage writes. */
export async function loadStageCapturesForActor(db: Client, userId: string, propertyId: string) {
  await assertOnboardingStageAccess(db, userId, propertyId);
  return loadStageCaptures(db, propertyId);
}

export async function loadStageCaptures(db: Client, propertyId: string) {
  const project = await db
    .from("onboarding_projects")
    .select("id")
    .eq("property_id", propertyId)
    .neq("status", "cancelled")
    .maybeSingle();
  if (project.error) throw project.error;
  if (!project.data) return [];
  const { data, error } = await db
    .from("onboarding_project_events")
    .select("id, kind, new_value, actor, created_at")
    .eq("project_id", project.data.id)
    .like("kind", "stage_capture:%")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((event) => ({
    id: event.id,
    ...(JSON.parse(event.new_value!) as StageCapture),
  }));
}

export async function saveStageCapture(
  db: Client,
  userId: string,
  input: {
    propertyId: string;
    stage: string;
    expectedRevision: number;
    action: StageAction;
    observation: string;
    evidenceIds: string[];
    reason: string;
  },
  writer?: Pick<Client, "rpc">,
) {
  const capabilities = await assertOnboardingStageAccess(
    db,
    userId,
    input.propertyId,
    input.action,
  );
  const [project, tasks, captures, property, facts, evidence] = await Promise.all([
    db
      .from("onboarding_projects")
      .select("*")
      .eq("property_id", input.propertyId)
      .neq("status", "cancelled")
      .single(),
    db
      .from("onboarding_tasks")
      .select("*")
      .eq("property_id", input.propertyId)
      .is("archived_at", null)
      .order("id"),
    loadStageCaptures(db, input.propertyId),
    db
      .from("properties")
      .select("lifecycle_status, handoff_accepted_at")
      .eq("id", input.propertyId)
      .single(),
    db
      .from("property_fact_proposals")
      .select("id")
      .eq("property_id", input.propertyId)
      .eq("status", "pending"),
    db
      .from("documents")
      .select("id, entity_type, entity_id, is_demo, storage_path, external_url")
      .in(
        "id",
        input.evidenceIds.length ? input.evidenceIds : ["00000000-0000-0000-0000-000000000000"],
      )
      .is("archived_at", null)
      .is("deleted_at", null)
      .eq("upload_status", "stored"),
  ]);
  for (const result of [project, tasks, property, facts, evidence])
    if (result.error) throw result.error;
  if (!project.data || !property.data)
    throw new Error("Start onboarding before capturing a stage.");
  if (
    property.data.handoff_accepted_at ||
    ["active_operations", "handoff_requested"].includes(property.data.lifecycle_status ?? "")
  )
    throw new Error(
      "The onboarding plan is locked for handoff. Record post-handoff work through Operations.",
    );
  const stageTasks = (tasks.data ?? []).filter((t) => t.stage === input.stage);
  const validEvidence = (evidence.data ?? []).filter(
    (d) =>
      d.is_demo === project.data.is_demo &&
      Boolean(d.storage_path?.trim() || d.external_url?.trim()) &&
      ((d.entity_type === "property" && d.entity_id === input.propertyId) ||
        (d.entity_type === "onboarding_task" && stageTasks.some((t) => t.id === d.entity_id))),
  );
  if (
    !["return", "reopen"].includes(input.action) &&
    input.evidenceIds.some((id) => !validEvidence.some((d) => d.id === id))
  )
    throw new Error(
      "Evidence must be stored, available, and belong to this property or stage work.",
    );
  const blockers = stageCompletionBlockers(input.stage, tasks.data ?? [], project.data);
  if (facts.data?.length) blockers.push("Permanent property facts await review");
  const current =
    captures.filter((c) => c.stage === input.stage).sort((a, b) => b.revision - a.revision)[0] ??
    null;
  const capture = nextStageCapture({
    ...input,
    current,
    actor: userId,
    canReview: capabilities.can_review_stages,
    blockers,
    now: new Date().toISOString(),
  });
  // Only the trusted server can append this event kind; the RPC compares the
  // complete task snapshot and revision in one transaction before recording.
  const persistence =
    writer ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  const { error } = await persistence.rpc("record_onboarding_stage_capture", {
    _project_id: project.data.id,
    _actor: userId,
    _expected_revision: input.expectedRevision,
    _capture: capture as unknown as Json,
    _tasks: stageTasks as unknown as Json,
    _scope: {
      modules: project.data.modules,
      furnishing_scope: project.data.furnishing_scope,
      director: project.data.director,
    },
  });
  if (error) throw error;
  return capture;
}
