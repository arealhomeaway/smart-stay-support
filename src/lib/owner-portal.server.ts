/**
 * The homeowner's own view of their participation program (server-only).
 *
 * One homeowner, one program, one 90-day clock, one combined hour
 * commitment — across every home attached to the program. Ticket visibility
 * is automatic: enrolling a property is what turns on the feed. Internal
 * staff chatter is never included.
 *
 * Time is only ever what the homeowner typed in. Nothing here prefills,
 * estimates, multiplies by property count or duplicates an entry.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { PROGRAM_DAYS } from "./owner-program";
import { loadProgramAggregate, recordEvent } from "./owner-participation.server";
import { syncBadges } from "./owner-badges.server";

type Client = SupabaseClient<Database>;

export type OwnerTicket = {
  id: string;
  ref: number;
  property_id: string | null;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  reported_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
};

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Everything the owner hub renders, in one round trip. */
export async function loadOwnerHome(supabase: Client, userId: string) {
  const program = await supabase
    .from("owner_programs")
    .select("id")
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (program.error) throw program.error;
  if (!program.data) return { linked: false as const };
  return loadOwnerHomeByProgram(supabase, program.data.id);
}

/**
 * Read-only sample of the homeowner hub for a Platform Owner previewing the
 * portal. It never links anything to the admin's own account — it just opens
 * the most recently created program so the admin can see the real interface.
 */
export async function loadOwnerHomePreview(supabase: Client, userId: string) {
  const { assertAdmin } = await import("./access.server");
  await assertAdmin(supabase, userId);
  const program = await supabase
    .from("owner_programs")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (program.error) throw program.error;
  if (!program.data) return { linked: false as const, preview: true as const };
  return { ...(await loadOwnerHomeByProgram(supabase, program.data.id)), preview: true as const };
}

async function loadOwnerHomeByProgram(supabase: Client, programId: string) {
  const agg = await loadProgramAggregate(supabase, programId);

  const propertyIds = agg.properties.map((p) => p.propertyId);

  const [alerts, tickets] = await Promise.all([
    supabase
      .from("owner_notifications")
      .select(
        "id, kind, priority, title, body, ticket_id, review_id, read_at, email_status, sms_status, created_at",
      )
      .eq("program_id", agg.program.id)
      .order("created_at", { ascending: false })
      .limit(60),
    propertyIds.length
      ? supabase
          .from("tickets")
          .select(
            "id, ref, property_id, title, description, category, priority, status, reported_at, resolved_at, resolution_notes",
          )
          .in("property_id", propertyIds)
          .order("reported_at", { ascending: false })
          .limit(120)
      : Promise.resolve({ data: [], error: null } as const),
  ]);
  if (alerts.error) throw alerts.error;
  if (tickets.error) throw tickets.error;

  // Keep achievements current whenever the owner opens the hub.
  await syncBadges(supabase, agg);
  const badges = await supabase
    .from("owner_badges")
    .select("code, awarded_at, trigger_rule, needs_review")
    .eq("program_id", agg.program.id)
    .order("awarded_at");

  return {
    linked: true as const,
    program: agg.program,
    properties: agg.properties,
    reviews: agg.reviews,
    entries: agg.entries,
    badges: badges.data ?? agg.badges,
    alerts: alerts.data ?? [],
    tickets: (tickets.data ?? []) as OwnerTicket[],
    reportedMinutes: agg.reportedMinutes,
    onboardingMinutes: agg.onboardingMinutes,
    operationalMinutes: agg.operationalMinutes,
    snapshot: agg.snapshot,
  };
}

export async function markAlertsRead(supabase: Client, ids: string[]) {
  if (ids.length === 0) return { ok: true as const };
  const { error } = await supabase
    .from("owner_notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids)
    .is("read_at", null);
  if (error) throw error;
  return { ok: true as const };
}

/** Owner-controlled alert channels. Only their own program is reachable. */
export async function saveAlertPreferences(
  supabase: Client,
  userId: string,
  input: { email: boolean; smsP1: boolean; push: boolean; phone: string },
) {
  const { error } = await supabase
    .from("owner_programs")
    .update({
      notify_email: input.email,
      notify_sms_p1: input.smsP1,
      notify_push: input.push,
      owner_phone: input.phone || null,
    })
    .eq("owner_user_id", userId);
  if (error) throw error;
  return { ok: true as const };
}

export type LogTimeInput = {
  programId: string;
  phase: "onboarding" | "ongoing";
  entryDate: string;
  minutes: number;
  activity: string;
  activityCategory: string;
  output: string;
  comments: string;
  attachmentPath: string | null;
  reviewId: string | null;
  ticketId: string | null;
  propertyIds: string[];
};

/**
 * One activity, one entry, one canonical minutes value. A shared activity is
 * linked to several homes but its minutes are stored exactly once, so the
 * combined total can never double count.
 */
export async function logOwnerTime(supabase: Client, userId: string, input: LogTimeInput) {
  const links = await supabase
    .from("owner_program_properties")
    .select("property_id, closing_date, inclusion_status")
    .eq("program_id", input.programId);
  if (links.error) throw links.error;

  const allowed = new Map((links.data ?? []).map((l) => [l.property_id, l]));
  const chosen = [...new Set(input.propertyIds)].filter((id) => allowed.has(id));
  for (const id of chosen) {
    const link = allowed.get(id)!;
    // A home cannot carry participation from before it closed.
    if (link.closing_date && input.entryDate < link.closing_date) {
      throw new Error(
        "That date is before this property's closing date. Please choose a date on or after closing.",
      );
    }
  }

  const { data, error } = await supabase
    .from("owner_time_entries")
    .insert({
      program_id: input.programId,
      owner_user_id: userId,
      phase: input.phase,
      entry_date: input.entryDate,
      minutes: input.minutes,
      activity: input.activity,
      activity_category: input.activityCategory || null,
      decision_outcome: input.output || null,
      output: input.output || null,
      comments: input.comments || null,
      attachment_path: input.attachmentPath,
      review_id: input.reviewId,
      ticket_id: input.ticketId,
      attested: true,
    })
    .select("id")
    .single();
  if (error) throw error;

  if (chosen.length > 0) {
    const link = await supabase
      .from("owner_time_entry_properties")
      .insert(chosen.map((property_id) => ({ entry_id: data.id, property_id })));
    if (link.error) throw link.error;
    await supabase
      .from("owner_program_properties")
      .update({ last_owner_activity_at: new Date().toISOString() })
      .eq("program_id", input.programId)
      .in("property_id", chosen);
  }

  await supabase
    .from("owner_programs")
    .update({ last_owner_activity_at: new Date().toISOString() })
    .eq("id", input.programId);

  await recordEvent(supabase, {
    programId: input.programId,
    kind: "time_entry",
    summary: `${input.minutes} minutes reported: ${input.activity}`,
    actorId: userId,
    entryId: data.id,
    reviewId: input.reviewId,
    newValue: String(input.minutes),
    detail: { propertyIds: chosen, phase: input.phase, category: input.activityCategory },
  });

  const agg = await loadProgramAggregate(supabase, input.programId);
  const badges = await syncBadges(supabase, agg);
  return { ok: true as const, entryId: data.id, awarded: badges.awarded };
}

/** Owner answers a task that was waiting on them. */
export async function respondToReview(
  supabase: Client,
  userId: string,
  input: { reviewId: string; decision: string; response: string },
) {
  const review = await supabase
    .from("owner_reviews")
    .select("id, program_id, title")
    .eq("id", input.reviewId)
    .single();
  if (review.error) throw review.error;

  const { error } = await supabase
    .from("owner_reviews")
    .update({
      owner_decision: input.decision,
      owner_response: input.response || null,
      status: "answered",
      responded_at: new Date().toISOString(),
    })
    .eq("id", input.reviewId);
  if (error) throw error;

  await recordEvent(supabase, {
    programId: review.data.program_id,
    kind: "owner_decision",
    summary: `Decision on “${review.data.title}”: ${input.decision}`,
    actorId: userId,
    reviewId: input.reviewId,
    newValue: input.decision,
  });

  const agg = await loadProgramAggregate(supabase, review.data.program_id);
  await syncBadges(supabase, agg);
  return { ok: true as const };
}

/**
 * Single-use invite redemption. Runs with elevated access because it links an
 * auth account to a program and grants the owner role — both are outside what
 * a brand-new signed-in user can do for themselves.
 */
export async function redeemOwnerInvite(
  admin: Client,
  userId: string,
  userEmail: string | null,
  code: string,
) {
  const invite = await admin
    .from("owner_invites")
    .select("id, program_id, expires_at, redeemed_by, owner_email")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();
  if (invite.error) throw invite.error;
  if (!invite.data) throw new Error("That code was not recognized. Check it and try again.");
  if (invite.data.redeemed_by) throw new Error("That code has already been used.");
  if (new Date(invite.data.expires_at).getTime() < Date.now()) {
    throw new Error("That code has expired. Ask your ARHA contact for a new one.");
  }

  const program = await admin
    .from("owner_programs")
    .select("id, owner_user_id, started_on, status")
    .eq("id", invite.data.program_id)
    .single();
  if (program.error) throw program.error;
  if (program.data.owner_user_id && program.data.owner_user_id !== userId) {
    throw new Error("This program is already linked to another owner account.");
  }

  // Redeeming a code links the account. It does not start the 90-day clock:
  // only an authorized ARHA team member activates a program.
  const updates = await admin
    .from("owner_programs")
    .update({
      owner_user_id: userId,
      owner_email: invite.data.owner_email ?? userEmail,
      ends_on: program.data.started_on ? addDays(program.data.started_on, PROGRAM_DAYS - 1) : null,
    })
    .eq("id", program.data.id);
  if (updates.error) throw updates.error;

  const roleInsert = await admin
    .from("user_roles")
    .upsert({ user_id: userId, role: "owner" }, { onConflict: "user_id,role" });
  if (roleInsert.error) throw roleInsert.error;

  // New signups get the default staff role; a homeowner is not internal staff.
  await admin.from("user_roles").delete().eq("user_id", userId).eq("role", "tech");

  const redeem = await admin
    .from("owner_invites")
    .update({ redeemed_by: userId, redeemed_at: new Date().toISOString() })
    .eq("id", invite.data.id)
    .is("redeemed_by", null);
  if (redeem.error) throw redeem.error;

  await recordEvent(admin, {
    programId: program.data.id,
    kind: "owner_linked",
    summary: "Homeowner connected their account with an invite code.",
    actorId: userId,
  });

  return { ok: true as const, programId: program.data.id };
}
