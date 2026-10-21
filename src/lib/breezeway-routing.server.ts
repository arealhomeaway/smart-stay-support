/**
 * Breezeway-origin Ticket routing (server-only).
 *
 * Scope, deliberately narrow:
 *   - A NEW Ticket created out of a Breezeway Work Order follows the real
 *     coverage model: overnight on-call, then the Team B / Property Operations
 *     weighted queue, then the approved cross-team triage role, then an
 *     ON-DUTY Operations Supervisor, then unassigned (surfaced in Oversight).
 *   - Updates, comments and status changes arriving from Breezeway NEVER touch
 *     ownership of an existing Ticket. This module is only ever called on
 *     creation; the webhook path writes no ticket columns at all.
 *
 * Every eligibility question is answered by the single coverage model —
 * `coverage_shifts`, `coverage_overrides`, seat availability,
 * `coverage_triage_windows` and `oncall_roster` — through the database helpers
 * `seat_eligible_now` / `seat_holder_at`. There is no second schedule.
 */

import {
  TEAM_B,
  TEAM_B_ROLE_CODES,
  decideRoute,
  isWithinWindow,
  localWeekdayMinutes,
  pickLightestCandidate,
  triageRoleFor,
  weightOf,
  type RoutingDecision,
  type TriageWindow,
} from "./coverage-model";

export { TEAM_B_ROLE_CODES, isWithinWindow, pickLightestCandidate };
export type { RoutingDecision };

export const AUTO_ROUTE_SOURCE = "breezeway_auto_route";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

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
    (sum, t) => sum + weightOf(t.priority),
    0,
  );
}

/** Coverage config (timezone + after-hours window). */
async function coverageConfig() {
  const db = await admin();
  const { data } = await db
    .from("coverage_config")
    .select("timezone, after_hours_start_minute, after_hours_end_minute")
    .limit(1)
    .maybeSingle();
  return (data ?? null) as {
    timezone: string | null;
    after_hours_start_minute: number | null;
    after_hours_end_minute: number | null;
  } | null;
}

/** Whether the after-hours window (coverage_config, Central) is open now. */
async function afterHoursNow(now: Date, tz: string): Promise<boolean> {
  const cfg = await coverageConfig();
  if (cfg?.after_hours_start_minute == null || cfg.after_hours_end_minute == null) return false;
  const { minutes } = localWeekdayMinutes(now, tz);
  return isWithinWindow(minutes, cfg.after_hours_start_minute, cfg.after_hours_end_minute);
}

async function assignable(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const db = await admin();
  const { data } = await db.rpc("staff_assignable", { _user_id: userId });
  return data === true;
}

/** Seat is on duty right now, honouring availability and temporary overrides. */
async function seatEligible(roleCode: string, at: Date): Promise<boolean> {
  const db = await admin();
  const { data } = await db.rpc("seat_eligible_now", {
    _role_code: roleCode,
    _at: at.toISOString(),
  });
  return data === true;
}

/** Who is holding a seat right now — a temporary cover wins over the seat holder. */
async function seatHolder(roleCode: string, at: Date): Promise<string | null> {
  const db = await admin();
  const { data } = await db.rpc("seat_holder_at", { _role_code: roleCode, _at: at.toISOString() });
  return (data as string | null) ?? null;
}

/**
 * Picks the owner for a new Breezeway-origin ticket. Read-only: it decides, it
 * does not write.
 */
export async function routeBreezewayTicket(now: Date = new Date()): Promise<RoutingDecision> {
  const db = await admin();
  const cfg = await coverageConfig();
  const tz = cfg?.timezone || "America/Chicago";

  // 1. Overnight on-call keeps precedence, DST-safe. Priority is untouched —
  //    after-hours never means P1.
  let onCallUserId: string | null = null;
  const afterHours = await afterHoursNow(now, tz);
  if (afterHours) {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    const { data: roster } = await db
      .from("oncall_roster")
      .select("user_id, starts_on, ends_on")
      .lte("starts_on", today)
      .gte("ends_on", today)
      .limit(1);
    const candidate = ((roster ?? []) as { user_id: string }[])[0]?.user_id ?? null;
    if (await assignable(candidate)) onCallUserId = candidate;
  }

  // 2. Eligible Team B seats and their weighted load.
  const { data: seats } = await db
    .from("functional_roles")
    .select("code, current_seat_holder")
    .in("code", TEAM_B_ROLE_CODES as unknown as string[])
    .eq("active", true);

  const teamB: { userId: string; roleCode: string; weight: number }[] = [];
  for (const seat of (seats ?? []) as { code: string }[]) {
    if (!(await seatEligible(seat.code, now))) continue;
    const holder = await seatHolder(seat.code, now);
    if (!(await assignable(holder))) continue;
    teamB.push({ userId: holder!, roleCode: seat.code, weight: await weightedLoad(holder!) });
  }

  // 3. Approved cross-team triage window, if Team B is off duty.
  let triage: { userId: string; roleCode: string } | null = null;
  if (teamB.length === 0) {
    const { data: windows } = await db
      .from("coverage_triage_windows")
      .select("weekday, start_minute, end_minute, covers_team, role_code, active")
      .eq("active", true);
    const { weekday, minutes } = localWeekdayMinutes(now, tz);
    const roleCode = triageRoleFor((windows ?? []) as TriageWindow[], weekday, minutes, TEAM_B);
    if (roleCode && (await seatEligible(roleCode, now))) {
      const holder = await seatHolder(roleCode, now);
      if (await assignable(holder)) triage = { userId: holder!, roleCode };
    }
  }

  // 4. Supervisor fallback — only when actually on duty.
  let supervisorOnDuty: { userId: string; roleCode: string } | null = null;
  if (teamB.length === 0 && !triage && !(afterHours && onCallUserId)) {
    if (await seatEligible("ops_supervisor", now)) {
      const holder = await seatHolder("ops_supervisor", now);
      if (await assignable(holder))
        supervisorOnDuty = { userId: holder!, roleCode: "ops_supervisor" };
    }
  }

  // Deterministic round-robin on ties: least recently auto-routed, then user id.
  const lastRouted = new Map<string, string>();
  if (teamB.length > 1) {
    const { data: recent } = await db
      .from("tickets")
      .select("current_action_owner, created_at")
      .eq("assignment_source", AUTO_ROUTE_SOURCE)
      .in(
        "current_action_owner",
        teamB.map((c) => c.userId),
      )
      .order("created_at", { ascending: false })
      .limit(200);
    for (const row of (recent ?? []) as {
      current_action_owner: string | null;
      created_at: string;
    }[]) {
      if (row.current_action_owner && !lastRouted.has(row.current_action_owner)) {
        lastRouted.set(row.current_action_owner, row.created_at);
      }
    }
  }

  return decideRoute({ afterHours, onCallUserId, teamB, lastRouted, triage, supervisorOnDuty });
}

export type EscalateResult =
  | { ok: true; ticketId: string; ref: number | null; assignedTo: string | null; note: string }
  | { ok: false; message: string };

/**
 * Creates ONE Resolve Ticket from a mirrored Breezeway Work Order and applies
 * Team B routing. Idempotent per Work Order: if the Work Order is already
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
  if (!wo) return { ok: false, message: "That Work Order is not in Resolve." };
  if (!wo.propertyId)
    return { ok: false, message: "Link the Work Order to a Resolve property first." };
  if (wo.linkedTicketId) {
    const { data } = await db
      .from("tickets")
      .select("id, ref, current_action_owner")
      .eq("id", wo.linkedTicketId)
      .maybeSingle();
    const t = data as {
      id: string;
      ref: number | null;
      current_action_owner: string | null;
    } | null;
    if (t) {
      return {
        ok: true,
        ticketId: t.id,
        ref: t.ref,
        assignedTo: t.current_action_owner,
        note: "This Work Order already has a Ticket. Ownership was left as it is.",
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
      external_url: wo.breezewayTaskId
        ? `https://app.breezeway.io/tasks/${wo.breezewayTaskId}`
        : null,
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
