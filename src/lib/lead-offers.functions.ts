/**
 * Lead offer writes — the one guarded path for creating leads from the
 * finder, recording offers, and deciding them. All writes run as the caller
 * under the existing leads RLS policies; the staged v2 columns must be
 * applied before these are used (see docs/pending/availability-finder-v2/).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { can, type AppRole } from "./permissions";
import { canUseAvailabilityFinder } from "./availability-finder";
import { formatPropertyLabel } from "./property-label";
import {
  acceptOfferLeadPatch,
  buildLeadInsertForOffer,
  buildOfferInsert,
  leadOutcome,
  offerOutcome,
  validateLeadLost,
  validateOfferDecision,
  type LeadOffer,
} from "./lead-offers";
import type { LeadRow, LeadUpdate } from "./lead-types";
import { LEAD_LOSS_REASONS } from "./leads";

type Client = SupabaseClient<Database>;

async function assertLeadAccess(supabase: Client, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((row) => row.role as AppRole);
  if (error || (!can(roles, "leads_work") && !canUseAvailabilityFinder(roles)))
    throw new Error("Leads are for authorized Operations staff only.");
}

async function propertyLabel(supabase: Client, propertyId: string) {
  const { data } = await supabase
    .from("properties")
    .select("id, name, nickname, unit, address_line1, city, state, postal_code")
    .eq("id", propertyId)
    .maybeSingle();
  return data ? formatPropertyLabel(data).primary : "a property";
}

async function logActivity(supabase: Client, leadId: string, userId: string, outcome: string, note?: string) {
  await supabase.from("lead_activity").insert({
    lead_id: leadId,
    channel: "system",
    outcome,
    note: note ?? null,
    actor_id: userId,
  });
}

const searchShape = z.object({
  location: z.string().max(240),
  checkIn: z.string().max(10),
  checkOut: z.string().max(10),
  guests: z.number().int().min(0).max(30).optional(),
  dogs: z.number().int().min(0).max(10).optional(),
  cats: z.number().int().min(0).max(10).optional(),
  minBedrooms: z.number().int().min(0).max(12).optional(),
  inquirySourceId: z.string().uuid().optional(),
});

const whoShape = z.object({
  organization: z.string().max(200).optional(),
  contactName: z.string().max(200).optional(),
  phone: z.string().max(60).optional(),
  email: z.string().max(200).optional(),
});

/** "Offer this property" in the finder: creates the lead when none is attached, then records the offer. */
export const offerPropertyToLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      leadId: z.string().uuid().optional(),
      propertyId: z.string().uuid(),
      search: searchShape,
      who: whoShape.optional(),
      quoteTotal: z.number().min(0).max(10000000).nullable().optional(),
      quoteCurrency: z.string().max(8).nullable().optional(),
    }).parse(input))
  .handler(async ({ context, data }) => {
    await assertLeadAccess(context.supabase, context.userId);
    let leadId = data.leadId ?? null;
    if (leadId) {
      const { data: lead, error } = await context.supabase.from("leads").select("id, stage").eq("id", leadId).maybeSingle();
      if (error) throw error;
      if (!lead) throw new Error("That lead no longer exists.");
      if (leadOutcome(lead as LeadRow) !== "open") throw new Error("This lead is already closed, so no new offer can be added.");
    } else {
      const insert = buildLeadInsertForOffer(data.search, data.who ?? {}, context.userId);
      const { data: created, error } = await context.supabase
        .from("leads")
        .insert(insert as never)
        .select("id")
        .single();
      if (error) throw error;
      leadId = created.id;
    }
    const label = await propertyLabel(context.supabase, data.propertyId);
    const offer = buildOfferInsert(
      leadId,
      data.propertyId,
      { total: data.quoteTotal ?? null, currency: data.quoteCurrency ?? null },
      context.userId,
    );
    const { data: saved, error } = await context.supabase
      .from("lead_properties")
      .insert(offer as never)
      .select("id")
      .single();
    if (error) throw error;
    await logActivity(context.supabase, leadId, context.userId, `Offered ${label}`);
    return { leadId, offerId: saved.id };
  });

/** Mark a waiting offer Declined (reason required) or Accepted (books the lead on that home). */
export const decideLeadOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      offerId: z.string().uuid(),
      decision: z.enum(["declined", "accepted"]),
      reason: z.string().max(500).optional(),
    }).parse(input))
  .handler(async ({ context, data }) => {
    await assertLeadAccess(context.supabase, context.userId);
    const problem = validateOfferDecision(data.decision, data.reason);
    if (problem) throw new Error(problem);
    const { data: offer, error } = await context.supabase
      .from("lead_properties")
      .select("*")
      .eq("id", data.offerId)
      .maybeSingle();
    if (error) throw error;
    if (!offer) throw new Error("That offer no longer exists.");
    const row = offer as unknown as LeadOffer;
    if (offerOutcome(row) !== "waiting") throw new Error("This offer already has an answer.");
    const now = new Date();
    const { error: updateError } = await context.supabase
      .from("lead_properties")
      .update({
        outcome: data.decision,
        outcome_reason: data.decision === "declined" ? data.reason!.trim() : null,
        outcome_at: now.toISOString(),
        outcome_by: context.userId,
      } as never)
      .eq("id", data.offerId);
    if (updateError) throw updateError;
    const label = await propertyLabel(context.supabase, row.property_id);
    if (data.decision === "accepted") {
      const patch = acceptOfferLeadPatch(row, context.userId, now);
      const { error: leadError } = await context.supabase.from("leads").update(patch).eq("id", row.lead_id);
      if (leadError) throw leadError;
      await logActivity(context.supabase, row.lead_id, context.userId, `Booked at ${label}`);
    } else {
      await logActivity(context.supabase, row.lead_id, context.userId, `${label} declined`, data.reason);
    }
    return { leadId: row.lead_id };
  });

/** Close a lead as Lost; the reason is required. */
export const markLeadLost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      leadId: z.string().uuid(),
      reason: z.enum(LEAD_LOSS_REASONS),
      note: z.string().max(500).optional(),
    }).parse(input))
  .handler(async ({ context, data }) => {
    await assertLeadAccess(context.supabase, context.userId);
    const problem = validateLeadLost(data.reason, data.note);
    if (problem) throw new Error(problem);
    const patch: LeadUpdate = {
      stage: "lost",
      lost_at: new Date().toISOString(),
      lost_reason: data.reason,
      lost_note: data.note?.trim() || null,
    };
    const { error } = await context.supabase.from("leads").update(patch).eq("id", data.leadId);
    if (error) throw error;
    await logActivity(context.supabase, data.leadId, context.userId, "Closed as lost", data.note);
    return { leadId: data.leadId };
  });

/** Who-details and the next follow-up date, editable at any time. */
export const updateLeadDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      leadId: z.string().uuid(),
      who: whoShape.optional(),
      nextFollowUpOn: z.string().max(10).nullable().optional(),
    }).parse(input))
  .handler(async ({ context, data }) => {
    await assertLeadAccess(context.supabase, context.userId);
    const patch: Record<string, unknown> = {};
    if (data.who) {
      const blank = (value: string | undefined) => (value?.trim() ? value.trim() : null);
      patch.company = blank(data.who.organization);
      patch.contact_name = blank(data.who.contactName);
      patch.phone = blank(data.who.phone);
      patch.email = blank(data.who.email);
    }
    if (data.nextFollowUpOn !== undefined) patch.next_follow_up_on = data.nextFollowUpOn || null;
    if (Object.keys(patch).length === 0) return { leadId: data.leadId };
    const { error } = await context.supabase.from("leads").update(patch as never).eq("id", data.leadId);
    if (error) throw error;
    return { leadId: data.leadId };
  });
