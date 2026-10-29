/**
 * Onboarding lifecycle + controlled handoff (server-only).
 *
 * Onboarding runs on the EXISTING property record and its immutable Property
 * ID. Pre-handoff work lives in `onboarding_tasks` so it can never be confused
 * with an operational ticket, and nothing is silently converted or reset: open
 * items either block the handoff or are accepted as carryover with an owner,
 * a due date and a reason.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { validateHandoff } from "./onboarding";
import { lifecycleEditIssue } from "./onboarding-state";
import { projectScope, splitByScope } from "./onboarding-scope";
export { validateHandoff };
import {
  onboardingTaskAccess,
  assertAssignedTaskPatch,
  assertOnboardingPropertyManagement,
} from "./onboarding-task-access.server";
import { assignedWorkContext, type AssignedWorkContext } from "./onboarding-assigned-context";
import { onboardingWorkspaceMode } from "./onboarding-workspace-view";
import { writeAudit } from "./audit.server";
import { readCountedRows } from "./read-all-rows";
import {
  assertOnboardingStageAccess,
  readOnboardingReviewCapabilities,
} from "./onboarding-review-access.server";
import type { IndependentReadiness } from "./onboarding-independent-readiness";
import { hasOnboardingReview } from "./onboarding-review-capabilities";
import {
  prepareOnboardingHandoff,
  type OnboardingHandoffSnapshot,
} from "./onboarding-handoff-readiness";

type Client = SupabaseClient<Database>;

const PROPERTY_FIELDS =
  "id, name, nickname, address_line1, unit, city, state, postal_code, ownerrez_property_id, latitude, longitude, access_notes, wifi_notes, lifecycle_status, onboarding_stage, onboarding_owner, onboarding_started_at, planned_closing_on, actual_closing_on, actual_access_on, handoff_accepted_at, quarterly_review_due_on, active, is_demo, primary_photo_url, primary_photo_thumb_url, primary_photo_source";

async function assertCap(
  supabase: Client,
  userId: string,
  fn: "is_onboarding_leader" | "is_onboarding_staff",
) {
  const { data, error } = await supabase.rpc(fn, { _user_id: userId });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("You do not have access to this action.");
}

export async function loadOnboardingWorkspace(
  supabase: Client,
  userId: string,
  propertyId?: string,
) {
  await assertCap(supabase, userId, "is_onboarding_staff");
  // One home's workspace reads only that home's rows; portfolio views read all.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const only = <Q,>(q: Q, column: string): Q => (propertyId ? (q as any).eq(column, propertyId) : q);
  const [props, tasks, handoffs, people, notes, reviews, extDbs, extRecords, docs] =
    await Promise.all([
      readCountedRows(only(
        supabase
          .from("properties")
          .select(PROPERTY_FIELDS, { count: "exact" })
          .order("name")
          .order("id"), "id")),
      readCountedRows(only(
        supabase
          .from("onboarding_tasks")
          .select("*", { count: "exact" })
          .is("archived_at", null)
          .order("sort_order")
          .order("id"), "property_id")),
      readCountedRows(only(
        supabase
          .from("property_handoffs")
          .select("*", { count: "exact" })
          .is("archived_at", null)
          .order("requested_at", { ascending: false })
          .order("id"), "property_id")),
      readCountedRows(
        supabase
          .from("profiles")
          .select("id, full_name, email", { count: "exact" })
          .order("full_name")
          .order("id"),
      ),
      readCountedRows(only(
        supabase
          .from("onboarding_notes")
          .select("*", { count: "exact" })
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .order("id"), "property_id")),
      readCountedRows(only(
        supabase
          .from("handoff_reviews")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false })
          .order("id"), "property_id")),
      readCountedRows(
        supabase
          .from("external_databases")
          .select("*", { count: "exact" })
          .is("archived_at", null)
          .order("label")
          .order("id"),
      ),
      readCountedRows(only(
        supabase
          .from("external_records")
          .select("*", { count: "exact" })
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .order("id"), "property_id")),
      readCountedRows(only(
        supabase
          .from("documents")
          .select(
            "id, entity_type, entity_id, title, kind, external_url, required, note, created_at",
            { count: "exact" },
          )
          .eq("entity_type", "property")
          .is("archived_at", null)
          .order("id"), "entity_id")),
    ]);
  if (props.error) throw props.error;
  if (tasks.error) throw tasks.error;
  if (handoffs.error) throw handoffs.error;

  const lifecycleOf = (p: (typeof props.data)[number]) => p.lifecycle_status ?? "active_operations";
  const inPipeline = (props.data ?? []).filter(
    (p) => lifecycleOf(p) !== "active_operations" && lifecycleOf(p) !== "offboarded",
  );

  // Homeowner decisions and their history — staff read-only.
  const ownerApprovals = await readCountedRows(only(
    supabase
      .from("approvals")
      .select(
        "id, entity_type, entity_id, property_id, kind, title, detail, status, decision_note, decided_at, approver_id, due_on, created_at",
        { count: "exact" },
      )
      .eq("approver_role", "owner")
      .order("created_at", { ascending: false })
      .order("id"), "property_id"));

  // Active Owner Program participation, per owner/property relationship.
  const { activeOwnerLinks } = await import("./active-owner.server");
  const { FULL_FURNISHING_TEMPLATE } = await import("./onboarding-template");
  const participation = await activeOwnerLinks(
    supabase,
    (props.data ?? []).map((p) => p.id),
  );
  const conditionalTitles = new Set(
    FULL_FURNISHING_TEMPLATE.filter((t) => t.ownerApprovalWhenActiveOwner).map((t) =>
      t.title.trim().toLowerCase(),
    ),
  );
  // Participation can change after tasks exist. Surface the affected steps for
  // staff confirmation instead of silently adding or waiving an approval.
  const approvalMismatches = (tasks.data ?? [])
    .filter((t) => conditionalTitles.has(t.title.trim().toLowerCase()))
    .filter((t) => t.owner_approval_status !== "approved")
    .map((t) => ({
      taskId: t.id,
      propertyId: t.property_id,
      title: t.title,
      requiresNow: Boolean(t.requires_owner_approval),
      shouldRequire: participation.has(t.property_id),
    }))
    .filter((m) => m.requiresNow !== m.shouldRequire);

  // Onboarding Projects: scope, accountable people and dates for the homes
  // where onboarding has actually been started.
  const { loadProjects } = await import("./onboarding-project.server");
  const projects = await loadProjects(supabase);
  // Property → Project → Project Team → Role → Person. A Task carrying only a
  // role resolves to the person the project team names for that role, so
  // My Tasks and every list show a real name. No global pool fallback.
  const roleHolder = (propertyIdForTask: string, seat: string | null): string | null => {
    const project = projects.find(
      (p) => p.property_id === propertyIdForTask && p.status !== "cancelled",
    ) as
      | (typeof projects)[number] & {
          utility_manager?: string | null;
          role_assignments?: Record<string, string> | null;
        }
      | undefined;
    if (!project || !seat) return null;
    if (seat === "onboarding_project_manager" || seat === "project_manager")
      return project.project_manager ?? null;
    if (seat === "onboarding_director" || seat === "director_onboarding")
      return project.director ?? null;
    if (seat === "utilities") return project.utility_manager ?? null;
    const assigned = project.role_assignments?.[seat];
    return typeof assigned === "string" && assigned ? assigned : null;
  };
  if (tasks.data)
    tasks.data = tasks.data.map((t) =>
      t.assigned_to || t.status === "complete"
        ? t
        : { ...t, assigned_to: roleHolder(t.property_id, t.assigned_seat) },
    );
  // Department-wide view: leadership or the Onboarding Director seat.
  const supervisor = await supabase.rpc("is_onboarding_leader", { _user_id: userId });
  if (supervisor.error) throw new Error("Could not verify your workspace view.");
  const reviewCapabilities = await readOnboardingReviewCapabilities(supabase);
  const workspaceMode = onboardingWorkspaceMode(
    userId,
    Boolean(supervisor.data) || hasOnboardingReview(reviewCapabilities),
    projects,
  );
  const stageEvents = await readCountedRows(only(
    supabase
      .from("onboarding_stage_captures")
      .select("project_id, property_id, new_value", { count: "exact" })
      .order("project_id")
      .order("new_value"), "property_id"));
  if (stageEvents.error) throw stageEvents.error;
  const stageCaptures = (stageEvents.data ?? [])
    .map((e) => ({
      ...(JSON.parse(e.new_value!) as import("./onboarding-stage").StageCapture),
      projectId: e.project_id,
      propertyId: e.property_id,
    }))
    .filter((c) => projects.some((p) => p.id === c.projectId && p.status !== "cancelled"));

  const independentResult = await supabase.rpc("read_onboarding_independent_readiness", {
    _property_ids: projects
      .filter((project) => project.status !== "cancelled")
      .filter((project) => !propertyId || project.property_id === propertyId)
      .map((project) => project.property_id),
  });
  if (independentResult.error || !Array.isArray(independentResult.data))
    throw new Error(
      "Could not verify financial and field readiness. Refresh before reviewing handoff.",
    );
  const independentReadiness = independentResult.data as unknown as IndependentReadiness[];
  // Permission roles ride along so assignment pickers can show only the people
  // who can actually work onboarding.
  const roleRows = await readCountedRows(
    supabase
      .from("user_roles")
      .select("user_id, role", { count: "exact" })
      .order("user_id")
      .order("id"),
  );
  if (roleRows.error) throw roleRows.error;
  const rolesByUser = new Map<string, string[]>();
  for (const row of roleRows.data ?? []) {
    rolesByUser.set(row.user_id, [...(rolesByUser.get(row.user_id) ?? []), row.role as string]);
  }
  const peopleWithRoles = (people.data ?? []).map((person) => ({
    ...person,
    roles: rolesByUser.get(person.id) ?? [],
  }));
  const retired = propertyId
    ? await supabase
        .from("onboarding_tasks")
        .select("id, title, stage, assigned_seat, archived_at, exception_reason")
        .eq("property_id", propertyId)
        .not("archived_at", "is", null)
        .not("exception_reason", "is", null)
        .order("archived_at", { ascending: false })
        .limit(500)
    : { data: [] as never[] };
  const workspace = {
    retiredTasks: (retired.data ?? []) as {
      id: string;
      title: string;
      stage: string;
      assigned_seat: string | null;
      archived_at: string;
      exception_reason: string | null;
    }[],
    workspaceMode,
    reviewCapabilities,
    independentReadiness,
    assignedWorkContexts: [] as AssignedWorkContext[],
    properties: (props.data ?? []).map(p => ({ ...p, listing_name: p.name, name: formatPropertyLabel(p).primary })),
    pipeline: inPipeline.map((p) => p.id),
    projects,
    stageCaptures,
    tasks: tasks.data ?? [],
    activeOwnerProperties: [...participation.values()],
    approvalMismatches,
    handoffs: handoffs.data ?? [],
    people: peopleWithRoles,
    notes: notes.data ?? [],
    reviews: reviews.data ?? [],
    externalDatabases: extDbs.data ?? [],
    externalRecords: extRecords.data ?? [],
    documents: docs.data ?? [],
    ownerApprovals: ownerApprovals.data ?? [],
  };
  if (workspaceMode === "portfolio") return workspace;
  const managed = new Set(
    projects
      .filter(
        (project) =>
          project.status !== "cancelled" &&
          (project.project_manager === userId || project.director === userId),
      )
      .map((project) => project.property_id),
  );
  const assigned = workspace.tasks.filter(
    (task) => task.assigned_to === userId && !managed.has(task.property_id),
  );
  const propertyIds = new Set(assigned.map((task) => task.property_id));
  const contexts = workspace.properties
    .filter((property) => propertyIds.has(property.id))
    .map((property) =>
      assignedWorkContext(
        {
          property,
          project:
            projects.find(
              (project) => project.property_id === property.id && project.status !== "cancelled",
            ) ?? null,
          tasks: workspace.tasks.filter((task) => task.property_id === property.id),
          handoff:
            workspace.handoffs.find(
              (handoff) =>
                handoff.property_id === property.id &&
                ["requested", "accepted_pending_live"].includes(handoff.status),
            ) ?? null,
          stageCaptures: workspace.stageCaptures.filter(
            (capture) => capture.propertyId === property.id,
          ),
        },
        userId,
      ),
    );
  const inScope = new Set(contexts.flatMap((context) => context.tasks.map((task) => task.id)));
  const visibleTasks = assigned.filter((task) => inScope.has(task.id));
  const visibleIds = new Set(visibleTasks.map((task) => task.id));
  const managedRecord = (row: { property_id: string | null }) =>
    Boolean(row.property_id && managed.has(row.property_id));
  const visibleHandoffs = workspace.handoffs.filter(managedRecord);
  const handoffIds = new Set(visibleHandoffs.map((handoff) => handoff.id));
  const externalRecords = workspace.externalRecords.filter(managedRecord);
  const databaseKeys = new Set(externalRecords.map((record) => record.database_key));
  return {
    ...workspace,
    assignedWorkContexts: contexts,
    tasks: [...workspace.tasks.filter(managedRecord), ...visibleTasks],
    properties: workspace.properties
      .filter((property) => managed.has(property.id) || propertyIds.has(property.id))
      .map((property) =>
        managed.has(property.id) ? property : { ...property, access_notes: null, wifi_notes: null },
      ),
    projects: projects.filter(managedRecord),
    pipeline: workspace.pipeline.filter((id) => managed.has(id)),
    stageCaptures: workspace.stageCaptures.filter((capture) =>
      managed.has(capture.propertyId ?? ""),
    ),
    handoffs: visibleHandoffs,
    independentReadiness: workspace.independentReadiness.filter((row) =>
      managed.has(row.propertyId ?? ""),
    ),
    notes: workspace.notes.filter(managedRecord),
    reviews: workspace.reviews.filter(
      (review) => managedRecord(review) && handoffIds.has(review.handoff_id),
    ),
    externalDatabases: workspace.externalDatabases.filter((database) =>
      databaseKeys.has(database.key),
    ),
    externalRecords,
    documents: workspace.documents.filter(
      (document) => document.entity_id && managed.has(document.entity_id),
    ),
    activeOwnerProperties: workspace.activeOwnerProperties.filter((link) =>
      managed.has(link.propertyId),
    ),
    approvalMismatches: workspace.approvalMismatches.filter((mismatch) =>
      managed.has(mismatch.propertyId),
    ),
    // Leads need the existing staff directory to assign work on their projects.
    people:
      workspaceMode === "projects"
        ? workspace.people
        : workspace.people.filter((person) => person.id === userId),
    ownerApprovals: workspace.ownerApprovals.filter(
      (approval) =>
        managedRecord(approval) ||
        (approval.entity_type === "onboarding_task" && visibleIds.has(approval.entity_id ?? "")),
    ),
  };
}

export async function saveOnboardingTask(
  supabase: Client,
  userId: string,
  input: {
    id?: string | undefined;
    propertyId: string;
    stage: string;
    title: string;
    detail: string;
    assignedTo: string | null;
    dueOn: string | null;
    blocker: string;
    requiresOwnerApproval: boolean;
    ownerApprovalStatus: string;
    evidenceRequired: boolean;
    evidenceNote: string;
    status: string;
    blocksHandoff: boolean;
    parentTaskId?: string | null | undefined;
    dependsOn?: string[] | undefined;
    sortOrder?: number | undefined;
    linkedTicketId?: string | null | undefined;
  },
) {
  await assertCap(supabase, userId, "is_onboarding_staff");
  // Adding work to a plan is a director decision; project managers work the
  // plan they are given and may still edit existing steps.
  if (!input.id) await assertCap(supabase, userId, "is_onboarding_leader");
  if (!input.id && input.status === "complete") {
    throw new Error("Create the step first, then complete it after its readiness checks.");
  }
  const { loadStageCaptures } = await import("./onboarding-stage.server");
  const captures = await loadStageCaptures(supabase, input.propertyId);
  const latestCapture = captures
    .filter((c) => c.stage === input.stage)
    .sort((a, b) => b.revision - a.revision)[0];
  if (latestCapture && ["complete", "awaiting_review"].includes(latestCapture.status)) {
    throw new Error("Return or reopen this stage before changing its work.");
  }
  const prior = input.id
    ? await supabase
        .from("onboarding_tasks")
        .select("*")
        .eq("id", input.id)
        .eq("property_id", input.propertyId)
        .single()
    : null;
  if (prior?.error) throw prior.error;
  if (prior?.data && (input.dueOn ?? null) !== prior.data.due_on)
    throw new Error("Use the date override action and record a reason.");
  const access = await onboardingTaskAccess(
    supabase,
    userId,
    input.propertyId,
    prior?.data.assigned_to ?? null,
  );
  if (
    prior?.data &&
    (input.ownerApprovalStatus !== prior.data.owner_approval_status ||
      input.requiresOwnerApproval !== prior.data.requires_owner_approval)
  ) {
    throw new Error(
      "Use the owner decision or approval-requirement workflow to change an approval.",
    );
  }
  const priorStage = captures
    .filter((c) => c.stage === prior?.data.stage)
    .sort((a, b) => b.revision - a.revision)[0];
  if (priorStage && ["complete", "awaiting_review"].includes(priorStage.status))
    throw new Error("Return or reopen the original stage before moving its work.");
  if (prior?.data.status === "complete")
    throw new Error("Reopen the completed step with a reason before editing it.");
  // Locked handoff: once Operations accepts the home, the onboarding plan is
  // history. Anything found afterwards is a correction (reopen with a reason)
  // or an Operations ticket — never a silent edit to a finished project.
  const accepted = await supabase
    .from("properties")
    .select("handoff_accepted_at, lifecycle_status")
    .eq("id", input.propertyId)
    .maybeSingle();
  if (accepted.error) throw accepted.error;
  if (
    accepted.data?.handoff_accepted_at ||
    ["handoff_requested", "active_operations"].includes(accepted.data?.lifecycle_status ?? "")
  ) {
    throw new Error(
      "Operations has accepted this home, so onboarding steps are locked. Reopen the step with a reason, or report an issue.",
    );
  }
  // Ready must mean ready: a step in a phase the project has not reached, or
  // one still waiting on a milestone or a prerequisite, can never be completed
  // early — whatever a stale client believes.
  if (input.status === "complete" && input.id) {
    const [{ buildReleaseContext, releaseState }, prop, siblings, projectRow] = await Promise.all([
      import("./onboarding-state"),
      supabase.from("properties").select(PROPERTY_FIELDS).eq("id", input.propertyId).maybeSingle(),
      supabase
        .from("onboarding_tasks")
        .select("*")
        .eq("property_id", input.propertyId)
        .is("archived_at", null),
      supabase
        .from("onboarding_projects")
        .select("id, status, completed_at, furnishing_scope, modules")
        .eq("property_id", input.propertyId)
        .neq("status", "cancelled")
        .maybeSingle(),
    ]);
    if (prop.error) throw prop.error;
    if (siblings.error) throw siblings.error;
    if (projectRow.error) throw projectRow.error;
    const scoped = splitByScope(siblings.data ?? [], projectScope(projectRow.data));
    const all = scoped.inScope as never[];
    const target = (siblings.data ?? []).find((t) => t.id === input.id);
    if (!prop.data || !target) throw new Error("That step is not available on this property.");
    if (!scoped.inScope.some((t) => t.id === input.id)) {
      throw new Error("This step is not applicable to the project's scope.");
    }
    if (prop.data && target) {
      const ctx = buildReleaseContext({
        property: prop.data as never,
        project: (projectRow.data ?? null) as never,
        tasks: all,
        handoff: null,
        stageCaptures: captures,
        excludedTaskIds: scoped.outOfScope.map((x) => x.task.id),
      });
      const verdict = releaseState(
        { ...target, evidence_note: input.evidenceNote } as never,
        all,
        ctx,
      );
      if (!verdict.canComplete)
        throw new Error(verdict.reason ?? "This step is not released yet and cannot be completed.");
    }
  }

  // Sending alone can never satisfy an owner approval: the step stays open
  // until the authorised homeowner records an approval.
  if (
    input.status === "complete" &&
    input.requiresOwnerApproval &&
    input.ownerApprovalStatus !== "approved"
  ) {
    throw new Error(
      "This step is waiting on the homeowner's approval and cannot be completed yet.",
    );
  }
  const row = {
    property_id: input.propertyId,
    stage: input.stage,
    title: input.title,
    detail: input.detail || null,
    assigned_to: input.assignedTo,
    due_on: input.dueOn,
    blocker: input.blocker || null,
    requires_owner_approval: input.requiresOwnerApproval,
    owner_approval_status: input.requiresOwnerApproval ? input.ownerApprovalStatus : "not_required",
    evidence_required: input.evidenceRequired,
    evidence_note: input.evidenceNote || null,
    status: input.status,
    blocks_handoff: input.blocksHandoff,
    completed_at:
      input.status === "complete" ? new Date().toISOString() : (prior?.data.completed_at ?? null),
    completed_by: input.status === "complete" ? userId : (prior?.data.completed_by ?? null),
    parent_task_id: input.parentTaskId ?? null,
    depends_on: input.dependsOn ?? [],
    sort_order: input.sortOrder ?? prior?.data.sort_order ?? 0,
    linked_ticket_id: input.linkedTicketId ?? null,
  };

  if (input.id) {
    if (!access.canManage) assertAssignedTaskPatch(prior!.data, row);
    // A field update must not overwrite requirements changed since its read.
    const patch = access.canManage
      ? row
      : {
          blocker: row.blocker,
          evidence_note: row.evidence_note,
          status: row.status,
          completed_at: row.completed_at,
          completed_by: row.completed_by,
        };
    const update = supabase
      .from("onboarding_tasks")
      .update(patch)
      .eq("id", input.id)
      .eq("property_id", input.propertyId)
      .eq("updated_at", prior!.data.updated_at)
      .is("archived_at", null);
    const scopedUpdate = access.canManage ? update : update.eq("assigned_to", userId);
    const { data: saved, error } = await scopedUpdate.select("id").maybeSingle();
    if (error) throw error;
    if (!saved) throw new Error("The task changed or was reassigned. Refresh before saving.");
    await writeAudit({
      actorId: userId,
      action: "onboarding_task_updated",
      entityType: "onboarding_task",
      entityId: input.id,
      entityLabel: input.title,
      after: row,
    });
    return { id: input.id };
  }

  // Test/demo homes must keep their whole paper trail out of live reporting.
  const parent = await supabase
    .from("properties")
    .select("is_demo")
    .eq("id", input.propertyId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("onboarding_tasks")
    .insert({ ...row, created_by: userId, is_demo: parent.data?.is_demo ?? false })
    .select("id")
    .single();
  if (error) throw error;
  await writeAudit({
    actorId: userId,
    action: "onboarding_task_created",
    entityType: "onboarding_task",
    entityId: data.id,
    entityLabel: input.title,
    after: row,
  });
  if (input.requiresOwnerApproval) {
    await ensureOwnerApprovalRequest(supabase, userId, {
      taskId: data.id,
      propertyId: input.propertyId,
      title: input.title,
      detail: input.detail,
      dueOn: input.dueOn,
      isDemo: parent.data?.is_demo ?? false,
    });
  }
  return { id: data.id };
}

/**
 * Create the homeowner-facing decision record for a task that needs owner
 * approval, and put it in front of that homeowner.
 *
 * There is ONE canonical approval model. An Active Owner sees the same
 * `approvals` row in their portal; a standard owner — who never needs Resolve
 * access — gets a Resolve-generated email carrying the same reference, and the
 * row records the address it went to.
 *
 * A new request is created only when there is no request still waiting. Earlier
 * decisions are never overwritten — a revision request produces an additional
 * record so identity, timestamp, comment and the reviewed version all survive.
 */
export async function ensureOwnerApprovalRequest(
  supabase: Client,
  userId: string,
  input: {
    taskId: string;
    propertyId: string;
    title: string;
    detail: string;
    dueOn: string | null;
    isDemo: boolean;
    /** Version label of the item being reviewed, e.g. "Mood boards v2". */
    version?: string | null;
    /** Plan setup preserves pending decisions; staff routes them when the work is ready. */
    deferDelivery?: boolean;
  },
): Promise<{ approvalId: string | null; channel: "in_app" | "email" | "none" }> {
  const detail = [input.detail || null, input.version ? `Version reviewed: ${input.version}` : null]
    .filter(Boolean)
    .join("\n\n");
  const prepared = await supabase.rpc("prepare_onboarding_task_approval", {
    _task_id: input.taskId,
    _property_id: input.propertyId,
    _detail: detail,
  });
  if (prepared.error) throw prepared.error;
  if (!prepared.data) throw new Error("The approval could not be prepared.");
  if (input.deferDelivery) return { approvalId: prepared.data, channel: "none" };
  const saved = await supabase
    .from("approvals")
    .select("id, title, detail")
    .eq("id", prepared.data)
    .eq("property_id", input.propertyId)
    .single();
  if (saved.error) throw saved.error;
  const { routeOwnerDecision } = await import("./onboarding-finance.server");
  const routed = await routeOwnerDecision(supabase, userId, {
    propertyId: input.propertyId,
    approvalId: saved.data.id,
    subject: saved.data.title,
    amount: null,
    detail: saved.data.detail ?? "",
  });
  return { approvalId: saved.data.id, channel: routed.channel };
}

/**
 * Send (or re-send) one task to the enrolled homeowner for approval.
 *
 * Used for the mood-board step after a revision: the previous decision stays
 * in history, a fresh request records the version being reviewed, and the task
 * returns to "awaiting owner approval". Sending alone never completes the step.
 */
export async function submitOwnerApproval(
  supabase: Client,
  userId: string,
  input: { taskId: string; version: string; note: string },
) {
  await assertCap(supabase, userId, "is_onboarding_staff");
  const task = await supabase
    .from("onboarding_tasks")
    .select(
      "id, property_id, assigned_to, title, detail, due_on, is_demo, requires_owner_approval, owner_approval_status",
    )
    .eq("id", input.taskId)
    .maybeSingle();
  if (task.error) throw task.error;
  if (!task.data) throw new Error("That task is not available.");
  await onboardingTaskAccess(supabase, userId, task.data.property_id, task.data.assigned_to);
  if (!task.data.requires_owner_approval) {
    throw new Error("This step does not require a homeowner approval.");
  }
  if (task.data.owner_approval_status === "approved") {
    throw new Error("The homeowner already approved this step.");
  }

  const { approvalId, channel } = await ensureOwnerApprovalRequest(supabase, userId, {
    taskId: task.data.id,
    propertyId: task.data.property_id,
    title: task.data.title,
    detail: [task.data.detail ?? "", input.note].filter(Boolean).join("\n\n"),
    dueOn: task.data.due_on,
    isDemo: task.data.is_demo ?? false,
    version: input.version || null,
  });
  if (!approvalId || channel === "none") {
    throw new Error(
      "This home has no enrolled homeowner and no homeowner email on file, so the approval could not be sent. Add an owner contact email on the Property tab first.",
    );
  }

  await writeAudit({
    actorId: userId,
    action: "owner_approval_requested",
    entityType: "onboarding_task",
    entityId: task.data.id,
    entityLabel: task.data.title,
    after: { approvalId, channel, version: input.version || null },
  });
  return { ok: true as const, approvalId, channel };
}

/**
 * One-step "Send to Homeowner" from a task drawer.
 *
 * Nothing new is invented: the note becomes the detail of the SAME canonical
 * approval record every other path uses, the chosen files are marked shared
 * through the existing visibility rule, and a step that was not marked as
 * needing a homeowner decision is marked so first (project lead only). The
 * homeowner then sees it in their Onboarding actions queue, or by
 * Resolve-generated email when they are not enrolled.
 */
export async function sendTaskToOwner(
  supabase: Client,
  userId: string,
  input: { taskId: string; note: string; version: string; documentIds: string[] },
) {
  await assertCap(supabase, userId, "is_onboarding_staff");
  const task = await supabase
    .from("onboarding_tasks")
    .select(
      "id, property_id, assigned_to, title, detail, due_on, is_demo, requires_owner_approval, owner_approval_status",
    )
    .eq("id", input.taskId)
    .maybeSingle();
  if (task.error) throw task.error;
  if (!task.data) throw new Error("That task is not available.");
  const access = await onboardingTaskAccess(
    supabase,
    userId,
    task.data.property_id,
    task.data.assigned_to,
  );
  if (task.data.owner_approval_status === "approved") {
    throw new Error("The homeowner already approved this step.");
  }

  if (!task.data.requires_owner_approval) {
    if (!access.canManage) {
      throw new Error(
        "Only the project lead can send a step that is not already marked for a homeowner decision.",
      );
    }
    const { error } = await supabase
      .from("onboarding_tasks")
      .update({ requires_owner_approval: true, owner_approval_status: "pending" })
      .eq("id", task.data.id);
    if (error) throw error;
  }

  // Share the selected files through the one visibility rule.
  if (input.documentIds.length > 0) {
    const { loadViewer, setVisibility } = await import("./attachments.server");
    const viewer = await loadViewer(supabase, userId);
    for (const documentId of input.documentIds) {
      await setVisibility(viewer, documentId, "owner_shared");
    }
  }

  const { approvalId, channel } = await ensureOwnerApprovalRequest(supabase, userId, {
    taskId: task.data.id,
    propertyId: task.data.property_id,
    title: task.data.title,
    detail: input.note,
    dueOn: task.data.due_on,
    isDemo: task.data.is_demo ?? false,
    version: input.version || null,
  });
  if (!approvalId || channel === "none") {
    throw new Error(
      "This home has no enrolled homeowner and no homeowner email on file, so nothing could be sent. Add an owner contact email on the Property tab first.",
    );
  }

  // The note staff wrote here IS the owner-facing explanation, so publish it
  // with the request instead of leaving the homeowner an empty card with no
  // instructions and nothing to act on.
  let published = false;
  if (channel === "in_app") {
    const { loadOwnerApprovalPublicationContext, publishOwnerApproval } = await import(
      "./owner-approval.server"
    );
    const context = await loadOwnerApprovalPublicationContext(supabase, approvalId);
    if (
      context.canPublish &&
      context.programId &&
      context.ownerId &&
      context.recipientId &&
      input.note.trim().length >= 20
    ) {
      await publishOwnerApproval(supabase, {
        approvalId,
        expectedUpdatedAt: context.expectedUpdatedAt,
        expectedRevision: context.expectedRevision,
        expectedOwnerId: context.ownerId,
        expectedProgramId: context.programId,
        expectedRecipientId: context.recipientId,
        title: task.data.title.slice(0, 180),
        detail: input.note.trim(),
        reviewed: true,
      });
      published = true;
    }
  }

  await writeAudit({
    actorId: userId,
    action: "owner_task_sent",
    entityType: "onboarding_task",
    entityId: task.data.id,
    entityLabel: task.data.title,
    after: { approvalId, channel, published, sharedFiles: input.documentIds.length },
  });
  return {
    ok: true as const,
    approvalId,
    channel,
    published,
    sharedFiles: input.documentIds.length,
  };
}


/**
 * Staff confirm the homeowner's final answer on a task approval.
 *
 * A standard owner replies by email, so a member of staff records what they
 * said against the SAME canonical approval row: the decision, who reported it,
 * their words, and a link to the reply kept as evidence. Nothing is invented —
 * the row keeps its identity, and history is never rewritten.
 */
export async function recordOwnerTaskDecision(
  supabase: Client,
  userId: string,
  input: {
    taskId: string;
    approved: boolean;
    /** What the homeowner said, and where it came from. */
    note: string;
    /** Link to the reply email or saved document, when available. */
    evidenceUrl?: string | null | undefined;
  },
) {
  await assertCap(supabase, userId, "is_onboarding_staff");
  if (!input.note || input.note.trim().length < 3) {
    throw new Error("Record what the homeowner said and where the answer came from.");
  }
  const task = await supabase
    .from("onboarding_tasks")
    .select("id, property_id, assigned_to, title, requires_owner_approval, owner_approval_status")
    .eq("id", input.taskId)
    .maybeSingle();
  if (task.error) throw task.error;
  if (!task.data) throw new Error("That task is not available.");
  await onboardingTaskAccess(supabase, userId, task.data.property_id, task.data.assigned_to);
  if (!task.data.requires_owner_approval) {
    throw new Error("This step does not require a homeowner approval.");
  }

  const decision = await supabase.rpc("decide_onboarding_task_approval", {
    _task_id: input.taskId,
    _approved: input.approved,
    _note: input.note.trim(),
    ...(input.evidenceUrl ? { _evidence_url: input.evidenceUrl } : {}),
  });
  if (decision.error) throw decision.error;
  const approvalId = decision.data;

  await writeAudit({
    actorId: userId,
    action: input.approved ? "owner_approval_recorded" : "owner_changes_recorded",
    entityType: "onboarding_task",
    entityId: task.data.id,
    entityLabel: task.data.title,
    reason: input.note.trim(),
    after: { approvalId, evidenceUrl: input.evidenceUrl ?? null },
  });
  return { ok: true as const, approvalId };
}

/**
 * Staff-confirmed reconciliation after a participation change.
 *
 * Enrollment can start or stop after tasks exist. Nothing is applied silently:
 * the workspace surfaces the affected steps and a member of staff confirms the
 * change here. Recorded decisions and completed work are preserved — an
 * already-approved step keeps its approval, and a pending request is withdrawn
 * (not deleted) when participation ends.
 */
export async function confirmApprovalRequirement(
  supabase: Client,
  userId: string,
  input: { taskId: string; requiresOwnerApproval: boolean; reason: string },
) {
  await assertCap(supabase, userId, "is_onboarding_staff");
  const task = await supabase
    .from("onboarding_tasks")
    .select(
      "id, property_id, assigned_to, title, detail, due_on, is_demo, status, requires_owner_approval, owner_approval_status",
    )
    .eq("id", input.taskId)
    .maybeSingle();
  if (task.error) throw task.error;
  if (!task.data) throw new Error("That task is not available.");
  const access = await onboardingTaskAccess(
    supabase,
    userId,
    task.data.property_id,
    task.data.assigned_to,
  );
  if (!access.canManage) throw new Error("Only the project lead can change approval requirements.");

  if (input.requiresOwnerApproval) {
    const alreadyApproved = task.data.owner_approval_status === "approved";
    const { error } = await supabase
      .from("onboarding_tasks")
      .update({
        requires_owner_approval: true,
        owner_approval_status: alreadyApproved ? "approved" : "pending",
      })
      .eq("id", task.data.id);
    if (error) throw error;
    if (!alreadyApproved) {
      await ensureOwnerApprovalRequest(supabase, userId, {
        taskId: task.data.id,
        propertyId: task.data.property_id,
        title: task.data.title,
        detail: task.data.detail ?? "",
        dueOn: task.data.due_on,
        isDemo: task.data.is_demo ?? false,
      });
      await supabase
        .from("onboarding_tasks")
        .update({ owner_approval_status: "awaiting_owner" })
        .eq("id", task.data.id);
    }
  } else {
    // Withdraw only a request still waiting; decided history is untouched.
    const withdrawn = await supabase
      .from("approvals")
      .update({ status: "withdrawn", decision_note: input.reason })
      .eq("entity_type", "onboarding_task")
      .eq("entity_id", task.data.id)
      .eq("status", "pending")
      .select("id");
    if (withdrawn.error) throw withdrawn.error;

    const keepApproved = task.data.owner_approval_status === "approved";
    const { error } = await supabase
      .from("onboarding_tasks")
      .update({
        requires_owner_approval: keepApproved,
        owner_approval_status: keepApproved ? "approved" : "not_required",
      })
      .eq("id", task.data.id);
    if (error) throw error;
  }

  await writeAudit({
    actorId: userId,
    action: "owner_approval_requirement_confirmed",
    entityType: "onboarding_task",
    entityId: task.data.id,
    entityLabel: task.data.title,
    reason: input.reason,
    after: { requiresOwnerApproval: input.requiresOwnerApproval },
  });
  return { ok: true as const };
}

export async function setPropertyLifecycle(
  supabase: Client,
  userId: string,
  input: { propertyId: string; status: string; stage?: string | null | undefined; reason: string },
) {
  await assertCap(supabase, userId, "is_onboarding_staff");
  await assertOnboardingPropertyManagement(supabase, userId, input.propertyId);
  if (["handoff_requested", "handoff_corrections", "active_operations"].includes(input.status)) {
    throw new Error(
      "Use the handoff review chain to request, return, accept or confirm this home Live.",
    );
  }
  const before = await supabase
    .from("properties")
    .select("lifecycle_status, onboarding_stage, handoff_accepted_at")
    .eq("id", input.propertyId)
    .maybeSingle();

  if (before.error) throw before.error;
  if (!before.data) throw new Error("That property is not available.");
  const issue = lifecycleEditIssue(before.data, input);
  if (issue) throw new Error(issue);

  const patch: {
    lifecycle_status: string;
    archived_at?: string;
  } = { lifecycle_status: input.status };
  if (input.status === "offboarded") patch.archived_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("properties")
    .update(patch)
    .eq("id", input.propertyId)
    .eq("lifecycle_status", before.data.lifecycle_status!)
    .is("handoff_accepted_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("The lifecycle changed before this update. Refresh and review it.");

  await writeAudit({
    actorId: userId,
    action: "property_lifecycle_changed",
    entityType: "property",
    entityId: input.propertyId,
    reason: input.reason,
    before: before.data,
    after: patch,
  });
  return { ok: true as const };
}

export async function requestHandoff(
  supabase: Client,
  userId: string,
  input: { propertyId: string; notes: string; carryoverAccepted: boolean },
) {
  await assertOnboardingStageAccess(supabase, userId, input.propertyId, "submit");
  const snapshotResult = await supabase.rpc("read_onboarding_handoff_snapshot", {
    _property_id: input.propertyId,
  });
  if (snapshotResult.error) throw snapshotResult.error;
  const snapshot = snapshotResult.data as unknown as OnboardingHandoffSnapshot;
  const prepared = prepareOnboardingHandoff(snapshot, input.carryoverAccepted);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: handoffId, error } = await supabaseAdmin.rpc("create_onboarding_handoff", {
    _property_id: input.propertyId,
    _actor_id: userId,
    _expected_lifecycle: snapshot.property.lifecycle_status,
    _request: {
      checklist: prepared.checks,
      validation: { ready: prepared.ready, openBlocking: prepared.openBlocking },
      openTaskIds: prepared.openTaskIds,
      applicableTaskIds: prepared.applicableTaskIds,
      carryoverAccepted: input.carryoverAccepted,
      notes: input.notes,
      snapshot: snapshotResult.data,
    },
  });
  if (error) throw error;
  if (!handoffId) throw new Error("The handoff request could not be recorded.");
  await writeAudit({
    actorId: userId,
    action: "handoff_requested",
    entityType: "property",
    entityId: input.propertyId,
    entityLabel: snapshot.property.name,
    after: { handoffId, ready: prepared.ready, openBlocking: prepared.openBlocking },
  });
  return { id: handoffId, ready: prepared.ready, checks: prepared.checks };
}

export async function reviewHandoff(
  supabase: Client,
  userId: string,
  input: {
    handoffId: string;
    expectedStep: string;
    decision: "accepted" | "returned";
    corrections: string;
    exceptionReason?: string | undefined;
  },
) {
  const { data, error } = await supabase.rpc("review_onboarding_handoff", {
    _handoff_id: input.handoffId,
    _expected_step: input.expectedStep,
    _decision: input.decision,
    _note: input.corrections,
    _exception: input.exceptionReason ?? "",
  });
  if (error) throw error;
  const result = data as { ok: true; step: string; status: string; propertyId: string };
  await writeAudit({
    actorId: userId,
    action: input.decision === "returned" ? "handoff_returned" : "handoff_step_approved",
    entityType: "property",
    entityId: result.propertyId,
    reason: input.exceptionReason || input.corrections || null,
    after: { handoffId: input.handoffId, step: result.step, status: result.status },
  });
  return result;
}

/* ------------------------------------------------------------------ *
 * Stage 2 additions: internal notes, exceptions, ticket links,
 * archiving and the standard external-record review queue.
 * ------------------------------------------------------------------ */

export async function addOnboardingNote(
  supabase: Client,
  userId: string,
  input: {
    propertyId: string;
    taskId?: string | null | undefined;
    body: string;
    mentions: string[];
  },
) {
  await assertCap(supabase, userId, "is_onboarding_staff");
  let assignedTo: string | null = null;
  if (input.taskId) {
    const task = await supabase
      .from("onboarding_tasks")
      .select("property_id, assigned_to, archived_at")
      .eq("id", input.taskId)
      .single();
    if (task.error) throw task.error;
    if (task.data.property_id !== input.propertyId || task.data.archived_at)
      throw new Error("Choose an available task from this property.");
    assignedTo = task.data.assigned_to;
  }
  await onboardingTaskAccess(supabase, userId, input.propertyId, assignedTo);
  const { data, error } = await supabase
    .from("onboarding_notes")
    .insert({
      property_id: input.propertyId,
      task_id: input.taskId ?? null,
      body: input.body,
      mentions: input.mentions,
      internal: true,
      author_id: userId,
    })
    .select("id")
    .single();
  if (error) throw error;
  await writeAudit({
    actorId: userId,
    action: "onboarding_note_added",
    entityType: "property",
    entityId: input.propertyId,
    after: { noteId: data.id, mentions: input.mentions },
  });
  return { id: data.id };
}

/**
 * Correction: reopen a completed step.
 *
 * Completion is a claim about the home, so undoing it is never silent. The
 * reason is mandatory and lands in both the audit log and the project's
 * human-readable history, and the original completion stays visible there.
 */
export async function reopenOnboardingTask(
  supabase: Client,
  userId: string,
  input: { taskId: string; reason: string },
) {
  await assertCap(supabase, userId, "is_onboarding_staff");
  const { data: task, error: readError } = await supabase
    .from("onboarding_tasks")
    .select("id, property_id, title, completed_at, status, stage, assigned_to")
    .eq("id", input.taskId)
    .single();
  if (readError) throw readError;
  const access = await onboardingTaskAccess(supabase, userId, task.property_id, task.assigned_to);
  if (task.status !== "complete") throw new Error("Only a completed step can be reopened.");
  if (input.reason.trim().length < 3) throw new Error("Record why this step needs a correction.");
  await assertTaskRequirementEditable(supabase, input.taskId);
  // Keep the prior evidence attached while the correction is in progress.
  const update = supabase
    .from("onboarding_tasks")
    .update({ status: "open" })
    .eq("id", input.taskId)
    .eq("status", "complete");
  if (!access.canManage) update.eq("assigned_to", userId);
  const unchanged = task.completed_at
    ? update.eq("completed_at", task.completed_at)
    : update.is("completed_at", null);
  const { data: reopened, error } = await unchanged.select("id").maybeSingle();
  if (error) throw error;
  if (!reopened) throw new Error("This step changed. Refresh before reopening it.");

  const { loadProjectForProperty, recordProjectEvent } =
    await import("./onboarding-project.server");
  const { project } = await loadProjectForProperty(supabase, task.property_id);
  if (project) {
    await recordProjectEvent(supabase, {
      projectId: project.id,
      propertyId: task.property_id,
      kind: "task_reopened",
      summary: `Reopened "${task.title}"`,
      detail: input.reason,
      priorValue: task.completed_at ? `Completed ${task.completed_at.slice(0, 10)}` : "Complete",
      newValue: "Open",
      actor: userId,
      isDemo: project.is_demo ?? false,
    });
  }

  await writeAudit({
    actorId: userId,
    action: "onboarding_task_reopened",
    entityType: "onboarding_task",
    entityId: input.taskId,
    reason: input.reason,
  });
  return { ok: true as const };
}

/** Alternate task actions must respect the same review boundary as ordinary edits. */
async function assertTaskRequirementEditable(supabase: Client, taskId: string) {
  const task = await supabase
    .from("onboarding_tasks")
    .select("property_id, stage, archived_at")
    .eq("id", taskId)
    .single();
  if (task.error) throw task.error;
  if (task.data.archived_at) throw new Error("This step is already archived.");
  const property = await supabase
    .from("properties")
    .select("handoff_accepted_at, lifecycle_status")
    .eq("id", task.data.property_id)
    .single();
  if (property.error) throw property.error;
  if (
    property.data.handoff_accepted_at ||
    ["handoff_requested", "active_operations"].includes(property.data.lifecycle_status ?? "")
  ) {
    throw new Error("Return the handoff before changing onboarding requirements.");
  }
  const { loadStageCaptures } = await import("./onboarding-stage.server");
  const captures = await loadStageCaptures(supabase, task.data.property_id);
  const stage = captures
    .filter((capture) => capture.stage === task.data.stage)
    .sort((a, b) => b.revision - a.revision)[0];
  if (stage && ["complete", "awaiting_review"].includes(stage.status)) {
    throw new Error("Return or reopen the stage before changing its requirements.");
  }
}

export async function recordTaskException(
  supabase: Client,
  userId: string,
  input: { taskId: string; reason: string },
) {
  await assertCap(supabase, userId, "is_onboarding_leader");
  await assertTaskRequirementEditable(supabase, input.taskId);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("onboarding_tasks")
    .update({ exception_reason: input.reason, exception_by: userId, exception_at: now })
    .eq("id", input.taskId);
  if (error) throw error;
  await writeAudit({
    actorId: userId,
    action: "onboarding_exception_recorded",
    entityType: "onboarding_task",
    entityId: input.taskId,
    reason: input.reason,
  });
  return { ok: true as const };
}

export async function archiveOnboardingTask(
  supabase: Client,
  userId: string,
  input: { taskId: string; reason: string },
) {
  // Leadership or the Onboarding Director may void a Task.
  const [sup, dir] = await Promise.all([
    supabase.rpc("is_supervisor", { _user_id: userId }),
    supabase.rpc("is_onboarding_director", { _user_id: userId }),
  ]);
  if (!sup.data && !dir.data) throw new Error("You do not have access to this action.");
  await assertTaskRequirementEditable(supabase, input.taskId);
  const now = new Date().toISOString();
  // Void keeps the Task on record with who, when and why; it leaves the work
  // queue and progress because archived Tasks are never counted.
  const { error } = await supabase
    .from("onboarding_tasks")
    .update({
      archived_at: now,
      archived_by: userId,
      exception_reason: `Voided — not needed: ${input.reason}`,
      exception_by: userId,
      exception_at: now,
    })
    .eq("id", input.taskId);
  if (error) throw error;
  await writeAudit({
    actorId: userId,
    action: "onboarding_task_archived",
    entityType: "onboarding_task",
    entityId: input.taskId,
    reason: input.reason,
  });
  return { ok: true as const };
}

/**
 * Canonical property matching for any external database (spreadsheets, forms
 * replacements, the Property Utility Matrix — all identical). Matching is by
 * Resolve property UUID or OwnerRez Property ID only. Never by name, and a
 * record never creates a property.
 */
export async function resolveExternalRecord(
  supabase: Client,
  userId: string,
  input: {
    recordId: string;
    propertyId?: string | null | undefined;
    ownerrezPropertyId?: string | null | undefined;
    decision: "match" | "review" | "archive";
    note: string;
  },
) {
  await assertCap(supabase, userId, "is_onboarding_staff");
  const now = new Date().toISOString();

  if (input.decision === "archive") {
    const { error } = await supabase
      .from("external_records")
      .update({ archived_at: now, match_status: "archived", match_note: input.note || null })
      .eq("id", input.recordId);
    if (error) throw error;
    return { ok: true as const };
  }

  if (input.decision === "review") {
    const { error } = await supabase
      .from("external_records")
      .update({ match_status: "review", match_note: input.note || null })
      .eq("id", input.recordId);
    if (error) throw error;
    return { ok: true as const };
  }

  let propertyId = input.propertyId ?? null;
  if (!propertyId && input.ownerrezPropertyId) {
    const { data } = await supabase
      .from("properties")
      .select("id")
      .eq("ownerrez_property_id", input.ownerrezPropertyId)
      .maybeSingle();
    propertyId = data?.id ?? null;
  }
  if (!propertyId) {
    throw new Error(
      "A record can only be matched with a Resolve property ID or an OwnerRez Property ID. Names are never used.",
    );
  }

  const { error } = await supabase
    .from("external_records")
    .update({
      property_id: propertyId,
      ownerrez_property_id: input.ownerrezPropertyId ?? null,
      match_status: "matched",
      match_note: input.note || null,
      matched_by: userId,
      matched_at: now,
    })
    .eq("id", input.recordId);
  if (error) throw error;

  await writeAudit({
    actorId: userId,
    action: "external_record_matched",
    entityType: "property",
    entityId: propertyId,
    reason: input.note || null,
    after: { recordId: input.recordId },
  });
  return { ok: true as const };
}

export async function overrideOnboardingTaskDate(
  supabase: Client,
  userId: string,
  input: { taskId: string; expectedUpdatedAt: string; dueOn: string | null; reason: string },
  admin: Client,
) {
  await assertCap(supabase, userId, "is_onboarding_staff");
  const task = await supabase
    .from("onboarding_tasks")
    .select("property_id, assigned_to")
    .eq("id", input.taskId)
    .single();
  if (task.error) throw task.error;
  const access = await onboardingTaskAccess(
    supabase,
    userId,
    task.data.property_id,
    task.data.assigned_to,
  );
  if (!access.canManage) throw new Error("Only the project lead can change task dates.");
  const result = await admin.rpc("override_onboarding_task_date", {
    _task_id: input.taskId,
    _actor_id: userId,
    _expected_updated_at: input.expectedUpdatedAt,
    // Clearing a date sends null, which the database accepts.
    _due_on: input.dueOn as unknown as string,
    _reason: input.reason,
  });
  if (result.error) throw result.error;
  if (!result.data) throw new Error("The date override could not be recorded.");
  return { id: result.data };
}
