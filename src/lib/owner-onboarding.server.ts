/**
 * Onboarding as the homeowner sees it (server-only).
 *
 * Two things: the onboarding items waiting on a decision from them, each with
 * the files staff explicitly shared, and a counts-only view of how the four
 * onboarding tracks are progressing at their homes.
 *
 * No new decision path. An item is only actionable through the existing
 * single-shot approval record, which staff must have reviewed and published
 * first. Everything here is read-only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { loadOwnerApprovals } from "./owner-approval.server";
import { ownerPropertyAccess } from "./owner-property-access.server";
import { ownerTrackProgress, type OwnerTaskRow, type OwnerTrackProgress } from "./owner-onboarding";

type Client = SupabaseClient<Database>;

/** An existing participation opportunity the homeowner may log time against. */
export type OwnerParticipationAnchor = {
  reviewId: string;
  phase: string;
  ticketId: string | null;
  propertyIds: string[];
  title: string;
};

export type OwnerOnboardingFile = {
  id: string;
  title: string;
  filename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  kind: string;
};

export type OwnerOnboardingAction = {
  approvalId: string;
  title: string;
  detail: string | null;
  propertyId: string | null;
  propertyName: string | null;
  dueOn: string | null;
  status: string;
  updatedAt: string;
  publicationId: string | null;
  canRespond: boolean;
  blockedReason: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
  files: OwnerOnboardingFile[];
  /**
   * The existing participation opportunity for this onboarding task, when
   * staff offered one. Its presence is what lets the homeowner log the time
   * they spent right after deciding. Never created here.
   */
  participation: OwnerParticipationAnchor | null;
};

export type OwnerOnboardingHome = {
  propertyId: string;
  name: string;
  /** Target handoff date (YYYY-MM-DD) when one has been set. */
  targetGoLive: string | null;
  /** Owner-friendly current status from the live Onboarding Project. */
  statusLabel: string;
  tracks: OwnerTrackProgress[];
  done: number;
  total: number;
  percent: number;
};

export type OwnerOnboardingView = {
  inOnboarding: boolean;
  preview: boolean;
  /** The homeowner's own program, so time can be logged from here. */
  programId: string | null;
  pending: OwnerOnboardingAction[];
  decided: OwnerOnboardingAction[];
  homes: OwnerOnboardingHome[];
};

const EMPTY: OwnerOnboardingView = {
  inOnboarding: false,
  preview: false,
  programId: null,
  pending: [],
  decided: [],
  homes: [],
};

const ACTIVE_PROJECT = ["cancelled", "complete", "completed", "handed_off"];

/** Homes on a program, filtered to the ones the caller may actually reach. */
async function programProperties(admin: Client, programId: string, userId: string | null) {
  const { data, error } = await admin
    .from("owner_program_properties")
    .select("property_id, inclusion_status, archived_at")
    .eq("program_id", programId);
  if (error) throw error;
  const candidates = [
    ...new Set(
      (data ?? [])
        .filter((r) => r.inclusion_status === "included" && r.archived_at == null)
        .map((r) => r.property_id as string),
    ),
  ];
  if (!userId) return candidates;
  const allowed = await Promise.all(
    candidates.map((id) => ownerPropertyAccess(admin, userId, id)),
  );
  return candidates.filter((_, i) => allowed[i]);
}

/** Counts-only track progress for every listed home still in onboarding. */
async function onboardingProgress(admin: Client, propertyIds: string[]) {
  if (propertyIds.length === 0) return [];
  const projects = await admin
    .from("onboarding_projects")
    .select("property_id, status, target_handoff_on")
    .in("property_id", propertyIds);
  if (projects.error) throw projects.error;
  const active = [
    ...new Set(
      (projects.data ?? [])
        .filter((p) => !ACTIVE_PROJECT.includes(p.status ?? ""))
        .map((p) => p.property_id as string),
    ),
  ];
  if (active.length === 0) return [];

  const [tasks, props] = await Promise.all([
    admin
      .from("onboarding_tasks")
      .select("property_id, title, stage, status, archived_at")
      .in("property_id", active),
    admin.from("properties").select("id, name, nickname").in("id", active),
  ]);
  if (tasks.error) throw tasks.error;
  if (props.error) throw props.error;

  const homes: OwnerOnboardingHome[] = [];
  for (const id of active) {
    const rows: OwnerTaskRow[] = (tasks.data ?? [])
      .filter((t) => t.property_id === id && t.archived_at == null)
      .map((t) => ({ title: t.title ?? "", stage: t.stage ?? "", status: t.status ?? "" }));
    if (rows.length === 0) continue;
    const property = (props.data ?? []).find((p) => p.id === id);
    const progress = ownerTrackProgress(rows);
    const project = (projects.data ?? []).find((p) => p.property_id === id);
    homes.push({
      propertyId: id,
      name: property?.nickname || property?.name || "Your home",
      targetGoLive: (project?.target_handoff_on as string | null) ?? null,
      statusLabel: "Onboarding",
      ...progress,
    });
  }
  return homes;
}

/** Files staff explicitly shared with the homeowner, per onboarding task. */
async function sharedFiles(admin: Client, taskIds: string[], demoAllowed: boolean) {
  if (taskIds.length === 0) return new Map<string, OwnerOnboardingFile[]>();
  const query = admin
    .from("documents")
    .select(
      "id, title, original_filename, mime_type, size_bytes, kind, entity_id, is_demo, upload_status, visibility, archived_at, deleted_at",
    )
    .eq("entity_type", "onboarding_task")
    .in("entity_id", taskIds)
    .eq("visibility", "owner_shared")
    .eq("upload_status", "stored")
    .is("deleted_at", null)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  const { data, error } = demoAllowed ? await query : await query.eq("is_demo", false);
  if (error) throw error;

  const byTask = new Map<string, OwnerOnboardingFile[]>();
  for (const row of data ?? []) {
    const list = byTask.get(row.entity_id as string) ?? [];
    list.push({
      id: row.id as string,
      title: (row.title as string) ?? "Shared file",
      filename: (row.original_filename as string | null) ?? null,
      mimeType: (row.mime_type as string | null) ?? null,
      sizeBytes: (row.size_bytes as number | null) ?? null,
      kind: (row.kind as string) ?? "document",
    });
    byTask.set(row.entity_id as string, list);
  }
  return byTask;
}

/**
 * Participation opportunities staff already offered for these onboarding
 * tasks. Read-only: nothing is created here, so a homeowner can only log
 * time where ARHA opened an opportunity.
 */
async function participationByTask(admin: Client, programId: string, taskIds: string[]) {
  const map = new Map<string, OwnerParticipationAnchor>();
  if (taskIds.length === 0) return map;
  const { data, error } = await admin
    .from("owner_reviews")
    .select("id, title, phase, ticket_id, property_id, status, archived_at, onboarding_task_id")
    .eq("program_id", programId)
    .in("onboarding_task_id", taskIds)
    .is("archived_at", null);
  if (error) throw error;
  for (const row of data ?? []) {
    const taskId = row.onboarding_task_id as string | null;
    if (!taskId) continue;
    if (!["awaiting_owner", "answered", "returned"].includes((row.status as string) ?? "")) continue;
    map.set(taskId, {
      reviewId: row.id as string,
      phase: (row.phase as string) ?? "onboarding",
      ticketId: (row.ticket_id as string | null) ?? null,
      propertyIds: row.property_id ? [row.property_id as string] : [],
      title: (row.title as string) ?? "Onboarding participation",
    });
  }
  return map;
}

/** Maps each approval id to the onboarding task it belongs to. */
async function taskIdsFor(admin: Client, approvalIds: string[]) {
  if (approvalIds.length === 0) return new Map<string, string>();
  const { data, error } = await admin
    .from("approvals")
    .select("id, entity_id, entity_type")
    .in("id", approvalIds);
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.entity_type === "onboarding_task") map.set(row.id as string, row.entity_id as string);
  }
  return map;
}

function splitDecided(actions: OwnerOnboardingAction[]) {
  return {
    pending: actions.filter((a) => a.status === "pending"),
    decided: actions
      .filter((a) => a.status !== "pending")
      .slice(0, 6),
  };
}

/** The signed-in homeowner's own onboarding view. */
export async function loadOwnerOnboarding(
  supabase: Client,
  userId: string,
  admin: Client,
  programId: string | null,
): Promise<OwnerOnboardingView> {
  if (!programId) return EMPTY;
  const propertyIds = await programProperties(admin, programId, userId);
  const homes = await onboardingProgress(admin, propertyIds);

  const allApprovals = (await loadOwnerApprovals(supabase, userId)).filter(
    (a) => a.entity_type === "onboarding_task",
  );
  const allTaskByApproval = await taskIdsFor(
    admin,
    allApprovals.map((a) => a.id),
  );
  // Draft privacy: a Task whose ARHA Owner Collaboration Opportunity is still
  // a Draft is internal to ARHA. No other path may surface it to the owner.
  const draftTasks = new Set<string>();
  const candidateTasks = [...new Set(allTaskByApproval.values())];
  if (candidateTasks.length) {
    const drafts = await admin
      .from("work_items")
      .select("source_task_id")
      .eq("kind", "opportunity")
      .eq("source", "arha")
      .eq("status", "draft")
      .in("source_task_id", candidateTasks);
    if (drafts.error) throw drafts.error;
    for (const d of drafts.data ?? []) if (d.source_task_id) draftTasks.add(d.source_task_id as string);
  }
  // Publication guardrail: owners only see approvals ARHA intentionally published.
  const approvals = allApprovals.filter(
    (a) => a.publication_id != null && !draftTasks.has(allTaskByApproval.get(a.id) ?? ""),
  );
  const taskByApproval = allTaskByApproval;
  const taskIds = [...new Set(taskByApproval.values())];
  const files = await sharedFiles(admin, taskIds, false);
  const participation = await participationByTask(admin, programId, taskIds);

  const actions: OwnerOnboardingAction[] = approvals.map((a) => ({
    approvalId: a.id,
    title: a.title,
    detail: a.detail,
    propertyId: a.property_id,
    propertyName: a.property_name,
    dueOn: a.due_on,
    status: a.status,
    updatedAt: a.updated_at,
    publicationId: a.publication_id,
    canRespond: a.can_respond,
    blockedReason: a.blocked_reason,
    decisionNote: a.decision_note,
    decidedAt: a.decided_at,
    createdAt: a.created_at,
    files: files.get(taskByApproval.get(a.id) ?? "") ?? [],
    participation: participation.get(taskByApproval.get(a.id) ?? "") ?? null,
  }));

  return {
    inOnboarding: homes.length > 0 || actions.length > 0,
    preview: false,
    programId,
    ...splitDecided(actions),
    homes,
  };
}

/**
 * Read-only walk-through of one homeowner's onboarding view for staff.
 * Decisions are never possible here — this is the same wall the rest of the
 * preview uses, and demo approvals are deliberately not decidable at all.
 */
export async function loadOwnerOnboardingPreview(
  supabase: Client,
  userId: string,
  programId: string,
): Promise<OwnerOnboardingView> {
  const { assertAdmin } = await import("./access.server");
  await assertAdmin(supabase, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as Client;

  const propertyIds = await programProperties(admin, programId, null);
  const homes = await onboardingProgress(admin, propertyIds);
  if (propertyIds.length === 0) return { ...EMPTY, preview: true };

  const { data, error } = await admin
    .from("approvals")
    .select(
      "id, entity_id, entity_type, title, detail, status, due_on, updated_at, created_at, decision_note, decided_at, property_id, approver_role",
    )
    .eq("entity_type", "onboarding_task")
    .eq("approver_role", "owner")
    .in("property_id", propertyIds)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = data ?? [];
  const publications = await admin
    .from("owner_approval_publications")
    .select("approval_id, title, detail, revision")
    .in(
      "approval_id",
      rows.map((r) => r.id as string),
    )
    .order("revision", { ascending: false });
  if (publications.error) throw publications.error;

  const names = await admin
    .from("properties")
    .select("id, name, nickname")
    .in("id", propertyIds);
  if (names.error) throw names.error;

  const files = await sharedFiles(
    admin,
    rows.map((r) => r.entity_id as string),
    true,
  );

  const actions: OwnerOnboardingAction[] = rows.map((r) => {
    const published = (publications.data ?? []).find((p) => p.approval_id === r.id);
    const property = (names.data ?? []).find((p) => p.id === r.property_id);
    return {
      approvalId: r.id as string,
      title: published?.title ?? (r.title as string) ?? "Onboarding decision",
      detail: published?.detail ?? (r.detail as string | null) ?? null,
      propertyId: (r.property_id as string | null) ?? null,
      propertyName: property?.nickname || property?.name || null,
      dueOn: (r.due_on as string | null) ?? null,
      status: (r.status as string) ?? "pending",
      updatedAt: (r.updated_at as string) ?? (r.created_at as string),
      publicationId: null,
      canRespond: false,
      blockedReason: "Preview only — decisions are disabled in the staff walk-through.",
      decisionNote: (r.decision_note as string | null) ?? null,
      decidedAt: (r.decided_at as string | null) ?? null,
      createdAt: (r.created_at as string) ?? new Date().toISOString(),
      files: files.get(r.entity_id as string) ?? [],
      // Staff previews never log an owner's time.
      participation: null,
    };
  });

  return {
    inOnboarding: homes.length > 0 || actions.length > 0,
    preview: true,
    programId,
    ...splitDecided(actions),
    homes,
  };
}
