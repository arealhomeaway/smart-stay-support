/**
 * Site visits (server-only).
 *
 * Check-in/out is written with the admin client after we confirm the caller is
 * either the vendor the job was dispatched to or internal staff. Coordinates
 * are compared against the home's geocoded pin so the timeline shows a
 * verified arrival rather than a self-reported one.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { MAX_TRUSTED_ACCURACY_M, ON_SITE_RADIUS_M, distanceMeters, formatOnSite } from "@/lib/visits";

type Client = SupabaseClient<Database>;

export type Fix = { lat: number; lng: number; accuracy: number } | null;

async function loadJobForCaller(supabase: Client, ticketId: string, userId: string) {
  const { data: ticket, error } = await supabase
    .from("tickets")
    .select("id, ref, title, property_id, vendor_user_id, properties(name, latitude, longitude)")
    .eq("id", ticketId)
    .maybeSingle();
  if (error) throw error;
  if (!ticket) throw new Error("That job isn't available to you.");

  if (ticket.vendor_user_id !== userId) {
    const { data: staff } = await supabase.rpc("is_staff", { _user_id: userId });
    if (!staff) throw new Error("Only the vendor assigned to this job can check in.");
  }
  return ticket;
}

function measure(fix: Fix, home: { latitude: number | null; longitude: number | null } | null) {
  if (!fix) return { distance: null as number | null, verified: false };
  if (home?.latitude == null || home.longitude == null) return { distance: null, verified: false };
  const distance = distanceMeters(fix, { lat: home.latitude, lng: home.longitude });
  const verified = distance <= ON_SITE_RADIUS_M && fix.accuracy <= MAX_TRUSTED_ACCURACY_M;
  return { distance, verified };
}

async function log(ticketId: string, authorId: string, body: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("ticket_activity").insert({
    ticket_id: ticketId,
    author_id: authorId,
    kind: "note",
    event_type: "note",
    channel: "vendor_portal",
    body,
  });
}

export async function checkIn(supabase: Client, userId: string, ticketId: string, fix: Fix) {
  const ticket = await loadJobForCaller(supabase, ticketId, userId);
  const home = (ticket.properties ?? null) as { name: string; latitude: number | null; longitude: number | null } | null;
  const { distance, verified } = measure(fix, home);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: open } = await supabaseAdmin
    .from("ticket_visits")
    .select("id")
    .eq("ticket_id", ticketId)
    .eq("vendor_user_id", userId)
    .is("checked_out_at", null)
    .maybeSingle();
  if (open) throw new Error("You're already checked in on this job — check out when you leave.");

  const { data: visit, error } = await supabaseAdmin
    .from("ticket_visits")
    .insert({
      ticket_id: ticketId,
      property_id: ticket.property_id,
      vendor_user_id: userId,
      checked_in_at: new Date().toISOString(),
      check_in_lat: fix?.lat ?? null,
      check_in_lng: fix?.lng ?? null,
      check_in_accuracy_m: fix?.accuracy ?? null,
      check_in_distance_m: distance,
      check_in_verified: verified,
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabaseAdmin
    .from("tickets")
    .update({ vendor_status: "on_site", vendor_accepted_at: new Date().toISOString() })
    .eq("id", ticketId)
    .is("vendor_accepted_at", null);
  await supabaseAdmin.from("tickets").update({ vendor_status: "on_site" }).eq("id", ticketId);

  await log(
    ticketId,
    userId,
    verified
      ? `Vendor checked in on site at ${home?.name ?? "the home"} (${distance} m from the pin).`
      : distance != null
        ? `Vendor checked in — phone location was ${distance} m from the home, so arrival is unconfirmed.`
        : "Vendor checked in without sharing location, so arrival is unconfirmed.",
  );

  return { ok: true as const, visitId: visit.id, verified, distance };
}

export async function checkOut(
  supabase: Client,
  userId: string,
  input: { ticketId: string; fix: Fix; notes?: string },
) {
  const ticket = await loadJobForCaller(supabase, input.ticketId, userId);
  const home = (ticket.properties ?? null) as { name: string; latitude: number | null; longitude: number | null } | null;
  const { distance, verified } = measure(input.fix, home);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: open, error: openError } = await supabaseAdmin
    .from("ticket_visits")
    .select("id, checked_in_at")
    .eq("ticket_id", input.ticketId)
    .eq("vendor_user_id", userId)
    .is("checked_out_at", null)
    .maybeSingle();
  if (openError) throw openError;
  if (!open) throw new Error("You aren't checked in on this job yet.");

  const now = new Date();
  const minutes = Math.max(
    1,
    Math.round((now.getTime() - new Date(open.checked_in_at).getTime()) / 60000),
  );

  const { error } = await supabaseAdmin
    .from("ticket_visits")
    .update({
      checked_out_at: now.toISOString(),
      check_out_lat: input.fix?.lat ?? null,
      check_out_lng: input.fix?.lng ?? null,
      check_out_accuracy_m: input.fix?.accuracy ?? null,
      check_out_distance_m: distance,
      check_out_verified: verified,
      minutes_on_site: minutes,
      notes: input.notes?.trim() || null,
    })
    .eq("id", open.id);
  if (error) throw error;

  await supabaseAdmin.from("tickets").update({ vendor_status: "accepted" }).eq("id", input.ticketId);

  await log(
    input.ticketId,
    userId,
    `Vendor checked out after ${formatOnSite(minutes)} on site${
      verified ? " (location confirmed at the home)" : ""
    }.${input.notes?.trim() ? `\n\n${input.notes.trim()}` : ""}`,
  );

  return { ok: true as const, minutes, verified, distance };
}

export async function loadVisits(supabase: Client, ticketId: string) {
  const { data, error } = await supabase
    .from("ticket_visits")
    .select(
      "id, ticket_id, vendor_user_id, checked_in_at, check_in_distance_m, check_in_verified, checked_out_at, check_out_distance_m, check_out_verified, minutes_on_site, notes",
    )
    .eq("ticket_id", ticketId)
    .order("checked_in_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
