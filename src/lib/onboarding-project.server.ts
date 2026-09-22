/**
 * Onboarding Project record (server-only).
 *
 * A Property is the operating asset. An Onboarding Project is one lifecycle
 * instance for that property. They are deliberately different records: a home
 * can exist in Resolve for a long time before anyone starts onboarding it, and
 * starting onboarding is an explicit, audited staff action.
 *
 * The project owns scope (which modules apply), the people accountable, the
 * dates the plan hangs off, and a human-readable history. It never duplicates
 * property facts — those stay on the property record.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { type FurnishingScope, type ModuleKey } from "./onboarding-scope";
import { writeAudit } from "./audit.server";
import { readCountedRows } from "./read-all-rows";
import { assertOnboardingPropertyManagement } from "./onboarding-task-access.server";
import {
  assertEligibleProjectAssignees,
  readOnboardingAssignmentAuthority,
  resolveNewProjectAssignments,
} from "./onboarding-assignment.server";

type Client = SupabaseClient<Database>;

export type ProjectRow = Database["public"]["Tables"]["onboarding_projects"]["Row"];

async function assertOnboardingStaff(supabase: Client, userId: string) {
  const [staff, supervisor] = await Promise.all([
    supabase.rpc("is_onboarding_staff", { _user_id: userId }),
    supabase.rpc("is_supervisor", { _user_id: userId }),
  ]);
  if (staff.error || supervisor.error) throw new Error("Could not verify onboarding access.");
  if (!staff.data && !supervisor.data) {
    throw new Error("You do not have access to change onboarding projects.");
  }
  return { supervisor: Boolean(supervisor.data) };
}

export async function recordProjectEvent(
  supabase: Client,
  input: {
    projectId: string;
    propertyId: string;
    kind: string;
    summary: string;
    detail?: string | null;
    priorValue?: string | null;
    newValue?: string | null;
    actor: string | null;
    isDemo?: boolean;
  },
) {
  const { error } = await supabase.from("onboarding_project_events").insert({
    project_id: input.projectId,
    property_id: input.propertyId,
    kind: input.kind,
    summary: input.summary,
    detail: input.detail ?? null,
    prior_value: input.priorValue ?? null,
    new_value: input.newValue ?? null,
    actor: input.actor,
    is_demo: input.isDemo ?? false,
  });
  if (error) throw error;
}

/** Every project, newest first. Read-only for any internal staff member. */
export async function loadProjects(supabase: Client, leadId?: string) {
  let query = supabase
    .from("onboarding_projects")
    .select("*", { count: "exact" })
    .order("started_at", { ascending: false })
    .order("id");
  if (leadId) query = query.or(`project_manager.eq.${leadId},director.eq.${leadId}`);
  const { data, error } = await readCountedRows(query);
  if (error) throw error;
  return data ?? [];
}

/** Public server endpoint projection; raw loaders also support already-scoped internal workflows. */
export async function loadProjectsForActor(supabase: Client, userId: string) {
  const access = await assertOnboardingStaff(supabase, userId);
  return loadProjects(supabase, access.supervisor ? undefined : userId);
}

export async function loadPropertyProjectForActor(
  supabase: Client,
  userId: string,
  propertyId: string,
) {
  await assertOnboardingStaff(supabase, userId);
  await assertOnboardingPropertyManagement(supabase, userId, propertyId);
  const [result, assignments] = await Promise.all([
    loadProjectForProperty(supabase, propertyId),
    readOnboardingAssignmentAuthority(supabase),
  ]);
  return { ...result, assignments: { ...assignments, projectManagerId: userId } };
}

export async function loadProjectForProperty(supabase: Client, propertyId: string) {
  const [project, events] = await Promise.all([
    supabase
      .from("onboarding_projects")
      .select("*")
      .eq("property_id", propertyId)
      .neq("status", "cancelled")
      .maybeSingle(),
    supabase
      .from("onboarding_project_events")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (project.error) throw project.error;
  if (events.error) throw events.error;
  return { project: project.data ?? null, events: events.data ?? [] };
}

export type StartProjectInput = {
  propertyId: string;
  branch: string | null;
  projectManager: string | null;
  director: string | null;
  /** Who runs the utilities for this home; the homeowner sees this name. */
  utilityManager?: string | null | undefined;
  plannedClosingOn: string | null;
  possessionOn: string | null;
  targetHandoffOn: string | null;
  furnishingScope: FurnishingScope;
  modules: ModuleKey[];
  poolLocation?: "none" | "neighborhood" | "property";
  notes: string | null;
  externalRefs: Record<string, string>;

};

/**
 * Start onboarding for a property.
 *
 * Nothing about the property's identity changes: the property row, its
 * OwnerRez reference and its history are all preserved. Dates supplied here
 * are copied onto the property only where the property has no value yet, so
 * initialization never overwrites a known fact.
 */
export async function startOnboardingProject(
  supabase: Client,
  userId: string,
  input: StartProjectInput,
) {
  const access = await assertOnboardingStaff(supabase, userId);

  const property = await supabase
    .from("properties")
    .select(
      "id, name, is_demo, lifecycle_status, planned_closing_on, actual_access_on, onboarding_owner",
    )
    .eq("id", input.propertyId)
    .single();
  if (property.error) throw property.error;

  // Idempotent by design: a double click, a refresh or a retry must open the
  // project that already exists rather than create a second one.
  const existing = await supabase
    .from("onboarding_projects")
    .select("*")
    .eq("property_id", input.propertyId)
    .neq("status", "cancelled")
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    assertProjectLead(existing.data, userId, access.supervisor);
    // A project that exists with no plan is the broken state this repairs:
    // re-running Start onboarding fills the plan in without creating a
    // second project.
    if (existing.data.status === "active" || existing.data.status === "planning") {
      if ((existing.data.modules ?? []).includes("active_owner")) {
        await ensureActiveOwnerEnrollment(supabase, userId, input.propertyId);
      }
      const { applyOnboardingTemplate } = await import("./onboarding-template.server");
      await applyOnboardingTemplate(supabase, userId, { propertyId: input.propertyId });
    }
    return existing.data;
  }

  const modules = input.modules;
  const assignments = await resolveNewProjectAssignments(supabase, userId, input);
  if (input.utilityManager) {
    await assertEligibleProjectAssignees(supabase, [input.utilityManager]);
  }

  const { data, error } = await supabase
    .from("onboarding_projects")
    .insert({
      property_id: input.propertyId,
      status: "active",
      branch: input.branch,
      project_manager: assignments.projectManager,
      director: assignments.director,
      utility_manager: input.utilityManager ?? null,
      planned_closing_on: input.plannedClosingOn,
      possession_on: input.possessionOn,
      target_handoff_on: input.targetHandoffOn,
      furnishing_scope: input.furnishingScope,
      modules,
      pool_location: input.poolLocation ?? "none",
      external_refs: input.externalRefs,

      notes: input.notes,
      started_by: userId,
      is_demo: property.data.is_demo ?? false,
    })
    .select("*")
    .single();
  if (error) throw error;

  // Fill only what the property does not already know. Never overwrite.
  const patch: Database["public"]["Tables"]["properties"]["Update"] = {};
  if (!property.data.planned_closing_on && input.plannedClosingOn) {
    patch.planned_closing_on = input.plannedClosingOn;
  }
  if (!property.data.actual_access_on && input.possessionOn) {
    patch.actual_access_on = input.possessionOn;
  }
  if (!property.data.onboarding_owner && data.project_manager) {
    patch.onboarding_owner = data.project_manager;
  }
  if (property.data.lifecycle_status !== "onboarding") patch.lifecycle_status = "onboarding";
  patch.onboarding_started_at = new Date().toISOString();
  const update = await supabase.from("properties").update(patch).eq("id", input.propertyId);
  if (update.error) throw update.error;

  if (modules.includes("active_owner")) {
    await ensureActiveOwnerEnrollment(supabase, userId, input.propertyId);
  }

  // Starting onboarding has to hand the team a plan, not an empty shell.
  // applyOnboardingTemplate deduplicates by task title, so this stays safe on
  // a retry and never doubles an existing plan.
  const { applyOnboardingTemplate } = await import("./onboarding-template.server");
  const applied = await applyOnboardingTemplate(supabase, userId, {
    propertyId: input.propertyId,
  });
  const plannedTasks = applied.created;

  await recordProjectEvent(supabase, {
    projectId: data.id,
    propertyId: input.propertyId,
    kind: "project_started",
    summary: `Onboarding started for ${property.data.name}.`,
    detail: `Scope: ${input.furnishingScope === "no_furnishing" ? "No furnishings" : "Full furnishing"}.${plannedTasks ? ` Plan created with ${plannedTasks} steps.` : ""}`,
    actor: userId,
    isDemo: property.data.is_demo ?? false,
  });
  await writeAudit({
    action: "onboarding_project_started",
    entityType: "property",
    entityId: input.propertyId,
    entityLabel: property.data.name,
    actorId: userId,
    after: { projectId: data.id, modules },
  });

  return data;
}

/** Scope and accountability can change; every change is explained in history. */
export async function updateProject(
  supabase: Client,
  userId: string,
  input: {
    projectId: string;
    branch?: string | null | undefined;
    projectManager?: string | null | undefined;
    director?: string | null | undefined;
    utilityManager?: string | null | undefined;
    plannedClosingOn?: string | null | undefined;
    possessionOn?: string | null | undefined;
    targetHandoffOn?: string | null | undefined;
    furnishingScope?: FurnishingScope | undefined;
    modules?: ModuleKey[] | undefined;
    poolLocation?: "none" | "neighborhood" | "property" | undefined;

    notes?: string | null | undefined;
    externalRefs?: Record<string, string> | undefined;
    reason?: string | null | undefined;
  },
) {
  const access = await assertOnboardingStaff(supabase, userId);

  const current = await supabase
    .from("onboarding_projects")
    .select("*")
    .eq("id", input.projectId)
    .single();
  if (current.error) throw current.error;
  const assignmentsChanging =
    (input.projectManager !== undefined && input.projectManager !== current.data.project_manager) ||
    (input.director !== undefined && input.director !== current.data.director);
  if (assignmentsChanging) {
    const authority = await readOnboardingAssignmentAuthority(supabase);
    if (!authority.canAssign) {
      throw new Error(
        "Only a platform administrator or the trusted Onboarding Director can change project responsibility.",
      );
    }
    await assertEligibleProjectAssignees(supabase, [
      input.projectManager === undefined ? current.data.project_manager : input.projectManager,
      input.director === undefined ? current.data.director : input.director,
    ]);
  } else {
    assertProjectLead(current.data, userId, access.supervisor);
  }
  // The utility manager is a staff seat like the others, so the same
  // eligibility rule applies whoever sets it.
  if (
    input.utilityManager !== undefined &&
    input.utilityManager !== current.data.utility_manager &&
    input.utilityManager
  ) {
    await assertEligibleProjectAssignees(supabase, [input.utilityManager]);
  }

  // A scope change after initialization must always carry a reason: History
  // has to explain why this home stopped being asked for that work.
  const scopeChanging =
    (input.furnishingScope !== undefined &&
      input.furnishingScope !== current.data.furnishing_scope) ||
    (input.modules !== undefined &&
      JSON.stringify([...input.modules].sort()) !==
        JSON.stringify([...(current.data.modules ?? [])].sort()));
  if (scopeChanging && (input.reason ?? "").trim().length < 5)
    throw new Error("A scope change needs a reason so History can explain it.");

  const patch: Database["public"]["Tables"]["onboarding_projects"]["Update"] = {};
  if (input.branch !== undefined) patch.branch = input.branch;
  if (input.projectManager !== undefined) patch.project_manager = input.projectManager;
  if (input.director !== undefined) patch.director = input.director;
  if (input.utilityManager !== undefined) patch.utility_manager = input.utilityManager;
  if (input.plannedClosingOn !== undefined) patch.planned_closing_on = input.plannedClosingOn;
  if (input.possessionOn !== undefined) patch.possession_on = input.possessionOn;
  if (input.targetHandoffOn !== undefined) patch.target_handoff_on = input.targetHandoffOn;
  if (input.furnishingScope !== undefined) patch.furnishing_scope = input.furnishingScope;
  if (input.modules !== undefined) patch.modules = input.modules;
  if (input.poolLocation !== undefined) patch.pool_location = input.poolLocation;

  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.externalRefs !== undefined) patch.external_refs = input.externalRefs;

  const { data, error } = await supabase
    .from("onboarding_projects")
    .update(patch)
    .eq("id", input.projectId)
    .eq("property_id", current.data.property_id)
    .eq("updated_at", current.data.updated_at)
    .eq("status", current.data.status)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("The project changed. Refresh before saving your changes.");

  const scopeChanged = input.modules !== undefined || input.furnishingScope !== undefined;
  if (scopeChanged) {
    await recordProjectEvent(supabase, {
      projectId: data.id,
      propertyId: data.property_id,
      kind: "scope_changed",
      summary: "Project scope updated.",
      detail: input.reason ?? null,
      priorValue: describeScope(current.data),
      newValue: describeScope(data),
      actor: userId,
      isDemo: data.is_demo,
    });
    const nowActiveOwner = (data.modules ?? []).includes("active_owner");
    if (nowActiveOwner) await ensureActiveOwnerEnrollment(supabase, userId, data.property_id);
  } else {
    await recordProjectEvent(supabase, {
      projectId: data.id,
      propertyId: data.property_id,
      kind: "project_updated",
      summary: "Project details updated.",
      detail: input.reason ?? null,
      actor: userId,
      isDemo: data.is_demo,
    });
  }
  return data;
}

function assertProjectLead(project: ProjectRow, userId: string, supervisor: boolean) {
  if (!supervisor && project.project_manager !== userId && project.director !== userId) {
    throw new Error("Only a supervisor or this project's lead can change it.");
  }
}

function describeScope(row: ProjectRow) {
  const furnishing =
    row.furnishing_scope === "no_furnishing"
      ? "Existing home (no furnishing)"
      : row.furnishing_scope === "owner_furnished"
        ? "Owner furnished"
        : "Full furnishing";
  const pool = row.pool_location && row.pool_location !== "none" ? [`pool: ${row.pool_location}`] : [];
  return [furnishing, ...pool, ...(row.modules ?? [])].join(", ");
}


/**
 * Active Owner is enrolled per PROPERTY, never as a global owner flag.
 *
 * If the owner already runs a participation program, this home joins it; if
 * not, a draft program is created for this home. The 90-day clock is never
 * started here — staff activate it from the Active Owner board.
 */
export async function ensureActiveOwnerEnrollment(
  supabase: Client,
  userId: string,
  propertyId: string,
) {
  const { createProgram } = await import("./owner-program.server");
  const result = await createProgram(supabase, userId, {
    propertyId,
    ownerName: "",
    ownerEmail: "",
  });
  return { programId: result.programId, created: !result.alreadyExists };
}

/** Canonical Owner contact only; legacy name/email copies never select an identity. */
export async function loadOwnerContacts(supabase: Client, propertyIds: string[]) {
  const ids = [...new Set(propertyIds)];
  const contacts: {
    property_id: string;
    owner_record_id: string;
    owner_name: string | null;
    owner_email: string | null;
    owner_phone: string | null;
    source: string;
    match_status: string;
  }[] = [];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const properties = await readCountedRows(
      supabase
        .from("properties")
        .select("id, owner_record_id", { count: "exact" })
        .in("id", ids.slice(offset, offset + 100))
        .order("id"),
    );
    const ownerIds = [
      ...new Set(
        properties.data.map((p) => p.owner_record_id).filter((id): id is string => Boolean(id)),
      ),
    ];
    if (!ownerIds.length) continue;
    const owners = await readCountedRows(
      supabase
        .from("property_owners")
        .select("id, name, email, phone, source", { count: "exact" })
        .in("id", ownerIds)
        .eq("active", true)
        .order("id"),
    );
    const byId = new Map(owners.data.map((owner) => [owner.id, owner]));
    for (const property of properties.data) {
      const owner = property.owner_record_id ? byId.get(property.owner_record_id) : undefined;
      if (owner)
        contacts.push({
          property_id: property.id,
          owner_record_id: owner.id,
          owner_name: owner.name,
          owner_email: owner.email,
          owner_phone: owner.phone,
          source: owner.source,
          match_status: "canonical",
        });
    }
  }
  return contacts;
}
