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
import { defaultModules, type FurnishingScope, type ModuleKey } from "./onboarding-scope";
import { writeAudit } from "./audit.server";

type Client = SupabaseClient<Database>;

export type ProjectRow = Database["public"]["Tables"]["onboarding_projects"]["Row"];

async function assertOnboardingStaff(supabase: Client, userId: string) {
  const [staff, supervisor] = await Promise.all([
    supabase.rpc("is_onboarding_staff", { _user_id: userId }),
    supabase.rpc("is_supervisor", { _user_id: userId }),
  ]);
  if (!staff.data && !supervisor.data) {
    throw new Error("You do not have access to change onboarding projects.");
  }
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
export async function loadProjects(supabase: Client) {
  const { data, error } = await supabase
    .from("onboarding_projects")
    .select("*")
    .order("started_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
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
  return { project: project.data ?? null, events: events.data ?? [] };
}

export type StartProjectInput = {
  propertyId: string;
  branch: string | null;
  projectManager: string | null;
  director: string | null;
  plannedClosingOn: string | null;
  possessionOn: string | null;
  targetHandoffOn: string | null;
  furnishingScope: FurnishingScope;
  modules: ModuleKey[];
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
  await assertOnboardingStaff(supabase, userId);

  const property = await supabase
    .from("properties")
    .select("id, name, is_demo, lifecycle_status, planned_closing_on, actual_access_on, onboarding_owner")
    .eq("id", input.propertyId)
    .single();
  if (property.error) throw property.error;

  const existing = await supabase
    .from("onboarding_projects")
    .select("id")
    .eq("property_id", input.propertyId)
    .neq("status", "cancelled")
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) throw new Error("Onboarding has already been started for this home.");

  const modules = input.modules.length ? input.modules : defaultModules();

  const { data, error } = await supabase
    .from("onboarding_projects")
    .insert({
      property_id: input.propertyId,
      status: "active",
      branch: input.branch,
      project_manager: input.projectManager,
      director: input.director,
      planned_closing_on: input.plannedClosingOn,
      possession_on: input.possessionOn,
      target_handoff_on: input.targetHandoffOn,
      furnishing_scope: input.furnishingScope,
      modules,
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
  if (!property.data.onboarding_owner && input.projectManager) {
    patch.onboarding_owner = input.projectManager;
  }
  if (property.data.lifecycle_status !== "onboarding") patch.lifecycle_status = "onboarding";
  patch.onboarding_started_at = new Date().toISOString();
  const update = await supabase.from("properties").update(patch).eq("id", input.propertyId);
  if (update.error) throw update.error;

  if (modules.includes("active_owner")) {
    await ensureActiveOwnerEnrollment(supabase, userId, input.propertyId);
  }

  await recordProjectEvent(supabase, {
    projectId: data.id,
    propertyId: input.propertyId,
    kind: "project_started",
    summary: `Onboarding started for ${property.data.name}.`,
    detail: `Scope: ${input.furnishingScope === "no_furnishing" ? "No furnishings" : "Full furnishing"}.`,
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
    plannedClosingOn?: string | null | undefined;
    possessionOn?: string | null | undefined;
    targetHandoffOn?: string | null | undefined;
    furnishingScope?: FurnishingScope | undefined;
    modules?: ModuleKey[] | undefined;
    notes?: string | null | undefined;
    reason?: string | null | undefined;
  },
) {
  await assertOnboardingStaff(supabase, userId);

  const current = await supabase
    .from("onboarding_projects")
    .select("*")
    .eq("id", input.projectId)
    .single();
  if (current.error) throw current.error;

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
  if (input.plannedClosingOn !== undefined) patch.planned_closing_on = input.plannedClosingOn;
  if (input.possessionOn !== undefined) patch.possession_on = input.possessionOn;
  if (input.targetHandoffOn !== undefined) patch.target_handoff_on = input.targetHandoffOn;
  if (input.furnishingScope !== undefined) patch.furnishing_scope = input.furnishingScope;
  if (input.modules !== undefined) patch.modules = input.modules;
  if (input.notes !== undefined) patch.notes = input.notes;

  const { data, error } = await supabase
    .from("onboarding_projects")
    .update(patch)
    .eq("id", input.projectId)
    .select("*")
    .single();
  if (error) throw error;

  const scopeChanged =
    input.modules !== undefined || input.furnishingScope !== undefined;
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
    const nowActiveOwner =
      (data.modules ?? []).includes("active_owner") &&
      !(current.data.modules ?? []).includes("active_owner");
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

function describeScope(row: ProjectRow) {
  const furnishing = row.furnishing_scope === "no_furnishing" ? "No furnishings" : "Full furnishing";
  return [furnishing, ...(row.modules ?? [])].join(", ");
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
  const existing = await supabase
    .from("owner_program_properties")
    .select("program_id")
    .eq("property_id", propertyId)
    .eq("inclusion_status", "included")
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return { programId: existing.data.program_id, created: false as const };

  const contact = await supabase
    .from("property_owner_contacts")
    .select("owner_name, owner_email")
    .eq("property_id", propertyId)
    .maybeSingle();

  const { createProgram } = await import("./owner-program.server");
  const result = await createProgram(supabase, userId, {
    propertyId,
    ownerName: contact.data?.owner_name ?? "",
    ownerEmail: contact.data?.owner_email ?? "",
  });
  return { programId: result.programId, created: !result.alreadyExists };
}

/** Owner name, phone and email for the staff-facing contact strip. */
export async function loadOwnerContacts(supabase: Client, propertyIds: string[]) {
  if (propertyIds.length === 0) return [];
  const { data, error } = await supabase
    .from("property_owner_contacts")
    .select("property_id, owner_name, owner_email, owner_phone, source, match_status")
    .in("property_id", propertyIds);
  if (error) throw error;
  return data ?? [];
}
