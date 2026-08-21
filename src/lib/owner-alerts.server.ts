/**
 * Internal "reach this homeowner" queue (server-only).
 *
 * The app sends email and in-app alerts on its own. Anything urgent enough to
 * warrant a text or a phone call becomes a task for a real teammate — we never
 * auto-send SMS. Supervisors work this queue and mark each one handled.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { assertSupervisor } from "./owner-program.server";

type Client = SupabaseClient<Database>;

export type ContactAlert = {
  id: string;
  priority: string;
  title: string;
  body: string;
  reason: string;
  owner_name: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  ticket_id: string | null;
  status: string;
  handled_at: string | null;
  handled_note: string | null;
  created_at: string;
};

export async function loadContactAlerts(supabase: Client, userId: string) {
  await assertSupervisor(supabase, userId);
  const { data, error } = await supabase
    .from("owner_contact_alerts")
    .select(
      "id, priority, title, body, reason, owner_name, owner_phone, owner_email, ticket_id, status, handled_at, handled_note, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw error;
  const rows = (data ?? []) as ContactAlert[];
  return { rows, pending: rows.filter((r) => r.status === "pending").length };
}

export async function markContactAlertHandled(
  supabase: Client,
  userId: string,
  input: { id: string; note: string },
) {
  await assertSupervisor(supabase, userId);
  const { error } = await supabase
    .from("owner_contact_alerts")
    .update({
      status: "handled",
      handled_by: userId,
      handled_at: new Date().toISOString(),
      handled_note: input.note || null,
    })
    .eq("id", input.id);
  if (error) throw error;
  return { ok: true as const };
}
