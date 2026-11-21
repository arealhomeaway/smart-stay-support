import type { SupabaseClient } from "@supabase/supabase-js";
import {
  enrollmentClosingDate,
  isLiveProgram,
  ownerTypeTurnsOnActiveOwner,
  type OwnerTypeOutcome,
} from "./owner-type-enrollment";
import { enrollmentInput, type EnrollmentInput, type EnrollmentReceipt } from "./active-owner-enrollment";

/** Reason recorded in History when Owner Type turns the Active Owner module on. */
export const OWNER_TYPE_MODULE_REASON = "Owner Type set to Active Owner";

type Loose = SupabaseClient;

/** The existing actions this composes; replaceable only in tests. */
export type OwnerTypeDeps = {
  updateProject: (actor: SupabaseClient, userId: string, input: { projectId: string; modules: string[]; reason: string }) => Promise<unknown>;
  ensureActiveOwnerEnrollment: (actor: SupabaseClient, userId: string, propertyId: string) => Promise<unknown>;
  isActiveOwnerAuthority: (ctx: { supabase: SupabaseClient; userId: string }) => Promise<boolean>;
  mayActOnRecord: (ctx: { supabase: SupabaseClient; userId: string }, isDemo: boolean) => Promise<boolean>;
  enrollFully: (actor: SupabaseClient, userId: string, input: EnrollmentInput) => Promise<EnrollmentReceipt>;
};

const realDeps: OwnerTypeDeps = {
  updateProject: async (actor, userId, input) => {
    const m = await import("./onboarding-project.server");
    return m.updateProject(actor as never, userId, input as never);
  },
  ensureActiveOwnerEnrollment: async (actor, userId, propertyId) => {
    const m = await import("./onboarding-project.server");
    return m.ensureActiveOwnerEnrollment(actor as never, userId, propertyId);
  },
  isActiveOwnerAuthority: async (ctx) => (await import("./owner-welcome.functions")).isActiveOwnerAuthority(ctx),
  mayActOnRecord: async (ctx, isDemo) => (await import("./owner-welcome.functions")).mayActOnRecord(ctx, isDemo),
  enrollFully: async (actor, userId, input) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { enrollFully } = await import("./active-owner-enrollment.server");
    return enrollFully(db, actor, userId, input);
  },
};

/**
 * Owner Type changed to "Active Owner": keep the module in step and enroll the home
 * through the existing one-step Enroll path, as the person who made the change.
 * Never creates a second program and never removes anything. Every failure is
 * returned as an outcome; the Owner Type save itself has already succeeded.
 */
export async function enrollForOwnerType(
  actor: SupabaseClient,
  userId: string,
  input: { projectId: string; before: string | null | undefined; after: string | null | undefined },
  deps: OwnerTypeDeps = realDeps,
): Promise<OwnerTypeOutcome | null> {
  if (!ownerTypeTurnsOnActiveOwner(input.before, input.after)) return null;
  const sb = actor as Loose;
  try {
    const project = await sb
      .from("onboarding_projects")
      .select("id, property_id, modules, planned_closing_on")
      .eq("id", input.projectId)
      .single();
    if (project.error || !project.data) return { kind: "needs_attention", detail: "This home's project could not be read." };
    const propertyId = project.data.property_id as string;

    // 1. Module in step with Owner Type, through the normal scope change (History + reason).
    const modules = (project.data.modules ?? []) as string[];
    if (!modules.includes("active_owner")) {
      try {
        await deps.updateProject(actor, userId, {
          projectId: input.projectId,
          modules: [...modules, "active_owner"],
          reason: OWNER_TYPE_MODULE_REASON,
        });
      } catch (e) {
        return { kind: "needs_attention", detail: e instanceof Error ? e.message : "The Active Owner scope could not be saved." };
      }
    }

    // 2. Already in a live program: nothing more.
    const links = await sb
      .from("owner_program_properties")
      .select("program_id, owner_programs(status, archived_at)")
      .eq("property_id", propertyId)
      .eq("inclusion_status", "included");
    if (links.error) return { kind: "needs_attention", detail: "Could not check this home's Active Owner program." };
    const live = (links.data ?? []).some((l) => {
      type P = { status: string; archived_at: string | null };
      const joined = (l as unknown as { owner_programs: P | P[] | null }).owner_programs;
      const list = Array.isArray(joined) ? joined : joined ? [joined] : [];
      return list.some(isLiveProgram);
    });
    if (live) return { kind: "already_enrolled" };

    // 3. Only the people who can enroll a home run the Enroll path.
    const ctx = { supabase: actor, userId };
    if (!(await deps.isActiveOwnerAuthority(ctx))) return { kind: "needs_authority" };

    const home = await sb
      .from("properties")
      .select("id, owner_record_id, planned_closing_on, actual_closing_on, is_demo")
      .eq("id", propertyId)
      .single();
    if (home.error || !home.data) return { kind: "needs_attention", detail: "This home could not be read." };
    if (!(await deps.mayActOnRecord(ctx, home.data.is_demo === true))) return { kind: "needs_authority" };
    if (!home.data.owner_record_id) return { kind: "needs_owner_record" };
    const owner = await sb
      .from("property_owners")
      .select("id, name, email, active")
      .eq("id", home.data.owner_record_id)
      .single();
    if (owner.error || !owner.data?.active) return { kind: "needs_owner_record" };

    // 4. The program and home link, so the home shows on the Active Owner tab.
    try {
      await deps.ensureActiveOwnerEnrollment(actor, userId, propertyId);
    } catch (e) {
      return { kind: "needs_attention", detail: e instanceof Error ? e.message : "The Active Owner program could not be created." };
    }

    const email = String(owner.data.email ?? "").trim().toLowerCase();
    if (!email) return { kind: "needs_email" };
    const name = String(owner.data.name ?? "").trim();
    if (name.length < 2) return { kind: "needs_attention", detail: "Add the homeowner's name, then finish setup on the Active Owner tab." };
    const closingDate = enrollmentClosingDate({
      actualClosingOn: (home.data.actual_closing_on as string | null) ?? null,
      projectPlannedClosingOn: (project.data.planned_closing_on as string | null) ?? null,
      propertyPlannedClosingOn: (home.data.planned_closing_on as string | null) ?? null,
    });
    if (!closingDate) return { kind: "needs_closing" };

    // 5. The same one-step Enroll path: login, link, closing, activation, cards, welcome.
    const programs = await sb
      .from("owner_programs")
      .select("onboarding_lead, operations_lead, internal_notes")
      .eq("owner_record_id", owner.data.id)
      .eq("is_demo", home.data.is_demo === true)
      .is("archived_at", null)
      .not("status", "in", "(closed,completed,complete)");
    const existing = programs.data?.[0] ?? null;
    const parsed = enrollmentInput.safeParse({
      requestId: crypto.randomUUID(),
      propertyId,
      ownerRecordId: owner.data.id,
      name,
      email,
      closingDate,
      reason: "",
      onboardingLead: existing?.onboarding_lead ?? null,
      operationsLead: existing?.operations_lead ?? null,
      notes: existing?.internal_notes ?? "",
    });
    if (!parsed.success) return { kind: "needs_attention", detail: "Check the homeowner's name, email and closing date on the Active Owner tab." };
    const receipt = await deps.enrollFully(actor, userId, parsed.data);
    if (!receipt.complete) {
      const failed = receipt.steps.find((s) => s.status === "failed");
      return { kind: "needs_attention", detail: failed?.detail ?? "Finish setup on the Active Owner tab." };
    }
    return { kind: "enrolled", email, welcomeHeld: receipt.welcomeHeld };
  } catch (e) {
    return { kind: "needs_attention", detail: e instanceof Error ? e.message : "Finish setup on the Active Owner tab." };
  }
}

/** Owner Type before a save, so only a real change to Active Owner enrolls. */
export async function readOwnerType(actor: SupabaseClient, projectId: string) {
  const r = await (actor as Loose).from("onboarding_projects").select("owner_type").eq("id", projectId).maybeSingle();
  return (r.data?.owner_type as string | null | undefined) ?? null;
}
