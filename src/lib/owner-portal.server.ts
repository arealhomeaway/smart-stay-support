/**
 * The homeowner's own view of their program (server-only).
 *
 * An owner sees exactly one home: the one their program is attached to. Ticket
 * visibility is automatic — enrolling a property in the program is what turns
 * on the feed, so staff never tag tickets by hand. Internal staff chatter is
 * never included: owners get the matter, its clocks and its outcome.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { PROGRAM_DAYS } from "./owner-program";

type Client = SupabaseClient<Database>;

export type OwnerTicket = {
  id: string;
  ref: number;
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

/** Everything the owner hub renders in one round trip. */
export async function loadOwnerHome(supabase: Client, userId: string) {
  const program = await supabase
    .from("owner_programs")
    .select(
      "id, property_id, owner_name, owner_email, owner_phone, status, started_on, ends_on, target_hours, onboarding_target_hours, ongoing_target_hours, notify_email, notify_sms_p1, notify_push, properties(name, nickname, city, state)",
    )
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (program.error) throw program.error;
  if (!program.data) return { linked: false as const };

  const p = program.data;
  const prop = p.properties as unknown as {
    name: string;
    nickname: string | null;
    city: string | null;
    state: string | null;
  } | null;

  const [reviews, entries, alerts, tickets] = await Promise.all([
    supabase
      .from("owner_reviews")
      .select(
        "id, phase, stage, title, recommendation, impact, decision_path, respond_by, status, owner_decision, owner_response, ticket_id, sort_order",
      )
      .eq("program_id", p.id)
      .order("sort_order"),
    supabase
      .from("owner_time_entries")
      .select("id, phase, entry_date, minutes, activity, output, review_id, ticket_id")
      .eq("program_id", p.id)
      .order("entry_date", { ascending: false }),
    supabase
      .from("owner_notifications")
      .select(
        "id, kind, priority, title, body, ticket_id, review_id, read_at, email_status, sms_status, created_at",
      )
      .eq("program_id", p.id)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("tickets")
      .select(
        "id, ref, title, description, category, priority, status, reported_at, resolved_at, resolution_notes",
      )
      .eq("property_id", p.property_id)
      .order("reported_at", { ascending: false })
      .limit(60),
  ]);
  if (reviews.error) throw reviews.error;
  if (entries.error) throw entries.error;
  if (alerts.error) throw alerts.error;
  if (tickets.error) throw tickets.error;

  const minutes = (entries.data ?? []).reduce((n, e) => n + e.minutes, 0);

  return {
    linked: true as const,
    program: {
      id: p.id,
      propertyId: p.property_id,
      propertyName: prop ? prop.nickname || prop.name : "Your home",
      location: prop ? [prop.city, prop.state].filter(Boolean).join(", ") : "",
      ownerName: p.owner_name,
      ownerEmail: p.owner_email,
      ownerPhone: p.owner_phone,
      status: p.status,
      startedOn: p.started_on,
      endsOn: p.ends_on,
      targetHours: Number(p.target_hours),
      onboardingTargetHours: Number(p.onboarding_target_hours),
      ongoingTargetHours: Number(p.ongoing_target_hours),
      notifyEmail: p.notify_email,
      notifySmsP1: p.notify_sms_p1,
      notifyPush: p.notify_push,
    },
    reviews: reviews.data ?? [],
    entries: entries.data ?? [],
    alerts: alerts.data ?? [],
    tickets: (tickets.data ?? []) as OwnerTicket[],
    reportedMinutes: minutes,
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

/** Owner logs the time they actually spent, optionally against a real matter. */
export async function logOwnerTime(
  supabase: Client,
  userId: string,
  input: {
    programId: string;
    phase: "onboarding" | "ongoing";
    entryDate: string;
    minutes: number;
    activity: string;
    output: string;
    reviewId: string | null;
    ticketId: string | null;
  },
) {
  const { error } = await supabase.from("owner_time_entries").insert({
    program_id: input.programId,
    owner_user_id: userId,
    phase: input.phase,
    entry_date: input.entryDate,
    minutes: input.minutes,
    activity: input.activity,
    output: input.output || null,
    review_id: input.reviewId,
    ticket_id: input.ticketId,
    attested: true,
  });
  if (error) throw error;
  return { ok: true as const };
}

/** Owner answers a review that was waiting on them. */
export async function respondToReview(
  supabase: Client,
  input: { reviewId: string; decision: string; response: string },
) {
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

  const startedOn = program.data.started_on ?? new Date().toISOString().slice(0, 10);
  const updates = await admin
    .from("owner_programs")
    .update({
      owner_user_id: userId,
      owner_email: invite.data.owner_email ?? userEmail,
      started_on: startedOn,
      ends_on: addDays(startedOn, PROGRAM_DAYS - 1),
      status: program.data.status === "pending" ? "active" : program.data.status,
    })
    .eq("id", program.data.id);
  if (updates.error) throw updates.error;

  const roleInsert = await admin
    .from("user_roles")
    .upsert({ user_id: userId, role: "owner" }, { onConflict: "user_id,role" });
  if (roleInsert.error) throw roleInsert.error;

  const redeem = await admin
    .from("owner_invites")
    .update({ redeemed_by: userId, redeemed_at: new Date().toISOString() })
    .eq("id", invite.data.id)
    .is("redeemed_by", null);
  if (redeem.error) throw redeem.error;

  return { ok: true as const, programId: program.data.id };
}
