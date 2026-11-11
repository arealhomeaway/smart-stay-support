/**
 * Breezeway bridge, server side (register T15, C4, C5, C6; Emily, Nov 10).
 *
 * Tickets and reviews are made only by the database trigger `private.breezeway_bridge_apply`
 * on the work order mirror; this module turns the bridge on and off through
 * `set_breezeway_bridge`, reads its true state, runs the safety sweep (read only against
 * Breezeway) and links a Breezeway work order to a ticket. Nothing here creates, changes or
 * deletes anything in Breezeway.
 */
import { BRIDGE_COPY, breezewayReportLink, breezewayTaskLink, breezewayTaskPage, isFinishedState, type TicketBreezewayOrder } from "./breezeway-bridge";
export type { TicketBreezewayOrder } from "./breezeway-bridge";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Loose = { from: (t: string) => any; rpc: (f: string, a?: unknown) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

/** One history row on Integrations for a Breezeway failure or refusal. */
export async function recordBreezewayIntegrationEvent(row: {
  operation: "mirror_refresh" | "second_escalation" | "safety_sweep";
  status: string;
  externalId?: string | null;
  message?: string | null;
  entityId?: string | null;
  actorId?: string | null;
}) {
  const db = (await admin()) as unknown as Loose;
  await db.from("integration_events").insert({
    system: "breezeway",
    direction: "inbound",
    operation: row.operation,
    status: row.status,
    external_id: row.externalId ?? null,
    error_message: row.message ?? null,
    entity_type: row.entityId ? "ticket" : null,
    entity_id: row.entityId ?? null,
    resolved_by: row.actorId ?? null,
    resolved_at: row.actorId ? new Date().toISOString() : null,
  });
}

/** The sweep's last run, shown on Integrations (one settings row, overwritten each run). */
async function noteSweepRun(ran: boolean) {
  try {
    const db = (await admin()) as unknown as Loose;
    await db
      .from("app_settings")
      .upsert({ key: "breezeway_safety_sweep_last", value: { at: new Date().toISOString(), ran }, updated_at: new Date().toISOString() }, { onConflict: "key" });
  } catch {
    /* bookkeeping only */
  }
}

/**
 * The safety sweep: refreshes the people directory and a bounded batch of verified homes.
 * Refuses while the bridge is off, so nothing runs before the start line.
 */
export async function runBreezewaySafetySweep(limit = 10) {
  const { readBridgeGate, syncVerifiedPortfolio } = await import("./breezeway-workorders.server");
  const gate = await readBridgeGate();
  await noteSweepRun(gate.on);
  if (!gate.on) return { ok: false as const, skipped: "The Breezeway bridge is off." };
  try {
    const people = await (await import("./breezeway-people.server")).syncBreezewayPeople();
    const mirror = await syncVerifiedPortfolio(Math.min(Math.max(limit, 1), 30));
    return { ok: true as const, people, mirror };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The safety sweep failed.";
    await recordBreezewayIntegrationEvent({ operation: "safety_sweep", status: "failed", message });
    return { ok: false as const, error: message };
  }
}

const ORDER_SELECT =
  "id, breezeway_task_id, property_id, name, department, status, stage, scheduled_date, finished_at, assignees, report_url, linked_ticket_id, breezeway_updated_at";

type OrderRow = {
  id: string;
  breezeway_task_id: number;
  property_id: string | null;
  name: string | null;
  department: string | null;
  status: string | null;
  stage?: string | null;
  scheduled_date: string | null;
  finished_at: string | null;
  assignees: unknown;
  report_url: string | null;
  linked_ticket_id: string | null;
  breezeway_updated_at: string | null;
};

function toOrder(r: OrderRow): TicketBreezewayOrder {
  return {
    id: r.id,
    breezewayTaskId: r.breezeway_task_id,
    name: r.name,
    department: r.department,
    status: r.status,
    scheduledDate: r.scheduled_date,
    finishedAt: r.finished_at,
    assignees: Array.isArray(r.assignees)
      ? (r.assignees as { name?: string | null }[]).map((a) => a?.name ?? "").filter(Boolean)
      : [],
    link: breezewayTaskLink(r.breezeway_task_id, r.report_url),
    taskPage: breezewayTaskPage(r.breezeway_task_id),
    reportLink: breezewayReportLink(r.report_url),
    finished: isFinishedState(r.stage ?? null, r.status),
    linkedTicketId: r.linked_ticket_id,
    updatedAt: r.breezeway_updated_at,
  };
}

/** The ticket's home, read as the caller (RLS decides whether they may see the ticket). */
async function ticketHome(caller: Loose, ticketId: string) {
  const { data, error } = await caller
    .from("tickets")
    .select("id, property_id, is_demo")
    .eq("id", ticketId)
    .maybeSingle();
  if (error || !data) throw new Error("That ticket was not found.");
  return data as { id: string; property_id: string | null; is_demo: boolean };
}

/** The ticket's linked Breezeway work orders and the home's other mirrored ones. */
export async function ticketBreezewayOrders(caller: unknown, ticketId: string) {
  const ticket = await ticketHome(caller as Loose, ticketId);
  const db = (await admin()) as unknown as Loose;
  const linked = await db
    .from("breezeway_work_orders")
    .select(ORDER_SELECT)
    .eq("linked_ticket_id", ticketId)
    .order("breezeway_updated_at", { ascending: false, nullsFirst: false });
  const home = ticket.property_id
    ? await db
        .from("breezeway_work_orders")
        .select(ORDER_SELECT)
        .eq("property_id", ticket.property_id)
        .neq("stage", "deleted")
        .order("breezeway_updated_at", { ascending: false, nullsFirst: false })
        .limit(40)
    : { data: [] };
  const linkedRows = ((linked.data ?? []) as OrderRow[]).map(toOrder);
  const linkedIds = new Set(linkedRows.map((r) => r.id));
  return {
    hasHome: Boolean(ticket.property_id),
    linked: linkedRows,
    choices: ((home.data ?? []) as OrderRow[])
      .map(toOrder)
      .filter((r) => !linkedIds.has(r.id) && !r.linkedTicketId),
  };
}

export type LinkResult = { ok: true; workOrderId: string; breezewayTaskId: number } | { ok: false; message: string };

/**
 * Links one mirrored Breezeway work order to a ticket. A pasted number not yet in the mirror is
 * read once from Breezeway (read only). The work order must belong to the ticket's home and not
 * already belong to another ticket. Nothing is created in Breezeway.
 */
export async function linkTicketBreezewayOrder(
  caller: unknown,
  actorId: string,
  input: { ticketId: string; workOrderId?: string | null; taskNumber?: number | null },
): Promise<LinkResult> {
  const ticket = await ticketHome(caller as Loose, input.ticketId);
  if (!ticket.property_id) return { ok: false, message: "Add the home to this ticket first." };
  const db = (await admin()) as unknown as Loose;
  let row: OrderRow | null = null;
  if (input.workOrderId) {
    const { data } = await db.from("breezeway_work_orders").select(ORDER_SELECT).eq("id", input.workOrderId).maybeSingle();
    row = (data as OrderRow | null) ?? null;
  } else if (input.taskNumber) {
    const found = await db
      .from("breezeway_work_orders")
      .select(ORDER_SELECT)
      .eq("breezeway_task_id", input.taskNumber)
      .maybeSingle();
    row = (found.data as OrderRow | null) ?? null;
    if (!row) {
      const { refreshWorkOrder } = await import("./breezeway-workorders.server");
      const fresh = await refreshWorkOrder(input.taskNumber);
      if (fresh) {
        const again = await db.from("breezeway_work_orders").select(ORDER_SELECT).eq("id", fresh.id).maybeSingle();
        row = (again.data as OrderRow | null) ?? null;
      }
    }
  }
  if (!row) return { ok: false, message: BRIDGE_COPY.notFound };
  if (row.property_id !== ticket.property_id) return { ok: false, message: BRIDGE_COPY.notThisHome };
  if (row.linked_ticket_id && row.linked_ticket_id !== ticket.id) {
    return { ok: false, message: "That Breezeway work order is already on another ticket." };
  }
  if (row.linked_ticket_id !== ticket.id) {
    const { error } = await db
      .from("breezeway_work_orders")
      .update({ linked_ticket_id: ticket.id, needs_attention: false })
      .eq("id", row.id)
      .is("linked_ticket_id", null);
    if (error) return { ok: false, message: "Could not link that Breezeway work order." };
    await db.from("ticket_activity").insert({
      ticket_id: ticket.id,
      author_id: actorId,
      kind: "note",
      event_type: "breezeway_linked",
      body: `Linked Breezeway work order ${row.breezeway_task_id}.`,
      is_demo: ticket.is_demo ?? false,
    });
  }
  return { ok: true, workOrderId: row.id, breezewayTaskId: row.breezeway_task_id };
}
