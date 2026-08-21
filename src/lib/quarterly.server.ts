/**
 * Quarterly property reviews (server-only).
 *
 * Every managed home gets a full review every three months, completed on site
 * by a cleaning supervisor. The review is a normal ticket carrying the
 * "Quarterly Property Review — Cleaning" checklist, so it inherits SLAs,
 * closure gates and the activity log like any other work. When the ticket is
 * resolved a database trigger rolls the home's next due date forward.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { OPEN_STATUSES } from "@/lib/tickets";
import { QUARTERLY_WORK_TYPE, quarterlyStatus, type QuarterlyRow } from "@/lib/quarterly";

type Client = SupabaseClient<Database>;

async function quarterlyWorkType(db: Client) {
  const { data, error } = await db
    .from("work_types")
    .select("id, name, playbook_id, response_minutes, action_start_minutes, default_priority, category, bucket")
    .eq("name", QUARTERLY_WORK_TYPE)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("The quarterly review work type is missing from the catalog.");
  return data;
}

/** Market → regional cleaning manager, with the manager's name resolved. */
export async function loadCleaningRegions(db: Client) {
  const [{ data: regions, error }, { data: props }] = await Promise.all([
    db.from("cleaning_regions").select("market, manager_id, manager_name").order("market"),
    db.from("properties").select("market").eq("active", true),
  ]);
  if (error) throw new Error(error.message);

  const counts = new Map<string, number>();
  for (const p of props ?? []) if (p.market) counts.set(p.market, (counts.get(p.market) ?? 0) + 1);

  const known = new Set((regions ?? []).map((r) => r.market));
  const rows = [
    ...(regions ?? []).map((r) => ({
      market: r.market,
      managerId: r.manager_id,
      managerName: r.manager_name,
      propertyCount: counts.get(r.market) ?? 0,
    })),
    ...[...counts.keys()]
      .filter((m) => !known.has(m))
      .map((m) => ({ market: m, managerId: null, managerName: null, propertyCount: counts.get(m) ?? 0 })),
  ].sort((a, b) => a.market.localeCompare(b.market));

  return rows;
}

/** Supervisor action: point a market at the regional cleaning manager who inspects it. */
export async function setCleaningRegionManager(db: Client, market: string, managerId: string | null) {
  let managerName: string | null = null;
  if (managerId) {
    const { data } = await db.from("profiles").select("full_name, email").eq("id", managerId).maybeSingle();
    managerName = data?.full_name ?? data?.email ?? null;
  }
  const { error } = await db
    .from("cleaning_regions")
    .upsert({ market, manager_id: managerId, manager_name: managerName }, { onConflict: "market" });
  if (error) throw new Error(error.message);
  return { market, managerId, managerName };
}

/** Every active home with its review status and any review already in flight. */
export async function loadQuarterlyReviews(db: Client) {
  const wt = await quarterlyWorkType(db);

  const [{ data: props, error: propsError }, { data: tickets, error: ticketsError }, regions] = await Promise.all([
    db
      .from("properties")
      .select("id, name, nickname, city, state, market, last_quarterly_review_at, quarterly_review_due_on")
      .eq("active", true)
      .order("quarterly_review_due_on"),
    db
      .from("tickets")
      .select("id, ref, property_id, status, due_at, assigned_to, current_action_owner, created_at")
      .eq("work_type_id", wt.id)
      .in("status", OPEN_STATUSES),
    loadCleaningRegions(db),
  ]);
  if (propsError) throw new Error(propsError.message);
  if (ticketsError) throw new Error(ticketsError.message);

  const openByProperty = new Map<string, (typeof tickets)[number]>();
  for (const t of tickets ?? []) if (t.property_id) openByProperty.set(t.property_id, t);
  const managerByMarket = new Map(regions.map((r) => [r.market, r.managerName]));

  const rows: QuarterlyRow[] = (props ?? []).map((p) => {
    const open = openByProperty.get(p.id) ?? null;
    return {
      propertyId: p.id,
      name: p.nickname ? `${p.name} (${p.nickname})` : p.name,
      location: [p.city, p.state].filter(Boolean).join(", "),
      market: p.market,
      inspector: (p.market ? managerByMarket.get(p.market) : null) ?? null,
      lastReviewedAt: p.last_quarterly_review_at,
      dueOn: p.quarterly_review_due_on,
      openTicketId: open?.id ?? null,
      openTicketRef: open?.ref ?? null,
      status: quarterlyStatus(p.quarterly_review_due_on, Boolean(open)),
    };
  });

  return { rows, regions, checklistPlaybookId: wt.playbook_id };
}


/** Opens the quarterly review ticket for one home, checklist attached. */
export async function openQuarterlyReview(db: Client, userId: string, propertyId: string) {
  const wt = await quarterlyWorkType(db);

  const { data: existing } = await db
    .from("tickets")
    .select("id")
    .eq("work_type_id", wt.id)
    .eq("property_id", propertyId)
    .in("status", OPEN_STATUSES)
    .maybeSingle();
  if (existing) return { ticketId: existing.id, alreadyOpen: true };

  const { data: property, error: propError } = await db
    .from("properties")
    .select("name, nickname, market")
    .eq("id", propertyId)
    .single();
  if (propError) throw new Error(propError.message);

  // The regional cleaning manager for the home's market conducts the inspection.
  let inspectorId: string | null = null;
  let inspectorName: string | null = null;
  if (property.market) {
    const { data: region } = await db
      .from("cleaning_regions")
      .select("manager_id, manager_name")
      .eq("market", property.market)
      .maybeSingle();
    inspectorId = region?.manager_id ?? null;
    inspectorName = region?.manager_name ?? null;
  }
  const owner = inspectorId ?? userId;


  const now = new Date();
  const responseDue = new Date(now.getTime() + (wt.response_minutes ?? 120) * 60_000);
  const actionDue = new Date(now.getTime() + (wt.action_start_minutes ?? 1440) * 60_000);

  const { data: ticket, error } = await db
    .from("tickets")
    .insert({
      record_type: "active_task",
      title: `Quarterly property review — ${property.nickname ?? property.name}`,
      description:
        "Full quarterly review completed on site by a cleaning supervisor. Work the checklist in order, photograph the required steps, and open a separate ticket for every deficiency found.",
      property_id: propertyId,
      work_type_id: wt.id,
      playbook_id: wt.playbook_id,
      category: wt.category,
      bucket: wt.bucket,
      priority: wt.default_priority,
      suggested_priority: wt.default_priority,
      status: "open",
      guest_impact: "none",
      occupancy_status: "vacant",
      source_channel: "inspection",
      initiator_type: "internal",
      reported_at: now.toISOString(),
      acknowledged_at: now.toISOString(),
      response_due_at: responseDue.toISOString(),
      action_due_at: actionDue.toISOString(),
      due_at: actionDue.toISOString(),
      next_action: inspectorName
        ? `Schedule the on-site inspection with ${inspectorName}`
        : "Assign a regional cleaning manager and schedule the on-site inspection",
      created_by: userId,
      record_owner: owner,
      accountable_owner: owner,
      current_action_owner: owner,
      assigned_to: inspectorId,

    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (wt.playbook_id) {
    const { data: steps } = await db
      .from("playbook_steps")
      .select("position, instruction, detail, required, photo_required")
      .eq("playbook_id", wt.playbook_id)
      .order("position");
    if (steps?.length) {
      const { error: stepError } = await db
        .from("ticket_steps")
        .insert(steps.map((s) => ({ ...s, ticket_id: ticket.id })));
      if (stepError) throw new Error(stepError.message);
    }
  }

  await db.from("ticket_activity").insert({
    ticket_id: ticket.id,
    author_id: userId,
    kind: "created",
    event_type: "created",
    channel: "inspection",
    body: inspectorName
      ? `Quarterly inspection opened with the cleaning review checklist attached and assigned to ${inspectorName}, regional cleaning manager for ${property.market}.`
      : "Quarterly inspection opened with the cleaning review checklist attached. No regional cleaning manager is set for this market yet.",
  });


  return { ticketId: ticket.id, alreadyOpen: false };
}

/** Opens reviews for every home that is due or overdue and has none in flight. */
export async function openDueQuarterlyReviews(db: Client, userId: string) {
  const { rows } = await loadQuarterlyReviews(db);
  const due = rows.filter((r) => !r.openTicketId && (r.status === "due" || r.status === "overdue"));
  let created = 0;
  for (const row of due) {
    await openQuarterlyReview(db, userId, row.propertyId);
    created += 1;
  }
  return { created, skipped: rows.length - due.length };
}
