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
import { recordEvent } from "./owner-participation.server";
import { opportunityDecisionPath, type OwnerActionType } from "./owner-opportunity";

type Client = SupabaseClient<Database>;

const INACTIVE_PROGRAM = new Set(["closed", "completed"]);

export type OfferInput = {
  source: "onboarding" | "operations";
  sourceId: string;
  title: string;
  instructions: string;
  actionType: OwnerActionType;
  availableFrom: string | null;
  respondBy: string | null;
  staffContext: string;
};

type SourceContext = {
  propertyId: string | null;
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
      .select("id, property_id, title, detail, stage")
      .eq("id", sourceId)
      .single();
    if (task.error) throw task.error;
    return {
      propertyId: task.data.property_id,
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
    .select("id, property_id, title, description")
    .eq("id", sourceId)
    .single();
  if (ticket.error) throw ticket.error;
  return {
    propertyId: ticket.data.property_id,
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
  source: "onboarding" | "operations",
  sourceId: string,
) {
  const ctx = await loadSource(supabase, source, sourceId);
  if (!ctx.propertyId) return { eligible: false as const, reason: "no_property" as const };
  const link = await programForProperty(supabase, ctx.propertyId);
  if (!link) return { eligible: false as const, reason: "no_program" as const };

  const query = supabase
    .from("owner_reviews")
    .select("id, title, status, owner_action_type, available_from, respond_by, source_type")
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
    ownerName: link.ownerName,
    propertyId: ctx.propertyId,
    defaultTitle: ctx.defaultTitle,
    defaultInstructions: ctx.defaultInstructions,
    existing: existing.data ?? null,
  };
}

/** Creates the opportunity. Idempotent per source record. */
export async function offerToOwner(supabase: Client, userId: string, input: OfferInput) {
  const ctx = await loadSource(supabase, input.source, input.sourceId);
  if (!ctx.propertyId) throw new Error("This work is not attached to a property.");
  const link = await programForProperty(supabase, ctx.propertyId);
  if (!link) throw new Error("This property is not part of an active owner participation program.");

  const insert = await supabase
    .from("owner_reviews")
    .insert({
      program_id: link.programId,
      property_id: ctx.propertyId,
      task_type: "property_specific",
      source_type: input.source,
      onboarding_task_id: ctx.onboardingTaskId,
      ticket_id: ctx.ticketId,
      owner_action_type: input.actionType,
      available_from: input.availableFrom,
      respond_by: input.respondBy,
      staff_context: input.staffContext || null,
      phase: ctx.phase,
      stage: ctx.stage,
      title: input.title,
      recommendation: input.instructions,
      business_question: input.instructions,
      decision_path: opportunityDecisionPath(input.actionType),
      status: "awaiting_owner",
      created_by: userId,
    } as never)
    .select("id")
    .single();
  if (insert.error) {
    if (insert.error.code === "23505") {
      throw new Error("This work has already been offered to the homeowner.");
    }
    throw insert.error;
  }

  await supabase
    .from("owner_review_properties")
    .insert({ review_id: insert.data.id, property_id: ctx.propertyId } as never);

  await recordEvent(supabase, {
    programId: link.programId,
    kind: "opportunity_created",
    summary: `Participation opportunity offered: ${input.title}`,
    actorId: userId,
  });

  return { ok: true as const, opportunityId: insert.data.id };
}

/** Withdraw an opportunity without touching the underlying work. */
export async function closeOpportunity(
  supabase: Client,
  userId: string,
  input: { opportunityId: string; reason: string },
) {
  const access = await supabase.rpc("is_internal_staff", { _user_id: userId });
  if (access.error) throw access.error;
  if (!access.data) throw new Error("Only staff may close participation opportunities.");
  const row = await supabase
    .from("owner_reviews")
    .select("id, program_id, title, status, updated_at")
    .eq("id", input.opportunityId)
    .single();
  if (row.error) throw row.error;
  if (row.data.status === "answered") {
    throw new Error("This opportunity is already completed and stays in the owner's record.");
  }

  const { data: saved, error } = await supabase
    .from("owner_reviews")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", input.opportunityId)
    .eq("updated_at", row.data.updated_at)
    .eq("status", row.data.status)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!saved) throw new Error("The opportunity changed. Refresh before closing it.");

  await recordEvent(supabase, {
    programId: row.data.program_id,
    kind: "opportunity_closed",
    summary: `Participation opportunity closed: ${row.data.title}`,
    actorId: userId,
    reason: input.reason || null,
  });
  return { ok: true as const };
}
