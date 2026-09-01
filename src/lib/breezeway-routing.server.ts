/**
 * Breezeway-origin Ticket routing (server-only).
 *
 * Scope, deliberately narrow:
 *   - A NEW Ticket created out of a Breezeway work order goes to Team B /
 *     Property Operations, to whichever eligible person carries the lightest
 *     weighted load right now.
 *   - Updates, comments and status changes arriving from Breezeway NEVER touch
 *     ownership of an existing Ticket. This module is only ever called on
 *     creation; the webhook path writes no ticket columns at all.
 *
 * Weighting (open tickets owned by the candidate):
 *   P1 = 5, P2 = 3, P3 = 1.
 *
 * Eligibility reuses the existing shift / on-call / availability model —
 * `staff_assignable`, `seat_on_duty`, `coverage_config`, `oncall_roster`. No
 * second queue and no second schedule is introduced here.
 *
 * Ties break deterministically: least recently auto-routed first, then the
 * lowest user id. Two identical portfolio states therefore always produce the
 * same assignee, and repeated ties rotate round-robin.
 */

/** Team B — the Property Operations Coordinator seats. */
export const TEAM_B_ROLE_CODES = ["po_day", "po_evening"] as const;
export const AUTO_ROUTE_SOURCE = "breezeway_auto_route";

const WEIGHTS: Record<string, number> = { p1: 5, p2: 3, p3: 1 };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type RoutingDecision = {
  userId: string | null;
  roleCode: string | null;
  reason: string;
  fallback: boolean;
  candidates: { userId: string; roleCode: string; weight: number }[];
};

/** Open-ticket weight for one person: P1=5, P2=3, P3=1. */
export async function weightedLoad(userId: string): Promise<number> {
  const db = await admin();
  const { data } = await db
    .from("tickets")
    .select("priority")
    .eq("current_action_owner", userId)
    .not("status", "in", "(resolved,closed)")
    .is("archived_at", null)
    .eq("is_demo", false);
  return ((data ?? []) as { priority: string | null }[]).reduce(
    (sum, t) => sum + (WEIGHTS[String(t.priority ?? "p3")] ?? 1),
    0,
  );
}

/** Whether the after-hours window (coverage_config, Central) is open now. */
async function afterHoursNow(): Promise<boolean> {
  const db = await admin();
  const { data } = await db
    .from("coverage_config")
    .select("timezone, after_hours_start_minute, after_hours_end_minute")
    .limit(1)
    .maybeSingle();
  const cfg = data as {
    timezone: string | null;
    after_hours_start_minute: number | null;
    after_hours_end_minute: number | null;
  } | null;
  if (!cfg?.after_hours_start_minute && cfg?.after_hours_start_minute !== 0) return false;
  if (cfg.after_hours_end_minute == null) return false;
  const tz = cfg.timezone || "America/Chicago";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const now = hour * 60 + minute;
  const { after_hours_start_minute: start, after_hours_end_minute: end } = cfg;
  return start > end ? now >= start || now < end : now >= start && now < end;
}

async function assignable(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const db = await admin();
  const { data } = await db.rpc("staff_assignable", { _user_id: userId });
  return data === true;
}

async function onDuty(roleCode: string): Promise<boolean> {
  const db = await admin();
  const { data } = await db.rpc("seat_on_duty", { _role_code: roleCode, _at: new Date().toISOString() });
  return data === true;
}

async function supervisorFallback(reason: string): Promise<RoutingDecision> {
  const db = await admin();
  const { data } = await db
    .from("functional_roles")
    .select("current_seat_holder")
    .eq("code", "ops_supervisor")
    .eq("active", true)
    .maybeSingle();
  const holder = (data as { current_seat_holder: string | null } | null)?.current_seat_holder ?? null;
  if (await assignable(holder)) {
    return {
      userId: holder,
      roleCode: "ops_supervisor",
      reason: `${reason} Held by the Operations Supervisor so it is never unowned.`,
      fallback: true,
      candidates: [],
    };
  }
  return {
    userId: null,
    roleCode: null,
    reason: `${reason} No eligible Operations Supervisor either — needs a manual assignment.`,
    fallback: true,
    candidates: [],
  };
}

/**
 * Picks the Team B owner for a new Breezeway-origin ticket. Read-only: it
 * decides, it does not write.
 */
export async function routeBreezewayTicket(): Promise<RoutingDecision> {
  const db = await admin();

  // Existing after-hours model wins during its window; priority is untouched —
  // after-hours never means P1.
  if (await afterHoursNow()) {
    const { data: roster } = await db
      .from("oncall_roster")
      .select("user_id, starts_on, ends_on")
      .lte("starts_on", new Date().toISOString().slice(0, 10))
      .gte("ends_on", new Date().toISOString().slice(0, 10))
      .limit(1);
    const oncall = ((roster ?? []) as { user_id: string }[])[0]?.user_id ?? null;
    if (await assignable(oncall)) {
      return {
        userId: oncall,
        roleCode: null,
        reason:
          "Created from Breezeway inside the after-hours window; routed to the rostered on-call person. Priority is unchanged.",
        fallback: false,
        candidates: [],
      };
    }
  }

  const { data: seats } = await db
    .from("functional_roles")
    .select("code, current_seat_holder")
    .in("code", TEAM_B_ROLE_CODES as unknown as string[])
    .eq("active", true);

  const candidates: { userId: string; roleCode: string; weight: number }[] = [];
  for (const seat of (seats ?? []) as { code: string; current_seat_holder: string | null }[]) {
    const holder = seat.current_seat_holder;
    if (!holder) continue;
    if (!(await assignable(holder))) continue;
    if (!(await onDuty(seat.code))) continue;
    candidates.push({ userId: holder, roleCode: seat.code, weight: await weightedLoad(holder) });
  }

  if (candidates.length === 0) {
    return supervisorFallback("No Team B / Property Operations seat is eligible right now.");
  }

  // Deterministic round-robin on ties: least recently auto-routed, then user id.
  const { data: recent } = await db
    .from("tickets")
    .select("current_action_owner, created_at")
    .eq("assignment_source", AUTO_ROUTE_SOURCE)
    .in(
      "current_action_owner",
      candidates.map((c) => c.userId),
    )
    .order("created_at", { ascending: false })
    .limit(200);
  const lastRouted = new Map<string, string>();
  for (const row of (recent ?? []) as { current_action_owner: string | null; created_at: string }[]) {
    if (row.current_action_owner && !lastRouted.has(row.current_action_owner)) {
      lastRouted.set(row.current_action_owner, row.created_at);
    }
  }

  candidates.sort(
    (a, b) =>
      a.weight - b.weight ||
      (lastRouted.get(a.userId) ?? "").localeCompare(lastRouted.get(b.userId) ?? "") ||
      a.userId.localeCompare(b.userId),
  );
  const winner = candidates[0]!;
  return {
    userId: winner.userId,
    roleCode: winner.roleCode,
    reason: `Created from Breezeway; routed to the lightest eligible Property Operations queue (weighted load ${winner.weight}, P1=5/P2=3/P3=1).`,
    fallback: false,
    candidates,
  };
}

export type EscalateResult =
  | { ok: true; ticketId: string; ref: number | null; assignedTo: string | null; note: string }
  | { ok: false; message: string };

/**
 * Creates ONE Resolve Ticket from a mirrored Breezeway work order and applies
 * Team B routing. Idempotent per work order: if the work order is already
 * linked to a ticket, that ticket is returned and its ownership is untouched.
 */
export async function createTicketFromWorkOrder(
  workOrderId: string,
  priority: "p1" | "p2" | "p3",
  actorId: string,
): Promise<EscalateResult> {
  const db = await admin();
  const { getWorkOrder, linkWorkOrderToTicket } = await import("./breezeway-workorders.server");
  const wo = await getWorkOrder(workOrderId);
  if (!wo) return { ok: false, message: "That work order is not in Resolve." };
  if (!wo.propertyId) return { ok: false, message: "Link the work order to a Resolve property first." };
  if (wo.linkedTicketId) {
    const { data } = await db.from("tickets").select("id, ref, current_action_owner").eq("id", wo.linkedTicketId).maybeSingle();
    const t = data as { id: string; ref: number | null; current_action_owner: string | null } | null;
    if (t) {
      return {
        ok: true,
        ticketId: t.id,
        ref: t.ref,
        assignedTo: t.current_action_owner,
        note: "This work order already has a Ticket. Ownership was left as it is.",
      };
    }
  }

  const decision = await routeBreezewayTicket();
  const now = new Date().toISOString();

  const { data: inserted, error } = await db
    .from("tickets")
    .insert({
      record_type: "active_task",
      title: wo.name ?? `Breezeway task ${wo.breezewayTaskId}`,
      description: wo.description ?? null,
      property_id: wo.propertyId,
      priority,
      suggested_priority: priority,
      status: "open",
      source_channel: "breezeway",
      initiator_type: "external",
      external_source: "breezeway",
      external_id: String(wo.breezewayTaskId),
      external_url: wo.breezewayTaskId ? `https://app.breezeway.io/tasks/${wo.breezewayTaskId}` : null,
      external_synced_at: now,
      breezeway_task_id: wo.breezewayTaskId,
      reported_at: now,
      created_by: actorId,
      department_code: "operations",
    } as never)
    .select("id, ref")
    .single();
  if (error || !inserted) return { ok: false, message: "Could not create the Ticket." };
  const ticket = inserted as unknown as { id: string; ref: number | null };

  // Overwrite whatever the generic assignment trigger chose: a Breezeway-origin
  // ticket belongs to the Team B weighted queue, and the source is recorded.
  await db
    .from("tickets")
    .update({
      current_action_owner: decision.userId,
      assigned_to: decision.userId,
      assignment_source: AUTO_ROUTE_SOURCE,
      assignment_note: decision.reason,
    } as never)
    .eq("id", ticket.id);

  await db.from("ticket_activity").insert({
    ticket_id: ticket.id,
    author_id: actorId,
    kind: "assignment",
    event_type: "assigned",
    channel: AUTO_ROUTE_SOURCE,
    to_owner: decision.userId,
    body: decision.reason,
  } as never);

  await linkWorkOrderToTicket(wo.id, ticket.id);

  return {
    ok: true,
    ticketId: ticket.id,
    ref: ticket.ref,
    assignedTo: decision.userId,
    note: decision.reason,
  };
}
