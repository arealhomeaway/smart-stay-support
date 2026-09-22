/**
 * Assessment findings — server side.
 *
 * Recording a finding is the only write here. The correction task is created by
 * the database trigger, not by this module, so a finding can never exist without
 * its tracked task and a retry cannot produce a second one (the finding key is
 * unique per home).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { findingKey, type AssessmentFinding } from "./assessment-findings";

type Client = SupabaseClient<Database>;

async function assertStaff(db: Client, userId: string) {
  const { data, error } = await db.rpc("is_internal_staff", { _user_id: userId });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("Only Resolve staff can record assessment findings.");
}

const FIELDS =
  "id, property_id, context, category, title, detail, location, severity, photo_url, status, correction_task_id, created_at";

export async function loadFindings(db: Client, userId: string, propertyId: string) {
  await assertStaff(db, userId);
  const { data, error } = await db
    .from("assessment_findings")
    .select(FIELDS)
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as AssessmentFinding[];
  const taskIds = rows.map((r) => r.correction_task_id).filter((id): id is string => Boolean(id));
  let tasks: { id: string; title: string; status: string; due_on: string | null }[] = [];
  if (taskIds.length) {
    const { data: taskRows, error: taskError } = await db
      .from("onboarding_tasks")
      .select("id, title, status, due_on")
      .in("id", taskIds);
    if (taskError) throw taskError;
    tasks = taskRows ?? [];
  }
  return { findings: rows, tasks };
}

export type RecordFindingInput = {
  propertyId: string;
  sourceTaskId: string | null;
  context: string;
  category: string;
  title: string;
  detail: string | null;
  location: string | null;
  severity: string;
  photoUrl: string | null;
};

export async function recordFinding(db: Client, userId: string, input: RecordFindingInput) {
  await assertStaff(db, userId);

  const key = findingKey({
    context: input.context,
    category: input.category,
    title: input.title,
    location: input.location,
  });

  const { data: existing, error: existingError } = await db
    .from("assessment_findings")
    .select("id, correction_task_id")
    .eq("property_id", input.propertyId)
    .eq("finding_key", key)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    return { id: existing.id, correctionTaskId: existing.correction_task_id, duplicate: true as const };
  }

  const { data: project } = await db
    .from("onboarding_projects")
    .select("id, is_demo")
    .eq("property_id", input.propertyId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await db
    .from("assessment_findings")
    .insert({
      property_id: input.propertyId,
      project_id: project?.id ?? null,
      source_task_id: input.sourceTaskId,
      context: input.context,
      category: input.category,
      title: input.title,
      detail: input.detail,
      location: input.location,
      severity: input.severity,
      photo_url: input.photoUrl,
      finding_key: key,
      is_demo: project?.is_demo ?? false,
      created_by: userId,
    })
    .select("id, correction_task_id")
    .single();
  if (error) throw error;

  return { id: data.id, correctionTaskId: data.correction_task_id, duplicate: false as const };
}

export async function setFindingStatus(
  db: Client,
  userId: string,
  input: { findingId: string; status: "open" | "corrected" | "dismissed" },
) {
  await assertStaff(db, userId);
  const { error } = await db
    .from("assessment_findings")
    .update({ status: input.status })
    .eq("id", input.findingId);
  if (error) throw error;
  return { ok: true as const };
}
