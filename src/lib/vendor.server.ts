/**
 * Vendor portal support (server-only).
 *
 * Vendors are outside partners with a login that only reaches the jobs
 * dispatched to them. Listing who the vendors are needs the admin client
 * (profiles of other people are staff-only), so it lives here behind a staff
 * check rather than in the browser.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { VendorCandidate } from "./dispatch";

type Client = SupabaseClient<Database>;

/** Throws unless the caller is internal staff (not an outside vendor). */
export async function assertStaff(supabase: Client, userId: string) {
  const { data, error } = await supabase.rpc("is_staff", { _user_id: userId });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("Only the internal team can dispatch vendors.");
}

export async function loadVendors() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: roles, error: rolesError } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "vendor");
  if (rolesError) throw rolesError;

  const ids = (roles ?? []).map((r) => r.user_id);
  if (ids.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, phone")
    .in("id", ids)
    .order("full_name");
  if (error) throw error;
  return data ?? [];
}

/** Sends a ticket to a vendor with the brief they need to do the job right. */
export async function dispatchVendor(input: {
  ticketId: string;
  vendorUserId: string | null;
  brief: string;
  dispatchedBy: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();

  if (!input.vendorUserId) {
    const { error } = await supabaseAdmin
      .from("tickets")
      .update({ vendor_user_id: null, vendor_status: "none", vendor_dispatched_at: null })
      .eq("id", input.ticketId);
    if (error) throw error;
    await supabaseAdmin.from("ticket_activity").insert({
      ticket_id: input.ticketId,
      author_id: input.dispatchedBy,
      kind: "note",
      event_type: "note",
      body: "Vendor assignment removed.",
    });
    return { ok: true as const };
  }

  const { error } = await supabaseAdmin
    .from("tickets")
    .update({
      vendor_user_id: input.vendorUserId,
      vendor_brief: input.brief || null,
      vendor_status: "dispatched",
      vendor_dispatched_at: now,
      vendor_accepted_at: null,
      vendor_completed_at: null,
    })
    .eq("id", input.ticketId);
  if (error) throw error;

  const { data: vendor } = await supabaseAdmin
    .from("profiles")
    .select("full_name, email")
    .eq("id", input.vendorUserId)
    .maybeSingle();

  await supabaseAdmin.from("ticket_activity").insert({
    ticket_id: input.ticketId,
    author_id: input.dispatchedBy,
    kind: "note",
    event_type: "note",
    channel: "vendor_portal",
    body: `Dispatched to ${vendor?.full_name ?? vendor?.email ?? "a vendor"} in the vendor portal.${
      input.brief ? `\n\nBrief: ${input.brief}` : ""
    }`,
  });

  return { ok: true as const };
}

/**
 * Ranks vendors for a ticket: distance from the home (their most recent site
 * check-in), scorecard tier/average, and how many jobs they already carry.
 */
export async function rankVendorsForTicket(ticketId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { distanceMeters } = await import("./visits");
  const { candidateReasons, candidateScore } = await import("./dispatch");
  const { loadVendorScoreboard } = await import("./scorecard.server");

  const { data: ticket } = await supabaseAdmin
    .from("tickets")
    .select("id, priority, property_id, properties:property_id (latitude, longitude, name)")
    .eq("id", ticketId)
    .maybeSingle();

  const home =
    (
      ticket as unknown as {
        properties: {
          latitude: number | null;
          longitude: number | null;
          name: string | null;
        } | null;
      } | null
    )?.properties ?? null;
  const homePin =
    home?.latitude != null && home?.longitude != null
      ? { lat: home.latitude, lng: home.longitude }
      : null;
  const urgent = ticket?.priority === "p1" || ticket?.priority === "p2";

  const [vendors, board] = await Promise.all([loadVendors(), loadVendorScoreboard()]);
  if (vendors.length === 0) {
    return {
      candidates: [] as VendorCandidate[],
      homeName: home?.name ?? null,
      hasHomePin: !!homePin,
    };
  }
  const ids = vendors.map((v) => v.id);
  const cardById = new Map(board.vendors.map((v) => [v.vendorUserId, v]));

  const [{ data: visits }, { data: openRows }] = await Promise.all([
    supabaseAdmin
      .from("ticket_visits")
      .select("vendor_user_id, check_in_lat, check_in_lng, checked_in_at")
      .in("vendor_user_id", ids)
      .eq("is_demo", false)
      .order("checked_in_at", { ascending: false }),
    supabaseAdmin
      .from("tickets")
      .select("vendor_user_id")
      .in("vendor_user_id", ids)
      .in("vendor_status", ["dispatched", "accepted", "on_site"])
      .eq("is_demo", false)
      .is("archived_at", null),
  ]);

  const lastSeen = new Map<string, { lat: number; lng: number; at: string }>();
  for (const v of visits ?? []) {
    if (!v.vendor_user_id || v.check_in_lat == null || v.check_in_lng == null) continue;
    if (lastSeen.has(v.vendor_user_id)) continue;
    lastSeen.set(v.vendor_user_id, {
      lat: v.check_in_lat,
      lng: v.check_in_lng,
      at: v.checked_in_at,
    });
  }

  const openCount = new Map<string, number>();
  for (const t of openRows ?? []) {
    if (!t.vendor_user_id) continue;
    openCount.set(t.vendor_user_id, (openCount.get(t.vendor_user_id) ?? 0) + 1);
  }

  const candidates: VendorCandidate[] = vendors.map((v) => {
    const card = cardById.get(v.id);
    const seen = lastSeen.get(v.id) ?? null;
    const distanceM =
      homePin && seen ? distanceMeters(homePin, { lat: seen.lat, lng: seen.lng }) : null;
    const base = {
      tier: card?.tier ?? ("rising" as const),
      averageOverall: card?.averageOverall ?? null,
      fleetAverage: card?.fleetAverage ?? null,
      ratedJobs: card?.ratedJobs ?? 0,
      openJobs: openCount.get(v.id) ?? 0,
      distanceM,
    };
    return {
      id: v.id,
      name: v.full_name ?? v.email ?? "Vendor",
      email: v.email ?? null,
      phone: v.phone ?? null,
      points: card?.points ?? 0,
      lastSeenAt: seen?.at ?? null,
      ...base,
      score: candidateScore({ ...base, urgent }),
      reasons: candidateReasons(base),
    };
  });

  candidates.sort((a, b) => b.score - a.score);
  return { candidates, homeName: home?.name ?? null, hasHomePin: !!homePin };
}
