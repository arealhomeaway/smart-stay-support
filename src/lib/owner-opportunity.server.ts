/**
 * Staff-side creation of Active Owner participation opportunities.
 *
 * The canonical work object never moves: an Onboarding task stays an
 * Onboarding task and a Ticket stays a Ticket. Offering it to the homeowner
 * writes one thin `owner_reviews` row that references the source record, so
 * the underlying work is never duplicated and never rewritten.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { type OwnerActionType } from "./owner-opportunity";

type Client = SupabaseClient<Database>;

const INACTIVE_PROGRAM = new Set(["closed", "completed"]);

async function assertOpportunityStaff(supabase: Client, userId: string) {
  const access = await supabase.rpc("is_internal_staff", { _user_id: userId });
  if (access.error) throw access.error;
  if (!access.data) throw new Error("Only staff may manage participation opportunities.");
}

export type OfferInput = {
  source: "onboarding" | "operations";
  sourceId: string;
  programId: string;
  expectedVersion: string;
  expectedOwnerId: string;
  expectedSourceUpdatedAt: string;
  reviewed: true;
  title: string;
  instructions: string;
  actionType: OwnerActionType;
  availableFrom: string | null;
  respondBy: string | null;
  staffContext: string;
};

type SourceContext = {
  propertyId: string | null;
  updatedAt: string;
  defaultTitle: string;
  defaultInstructions: string;
  ticketId: string | null;
  onboardingTaskId: string | null;
  phase: "onboarding" | "ongoing";
  stage: string;
};

async function loadSource(
  supabase: Client,
  source: "onboarding" | "operations",
  sourceId: string,
): Promise<SourceContext> {
  if (source === "onboarding") {
    const task = await supabase
      .from("onboarding_tasks")
      .select("id, property_id, title, detail, stage, updated_at")
      .eq("id", sourceId)
      .single();
    if (task.error) throw task.error;
    return {
      propertyId: task.data.property_id,
      updatedAt: task.data.updated_at,
      defaultTitle: task.data.title,
      defaultInstructions: task.data.detail ?? "",
      ticketId: null,
      onboardingTaskId: task.data.id,
      phase: "onboarding",
      stage: task.data.stage ?? "onboarding",
    };
  }
  const ticket = await supabase
    .from("tickets")
    .select("id, property_id, title, description, updated_at")
    .eq("id", sourceId)
    .single();
  if (ticket.error) throw ticket.error;
  return {
    propertyId: ticket.data.property_id,
    updatedAt: ticket.data.updated_at,
    defaultTitle: ticket.data.title,
    defaultInstructions: ticket.data.description ?? "",
    ticketId: ticket.data.id,
    onboardingTaskId: null,
    phase: "ongoing",
    stage: "operations",
  };
}

async function programForProperty(supabase: Client, propertyId: string) {
  const { activeOwnerFor } = await import("./active-owner.server");
  const link = await activeOwnerFor(supabase, propertyId);
  if (!link || INACTIVE_PROGRAM.has(link.programStatus)) return null;
  return link;
}

/**
 * What the staff-side "offer to owner" control needs: whether this property
 * belongs to an Active Owner program, and whether it has already been offered.
 */
export async function opportunityContext(
  supabase: Client,
  userId: string,
  source: "onboarding" | "operations",
  sourceId: string,
) {
  await assertOpportunityStaff(supabase, userId);
  const ctx = await loadSource(supabase, source, sourceId);
  if (!ctx.propertyId) return { eligible: false as const, reason: "no_property" as const };
  const link = await programForProperty(supabase, ctx.propertyId);
  if (!link) return { eligible: false as const, reason: "no_program" as const };

  const program = await supabase
    .from("owner_programs")
    .select("id, owner_record_id, report_version")
    .eq("id", link.programId)
    .single();
  if (program.error) throw program.error;
  if (!program.data.owner_record_id)
    return { eligible: false as const, reason: "no_program" as const };
  const query = supabase
    .from("owner_reviews")
    .select(
      "id, title, recommendation, status, owner_action_type, available_from, respond_by, source_type, updated_at, auto_ticket, ticket_id, responded_at",
    )
    .eq("program_id", link.programId);
  const existing = await (
    ctx.onboardingTaskId
      ? query.eq("onboarding_task_id", ctx.onboardingTaskId)
      : query.eq("ticket_id", ctx.ticketId!)
  ).maybeSingle();
  if (existing.error) throw existing.error;

  return {
    eligible: true as const,
    programId: link.programId,
    expectedVersion: program.data.report_version,
    expectedOwnerId: program.data.owner_record_id,
    expectedSourceUpdatedAt: ctx.updatedAt,
    ownerName: link.ownerName,
    propertyId: ctx.propertyId,
    defaultTitle: ctx.defaultTitle,
    defaultInstructions: ctx.defaultInstructions,
    existing: existing.data ?? null,
  };
}

/** Creates the opportunity. Idempotent per source record. */
export async function offerToOwner(supabase: Client, userId: string, input: OfferInput) {
  await assertOpportunityStaff(supabase, userId);
  const { data, error } = await supabase.rpc("create_owner_opportunity", {
    _program_id: input.programId,
    _expected_version: input.expectedVersion,
    _expected_owner_id: input.expectedOwnerId,
    _source: input.source,
    _source_id: input.sourceId,
    _expected_source_updated_at: input.expectedSourceUpdatedAt,
    _title: input.title.trim(),
    _instructions: input.instructions.trim(),
    _action_type: input.actionType,
    // Both windows are optional; the database accepts null.
    _available_from: input.availableFrom as unknown as string,
    _respond_by: input.respondBy as unknown as string,
    _staff_context: input.staffContext.trim(),
    _reviewed: input.reviewed,
  });
  if (error) throw error;
  if (!data) throw new Error("The opportunity was not confirmed. Refresh before trying again.");
  return { ok: true as const, opportunityId: data };
}

/** Withdraw an opportunity without touching the underlying work. */
export async function closeOpportunity(
  supabase: Client,
  userId: string,
  input: { opportunityId: string; expectedUpdatedAt: string; reason: string },
) {
  await assertOpportunityStaff(supabase, userId);
  const { data: saved, error } = await supabase.rpc("close_owner_opportunity", {
    _review_id: input.opportunityId,
    _expected_updated_at: input.expectedUpdatedAt,
    _reason: input.reason,
  });
  if (error) throw error;
  if (!saved) throw new Error("The opportunity changed. Refresh before closing it.");
  return { ok: true as const };
}
