/**
 * Moving a home between Onboarding and Active operations (server-only).
 *
 * Enrolling a home in the Active Owner program records participation; it does
 * not decide where the home is worked. That is this switch, and it is
 * deliberate: a supervisor says where the home belongs and why, and Resolve
 * makes the rest true in one step.
 *
 * Moving to Onboarding is never destructive. An existing project is reopened
 * with its tasks, notes and history intact; only a home with no plan gets one
 * created.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { writeAudit } from "./audit.server";

type Client = SupabaseClient<Database>;

export type LifecycleTarget = "onboarding" | "active_operations";

/** Throws unless the caller can decide where a home is worked. */
async function assertSupervisor(supabase: Client, userId: string) {
  const { data, error } = await supabase.rpc("is_supervisor", { _user_id: userId });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("Only a manager or supervisor can move a home between stages.");
}

export async function switchPropertyLifecycle(
  supabase: Client,
  userId: string,
  input: { propertyId: string; target: LifecycleTarget; reason: string },
) {
  await assertSupervisor(supabase, userId);

  const before = await supabase
    .from("properties")
    .select("id, name, lifecycle_status, is_demo, onboarding_started_at")
    .eq("id", input.propertyId)
    .maybeSingle();
  if (before.error) throw before.error;
  if (!before.data) throw new Error("That property is not available.");

  const current = before.data.lifecycle_status ?? "active_operations";
  if (current === input.target) {
    return { ok: true as const, changed: false, createdTasks: 0, reopenedProject: false };
  }

  let createdTasks = 0;
  let reopenedProject = false;

  if (input.target === "onboarding") {
    // An existing project comes back exactly as the team left it.
    const project = await supabase
      .from("onboarding_projects")
      .select("id, status")
      .eq("property_id", input.propertyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (project.error) throw project.error;

    if (project.data && !["active", "planning"].includes(project.data.status ?? "")) {
      const reopen = await supabase
        .from("onboarding_projects")
        .update({ status: "active" })
        .eq("id", project.data.id);
      if (reopen.error) throw reopen.error;
      reopenedProject = true;
    }

    const patch: Database["public"]["Tables"]["properties"]["Update"] = {
      lifecycle_status: "onboarding",
    };
    if (!before.data.onboarding_started_at) patch.onboarding_started_at = new Date().toISOString();
    const moved = await supabase.from("properties").update(patch).eq("id", input.propertyId);
    if (moved.error) throw moved.error;

    if (!project.data) {
      // No project at all: start one properly, which also builds the plan.
      const { startOnboardingProject } = await import("./onboarding-project.server");
      const { defaultModules } = await import("./onboarding-scope");
      const enrolled = await supabase
        .from("owner_program_properties")
        .select("id")
        .eq("property_id", input.propertyId)
        .limit(1);
      if (enrolled.error) throw enrolled.error;
      await startOnboardingProject(supabase, userId, {
        propertyId: input.propertyId,
        branch: null,
        projectManager: null,
        director: null,
        plannedClosingOn: null,
        possessionOn: null,
        targetHandoffOn: null,
        furnishingScope: "full_furnishing",
        modules: (enrolled.data ?? []).length
          ? [...defaultModules(), "active_owner" as const]
          : defaultModules(),
        poolLocation: "none",
        notes: null,
        externalRefs: {},
      });
    } else {
      // The plan may be missing on a project that was opened but never filled.
      // applyOnboardingTemplate deduplicates by title, so existing work is safe.
      const { applyOnboardingTemplate } = await import("./onboarding-template.server");
      const applied = await applyOnboardingTemplate(supabase, userId, {
        propertyId: input.propertyId,
      });
      createdTasks = applied.created;
    }
  } else {
    const moved = await supabase
      .from("properties")
      .update({ lifecycle_status: "active_operations" })
      .eq("id", input.propertyId);
    if (moved.error) {
      // The database keeps the handoff review chain as the only way out of
      // onboarding, so say that plainly instead of leaking the raw guard text.
      if (current === "onboarding") {
        throw new Error(
          "A home leaves onboarding through the handoff review, not this switch. Send it for handoff from the onboarding hub.",
        );
      }
      throw new Error(moved.error.message);
    }
  }

  await writeAudit({
    actorId: userId,
    action: "property_lifecycle_switched",
    entityType: "property",
    entityId: input.propertyId,
    entityLabel: before.data.name,
    reason: input.reason,
    before: { lifecycle_status: current },
    after: { lifecycle_status: input.target, createdTasks, reopenedProject },
  });

  return { ok: true as const, changed: true, createdTasks, reopenedProject };
}
