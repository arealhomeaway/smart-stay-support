/**
 * Backfills the "Start working" semantics on the first real action a ticket
 * receives, instead of requiring a dedicated click before anything else on
 * the ticket is reachable.
 *
 * This is the one place every Ticket action routes through before writing
 * its own effect — the Ticket page's `log()` (every note, step, status
 * change, resolve, reopen and guest confirmation) and the Work Order
 * create/open callback both call this first. Opening or merely viewing a
 * ticket never calls it, so `action_started_at` still means real
 * engagement, not a page load — P1 escalation and the action-start SLA
 * clock stay intact.
 */
import { supabase } from "@/integrations/supabase/client";
import { ticketActionStartPlan } from "@/lib/tickets";

export async function ensureTicketActionStarted(ticketId: string): Promise<boolean> {
  const { data: current, error: readError } = await supabase
    .from("tickets")
    .select("status, acknowledged_at, action_started_at, current_action_owner, assignment_source")
    .eq("id", ticketId)
    .maybeSingle();
  if (readError || !current) return false;

  const { data: userData } = await supabase.auth.getUser();
  const plan = ticketActionStartPlan(current, userData.user?.id ?? null, new Date().toISOString());
  if (!plan) return false;

  // Guarded by the same condition the plan was computed from: if another
  // action already started this ticket in the meantime, this update matches
  // no rows and the events below are skipped rather than duplicated.
  const { data: updated, error: updateError } = await supabase
    .from("tickets")
    .update(plan.patch)
    .eq("id", ticketId)
    .is("action_started_at", null)
    .select("id");
  if (updateError || !updated || updated.length === 0) return false;

  for (const event of plan.events) {
    await supabase.from("ticket_activity").insert({
      ticket_id: ticketId,
      author_id: userData.user?.id ?? null,
      kind: event.kind,
      event_type: event.eventType,
      body: event.body,
    });
  }
  return true;
}
