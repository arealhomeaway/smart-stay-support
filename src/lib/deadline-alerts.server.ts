/**
 * The pass that turns time into notifications (server-only).
 *
 * It reads the open work, asks the pure rules in `deadline-alerts.ts` what has
 * gone past its clock, drops anything already sent, and writes the rest into
 * the staff inbox through `notify_staff` — which is the same path every other
 * staff alert takes, so email fan-out, demo suppression and the
 * never-notify-yourself rule all continue to apply without being restated.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  ALERT_KINDS,
  alertKey,
  claimDeadlineAlerts,
  newAlerts,
  ticketSlaAlerts,
  vendorDispatchAlerts,
  type ClaimForAlerts,
  type DeadlineAlert,
  type TicketForAlerts,
  type WorkOrderForAlerts,
} from "@/lib/deadline-alerts";
import { MAINTENANCE_POLICY, normalisePriority } from "@/lib/maintenance-policy";

type Client = SupabaseClient<Database>;

/** How far back the pass looks for an alert it already sent. */
const DEDUPE_DAYS = 30;

export async function sweepDeadlineAlerts(supabase: Client, now = new Date()) {
  const since = new Date(now.getTime() - DEDUPE_DAYS * 86_400_000).toISOString();

  const [tickets, workOrders, claims] = await Promise.all([
    supabase
      .from("tickets")
      .select(
        "id, ref, title, status, priority, assigned_to, acknowledged_at, action_started_at, response_due_at, action_due_at, is_demo",
      )
      .not("assigned_to", "is", null)
      .not("status", "in", "(resolved,closed,deleted)"),
    supabase
      .from("work_orders")
      .select(
        "id, title, priority, assigned_to, closed_at, vendor_name, vendor_contacted_at, vendor_acknowledged_at, vendor_eta_at, vendor_arrived_at, is_demo",
      )
      .is("closed_at", null)
      .not("assigned_to", "is", null),
    supabase
      .from("claims")
      .select("id, ref, title, stage, assigned_to, deadline_on, is_demo")
      .not("assigned_to", "is", null)
      .not("deadline_on", "is", null),
  ]);

  const failure = tickets.error ?? workOrders.error ?? claims.error;
  if (failure) throw new Error(failure.message);

  const candidates: DeadlineAlert[] = [
    ...ticketSlaAlerts((tickets.data ?? []) as unknown as TicketForAlerts[], now),
    ...vendorDispatchAlerts(
      (workOrders.data ?? []).map((wo) => ({
        ...wo,
        acknowledge_minutes:
          MAINTENANCE_POLICY.vendorAcknowledgeMinutes[
            normalisePriority((wo as { priority?: string | null }).priority)
          ],
      })) as unknown as WorkOrderForAlerts[],
      now,
    ),
    ...claimDeadlineAlerts((claims.data ?? []) as unknown as ClaimForAlerts[], now),
  ];

  if (candidates.length === 0) {
    return { ok: true as const, considered: 0, created: 0, notes: [] as string[] };
  }

  const { data: sent, error: sentError } = await supabase
    .from("staff_notifications")
    .select("kind, user_id, entity_id")
    .in("kind", [...ALERT_KINDS])
    .in("entity_id", Array.from(new Set(candidates.map((a) => a.entityId))))
    .gte("created_at", since);
  if (sentError) throw new Error(sentError.message);

  const alreadySent = new Set(
    (sent ?? []).map((row) =>
      alertKey({
        kind: row.kind as DeadlineAlert["kind"],
        userId: row.user_id,
        entityId: row.entity_id ?? "",
      }),
    ),
  );

  const pending = newAlerts(candidates, alreadySent);
  const notes: string[] = [];
  let created = 0;

  for (const alert of pending) {
    const { error } = await supabase.rpc("notify_staff", {
      _user_id: alert.userId,
      _kind: alert.kind,
      _title: alert.title,
      _body: alert.body,
      _entity_type: alert.entityType,
      _entity_id: alert.entityId,
      _link_path: alert.linkPath,
      _priority: alert.priority,
      _actor_id: null,
      // Urgent items earn an email; the rest stay in the in-app inbox.
      _email: alert.priority === "urgent",
      _is_demo: alert.isDemo,
    });
    if (error) notes.push(error.message);
    else created++;
  }

  return { ok: true as const, considered: candidates.length, created, notes };
}
