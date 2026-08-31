/**
 * Operations ticket and productivity analytics.
 *
 * Live records only: archived pre-launch imports and demo rows never enter a
 * figure, matching the clean reporting baseline used across Resolve.
 *
 * Contributor attribution comes from the immutable activity log
 * (`ticket_activity`), not from the ticket's current assignee — credit follows
 * what a person actually did, and a later handoff never rewrites history.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

export type OpsBucket = { key: string; label: string; count: number };

export type ContributorRow = {
  userId: string;
  name: string;
  email: string | null;
  /** Distinct live tickets this person touched in the window. */
  ticketsTouched: number;
  /** Tickets where this person logged the resolution. */
  resolved: number;
  firstResponses: number;
  actionsStarted: number;
  notes: number;
  handoffsGiven: number;
  handoffsAccepted: number;
  events: number;
  medianResponseMinutes: number | null;
  medianResolutionMinutes: number | null;
  currentlyOwned: number;
  currentlyOverdue: number;
  lastActivityAt: string | null;
};

export type OpsAnalytics = {
  generatedAt: string;
  windowDays: number;
  since: string;
  volume: {
    created: number;
    resolved: number;
    open: number;
    overdue: number;
    unassigned: number;
    byPriority: OpsBucket[];
    byStatus: OpsBucket[];
    byCategory: OpsBucket[];
    bySource: OpsBucket[];
  };
  timing: {
    medianResponseMinutes: number | null;
    averageResponseMinutes: number | null;
    medianActionStartMinutes: number | null;
    medianResolutionMinutes: number | null;
    averageResolutionMinutes: number | null;
    responseByPriority: { priority: string; median: number | null; count: number }[];
    resolutionByPriority: { priority: string; median: number | null; count: number }[];
  };
  sla: {
    responseOnTime: number;
    responseScope: number;
    responseRate: number | null;
    actionOnTime: number;
    actionScope: number;
    actionRate: number | null;
    breachedOpen: number;
    breachedByPriority: OpsBucket[];
  };
  contributors: ContributorRow[];
};

const OPEN_STATUSES = new Set([
  "new",
  "triaged",
  "assigned",
  "in_progress",
  "waiting",
  "waiting_on_vendor",
  "waiting_on_owner",
  "waiting_on_guest",
  "escalated",
  "on_hold",
]);

function minutesBetween(a: string, b: string) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 60000;
}

function median(values: number[]): number | null {
  const s = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (s.length === 0) return null;
  const mid = Math.floor(s.length / 2);
  const v = s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
  return Math.round(v);
}

function average(values: number[]): number | null {
  const s = values.filter((v) => Number.isFinite(v));
  if (s.length === 0) return null;
  return Math.round(s.reduce((n, v) => n + v, 0) / s.length);
}

function tally(rows: (string | null)[], labeller: (k: string) => string = titleize): OpsBucket[] {
  const map = new Map<string, number>();
  for (const raw of rows) {
    const key = raw ?? "unspecified";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, label: labeller(key), count }))
    .sort((a, b) => b.count - a.count);
}

function titleize(value: string) {
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

const RESPONSE_KINDS = new Set(["acknowledged", "response", "first_response"]);

export async function loadOpsAnalytics(
  supabase: Client,
  options: { windowDays?: number; demo?: boolean } = {},
): Promise<OpsAnalytics> {
  const windowDays = options.windowDays ?? 30;
  const demo = options.demo ?? false;
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();

  const base = supabase
    .from("tickets")
    .select(
      "id, priority, status, category, source_channel, reported_at, acknowledged_at, action_started_at, resolved_at, response_due_at, action_due_at, assigned_to, current_action_owner, accountable_owner",
    )
    .is("archived_at", null)
    .gte("reported_at", since);
  const tickets = await (demo ? base.eq("is_demo", true) : base.or("is_demo.is.null,is_demo.eq.false"));
  if (tickets.error) throw tickets.error;
  const rows = tickets.data ?? [];
  const ids = rows.map((t) => t.id);

  const now = Date.now();
  const open = rows.filter((t) => OPEN_STATUSES.has(t.status));
  const overdue = open.filter(
    (t) =>
      (t.response_due_at && !t.acknowledged_at && new Date(t.response_due_at).getTime() < now) ||
      (t.action_due_at && !t.action_started_at && new Date(t.action_due_at).getTime() < now),
  );

  const responseMinutes = rows
    .filter((t) => t.acknowledged_at)
    .map((t) => minutesBetween(t.reported_at, t.acknowledged_at!));
  const actionMinutes = rows
    .filter((t) => t.action_started_at)
    .map((t) => minutesBetween(t.reported_at, t.action_started_at!));
  const resolutionMinutes = rows
    .filter((t) => t.resolved_at)
    .map((t) => minutesBetween(t.reported_at, t.resolved_at!));

  const priorities = [...new Set(rows.map((t) => t.priority))].sort();
  const responseByPriority = priorities.map((priority) => {
    const scope = rows.filter((t) => t.priority === priority && t.acknowledged_at);
    return {
      priority,
      count: scope.length,
      median: median(scope.map((t) => minutesBetween(t.reported_at, t.acknowledged_at!))),
    };
  });
  const resolutionByPriority = priorities.map((priority) => {
    const scope = rows.filter((t) => t.priority === priority && t.resolved_at);
    return {
      priority,
      count: scope.length,
      median: median(scope.map((t) => minutesBetween(t.reported_at, t.resolved_at!))),
    };
  });

  const respScope = rows.filter((t) => t.response_due_at && t.acknowledged_at);
  const respOnTime = respScope.filter(
    (t) => new Date(t.acknowledged_at!) <= new Date(t.response_due_at!),
  );
  const actScope = rows.filter((t) => t.action_due_at && t.action_started_at);
  const actOnTime = actScope.filter(
    (t) => new Date(t.action_started_at!) <= new Date(t.action_due_at!),
  );

  /* ---------------- contributor attribution ---------------- */

  const activity = ids.length
    ? await supabase
        .from("ticket_activity")
        .select("ticket_id, author_id, kind, event_type, created_at, from_owner, to_owner")
        .in("ticket_id", ids)
        .order("created_at")
    : { data: [], error: null };
  if (activity.error) throw activity.error;

  const actorIds = [
    ...new Set(
      [
        ...(activity.data ?? []).map((a) => a.author_id),
        ...rows.map((t) => t.current_action_owner ?? t.assigned_to),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];
  const profiles = actorIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", actorIds)
    : { data: [], error: null };
  if (profiles.error) throw profiles.error;
  const person = new Map((profiles.data ?? []).map((p) => [p.id, p]));

  const ticketById = new Map(rows.map((t) => [t.id, t]));
  type Acc = {
    tickets: Set<string>;
    resolved: Set<string>;
    firstResponses: number;
    actionsStarted: number;
    notes: number;
    handoffsGiven: number;
    handoffsAccepted: number;
    events: number;
    responseMinutes: number[];
    resolutionMinutes: number[];
    lastActivityAt: string | null;
  };
  const acc = new Map<string, Acc>();
  const get = (id: string) => {
    let a = acc.get(id);
    if (!a) {
      a = {
        tickets: new Set(),
        resolved: new Set(),
        firstResponses: 0,
        actionsStarted: 0,
        notes: 0,
        handoffsGiven: 0,
        handoffsAccepted: 0,
        events: 0,
        responseMinutes: [],
        resolutionMinutes: [],
        lastActivityAt: null,
      };
      acc.set(id, a);
    }
    return a;
  };

  // First response credit: the earliest logged action on a ticket that is not
  // the intake event itself. Explicit acknowledgement kinds win when present.
  const responded = new Set<string>();
  for (const e of activity.data ?? []) {
    const t = ticketById.get(e.ticket_id);
    if (!t || !e.author_id) continue;
    const a = get(e.author_id);
    const kind = (e.kind ?? e.event_type ?? "").toLowerCase();
    a.events += 1;
    a.tickets.add(e.ticket_id);
    if (!a.lastActivityAt || (e.created_at ?? "") > a.lastActivityAt) {
      a.lastActivityAt = e.created_at;
    }
    if (kind === "note") a.notes += 1;
    if (kind === "action_started") a.actionsStarted += 1;
    if (kind === "handoff") {
      if (e.from_owner === e.author_id) a.handoffsGiven += 1;
      if (e.to_owner === e.author_id) a.handoffsAccepted += 1;
    }
    const isResponse = kind !== "created" && kind !== "intake";
    if (isResponse && !responded.has(e.ticket_id)) {
      responded.add(e.ticket_id);
      a.firstResponses += 1;
      const at = t.acknowledged_at ?? e.created_at;
      if (at) a.responseMinutes.push(minutesBetween(t.reported_at, at));
    }
    if (kind === "resolved" || kind === "closed") {
      a.resolved.add(e.ticket_id);
      if (t.resolved_at) a.resolutionMinutes.push(minutesBetween(t.reported_at, t.resolved_at));
    }
  }

  const ownedNow = new Map<string, { total: number; overdue: number }>();
  for (const t of open) {
    const owner = t.current_action_owner ?? t.assigned_to;
    if (!owner) continue;
    const cur = ownedNow.get(owner) ?? { total: 0, overdue: 0 };
    cur.total += 1;
    if (overdue.includes(t)) cur.overdue += 1;
    ownedNow.set(owner, cur);
  }
  for (const id of ownedNow.keys()) get(id);

  const contributors: ContributorRow[] = [...acc.entries()]
    .map(([userId, a]) => {
      const p = person.get(userId);
      const owned = ownedNow.get(userId);
      return {
        userId,
        name: p?.full_name?.trim() || p?.email || "Team member",
        email: p?.email ?? null,
        ticketsTouched: a.tickets.size,
        resolved: a.resolved.size,
        firstResponses: a.firstResponses,
        actionsStarted: a.actionsStarted,
        notes: a.notes,
        handoffsGiven: a.handoffsGiven,
        handoffsAccepted: a.handoffsAccepted,
        events: a.events,
        medianResponseMinutes: median(a.responseMinutes),
        medianResolutionMinutes: median(a.resolutionMinutes),
        currentlyOwned: owned?.total ?? 0,
        currentlyOverdue: owned?.overdue ?? 0,
        lastActivityAt: a.lastActivityAt,
      };
    })
    .sort((a, b) => b.ticketsTouched - a.ticketsTouched || b.events - a.events);

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    since,
    volume: {
      created: rows.length,
      resolved: rows.filter((t) => t.resolved_at).length,
      open: open.length,
      overdue: overdue.length,
      unassigned: open.filter((t) => !(t.current_action_owner ?? t.assigned_to)).length,
      byPriority: tally(rows.map((t) => t.priority), (k) => k.toUpperCase()),
      byStatus: tally(rows.map((t) => t.status)),
      byCategory: tally(rows.map((t) => t.category)),
      bySource: tally(rows.map((t) => t.source_channel)),
    },
    timing: {
      medianResponseMinutes: median(responseMinutes),
      averageResponseMinutes: average(responseMinutes),
      medianActionStartMinutes: median(actionMinutes),
      medianResolutionMinutes: median(resolutionMinutes),
      averageResolutionMinutes: average(resolutionMinutes),
      responseByPriority,
      resolutionByPriority,
    },
    sla: {
      responseOnTime: respOnTime.length,
      responseScope: respScope.length,
      responseRate: respScope.length
        ? Math.round((respOnTime.length / respScope.length) * 100)
        : null,
      actionOnTime: actOnTime.length,
      actionScope: actScope.length,
      actionRate: actScope.length ? Math.round((actOnTime.length / actScope.length) * 100) : null,
      breachedOpen: overdue.length,
      breachedByPriority: tally(overdue.map((t) => t.priority), (k) => k.toUpperCase()),
    },
    contributors,
  };
}
