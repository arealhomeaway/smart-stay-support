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

/** Sends a matter to a vendor with the brief they need to do the job right. */
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
