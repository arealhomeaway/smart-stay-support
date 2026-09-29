/**
 * STR Cleaner Hours Safeguard — Breezeway ingestion (server-only).
 *
 * Forward-only: nothing is tracked unless the Resolve property is designated
 * as participating (cleaner_hours_properties) and the clean is on/after its
 * start date. The database function `cleaner_ingest_task` is the single
 * normalization path for webhook and nightly reconciliation alike; it stores a
 * new source snapshot only when Breezeway's record actually changed and
 * recalculates the exposure ledger idempotently.
 *
 * Read-only against Breezeway. No thresholds, alerts or dispatch rules here.
 */
import { breezewayRequest, BreezewayError } from "./breezeway.server";

export const RECONCILE_WINDOW_DAYS = 45;
/** Homes handled per scheduled call; keeps each call well inside time limits. */
export const RECONCILE_HOMES_PER_CALL = 6;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type RawTask = { id: number; home_id?: number | null; type_department?: string | null; scheduled_date?: string | null } & Record<string, unknown>;

type Participation = { property_id: string; tracking_from: string; breezeway_property_id: string | null };

export async function participatingProperties(): Promise<Participation[]> {
  const db = await admin();
  const { data, error } = await db
    .from("cleaner_hours_properties")
    .select("property_id, tracking_from, is_fixture, properties!inner(breezeway_property_id, breezeway_mapping_state)")
    .eq("active", true)
    .eq("is_fixture", false);
  if (error) throw new Error(`Could not read STR participation: ${error.message}`);
  return ((data ?? []) as unknown as {
    property_id: string;
    tracking_from: string;
    properties: { breezeway_property_id: string | null; breezeway_mapping_state: string | null };
  }[])
    .filter((r) => r.properties.breezeway_mapping_state === "verified")
    .map((r) => ({
      property_id: r.property_id,
      tracking_from: r.tracking_from,
      breezeway_property_id: r.properties.breezeway_property_id,
    }));
}

async function isTracked(taskId: number) {
  const db = await admin();
  const { data } = await db.from("cleaner_task_state").select("breezeway_task_id").eq("breezeway_task_id", taskId).maybeSingle();
  return !!data;
}

async function participatingPropertyForHome(homeId: number | null | undefined) {
  if (homeId == null) return null;
  const { propertyForHomeId } = await import("./breezeway-mapping.server");
  const property = await propertyForHomeId(homeId);
  if (!property) return null;
  const db = await admin();
  const { data } = await db
    .from("cleaner_hours_properties")
    .select("property_id")
    .eq("property_id", property.id)
    .eq("active", true)
    .maybeSingle();
  return data ? property.id : null;
}

/** Stores/recalculates one Task through the shared database rule. */
export async function ingestRawTask(raw: RawTask, source: "webhook" | "reconcile") {
  const propertyId = raw.home_id != null ? await resolveVerifiedProperty(raw.home_id) : null;
  const db = await admin();
  const { data, error } = await db.rpc("cleaner_ingest_task", {
    _payload: raw as never,
    _property_id: propertyId as never,
    _source: source,
    _fixture: false,
  });
  if (error) throw new Error(`Cleaner ingest failed for Task ${raw.id}: ${error.message}`);
  return data as Record<string, unknown>;
}

async function resolveVerifiedProperty(homeId: number) {
  const { propertyForHomeId } = await import("./breezeway-mapping.server");
  return (await propertyForHomeId(homeId))?.id ?? null;
}

/* Pending activation: a mapped STR home waiting for its first qualifying clean. */
async function pendingHomes(): Promise<string[]> {
  const db = await admin();
  const { data } = await db.from("cleaner_pending_activations").select("breezeway_home_id").is("activated_at", null);
  return ((data ?? []) as { breezeway_home_id: string }[]).map((r) => r.breezeway_home_id);
}

/** The database verifies home, housekeeping and date; imports nothing. */
async function tryActivatePending(t: RawTask) {
  if (t.home_id == null || t.type_department !== "housekeeping" || !t.scheduled_date) return null;
  const db = await admin();
  const { data, error } = await db.rpc("cleaner_activate_pending", {
    _home_id: String(t.home_id),
    _task_id: t.id,
    _department: t.type_department,
    _scheduled_date: String(t.scheduled_date).slice(0, 10),
  });
  if (error) throw new Error(error.message);
  return data;
}

/** Nightly: finds the earliest qualifying housekeeping clean for each pending home. */
export async function checkPendingActivations() {
  const db = await admin();
  const { data } = await db
    .from("cleaner_pending_activations")
    .select("breezeway_home_id, earliest_date")
    .is("activated_at", null);
  for (const p of (data ?? []) as { breezeway_home_id: string; earliest_date: string }[]) {
    const res = await breezewayRequest<{ results?: RawTask[] }>("/task/", {
      params: { home_id: p.breezeway_home_id, type_department: "housekeeping", limit: 1000, page: 1 },
    });
    const first = (res.results ?? [])
      .filter((t) => String(t.home_id) === p.breezeway_home_id && t.type_department === "housekeeping")
      .filter((t) => t.scheduled_date && String(t.scheduled_date).slice(0, 10) >= p.earliest_date)
      .sort((a, b) => String(a.scheduled_date).localeCompare(String(b.scheduled_date)))[0];
    if (first) await tryActivatePending(first);
  }
}

/**
 * Webhook hook. Called after the existing receiver has verified a task update.
 * Cheap exit for everything outside the STR safeguard, so MTR/standard homes
 * cost no extra Breezeway call and store nothing. Never throws.
 */
export async function ingestCleanerTaskFromWebhook(taskId: number, homeId: number | null, department: string | null) {
  try {
    const tracked = await isTracked(taskId);
    if (!tracked) {
      if (department !== "housekeeping") return { skipped: "not housekeeping" };
      if (!(await participatingPropertyForHome(homeId))) {
        if (homeId != null && (await pendingHomes()).includes(String(homeId))) {
          const raw = await breezewayRequest<RawTask>(`/task/${taskId}`);
          await tryActivatePending(raw);
        }
        return { skipped: "property not in STR tracking" };
      }
    }
    const raw = await breezewayRequest<RawTask>(`/task/${taskId}`);
    return await ingestRawTask(raw, "webhook");
  } catch (error) {
    if (error instanceof BreezewayError && error.status === 404) {
      await flagMissing(taskId, "Breezeway no longer returns this Task");
      return { missing: true };
    }
    console.error("[cleaner-hours] webhook ingest failed", error instanceof Error ? error.message : error);
    return { error: true };
  }
}

async function flagMissing(taskId: number, reason: string) {
  const db = await admin();
  const { data: active } = await db
    .from("cleaner_exposure_ledger")
    .select("id, property_id")
    .eq("breezeway_task_id", taskId)
    .is("superseded_at", null)
    .limit(1);
  const row = (active ?? [])[0] as { id: string; property_id: string | null } | undefined;
  if (!row) return;
  const key = `task:missing:${taskId}`;
  const { data: open } = await db.from("cleaner_review_items").select("id").eq("dedupe_key", key).eq("status", "open").maybeSingle();
  if (open) return;
  await db.from("cleaner_review_items").insert({
    kind: "source_missing",
    dedupe_key: key,
    breezeway_task_id: taskId,
    property_id: row.property_id,
    detail: { reason } as never,
  } as never);
}

function chicagoToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
}
function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type RunRow = {
  id: string;
  window_from: string;
  window_to: string;
  home_queue: { property_id: string; home_id: string; tracking_from: string }[];
  cursor: number;
  tasks_seen: number;
  snapshots_created: number;
  errors: unknown[];
  people_refreshed_at: string | null;
  status: string;
};

/**
 * One slice of tonight's reconciliation. Resumable: progress is saved after
 * every home, so a failed or timed-out call simply continues next time.
 */
export async function runReconcileSlice(options: { homesPerCall?: number } = {}) {
  const db = await admin();
  const today = chicagoToday();
  try {
    await checkPendingActivations();
  } catch (e) {
    console.error("[cleaner-hours] pending activation check failed", e instanceof Error ? e.message : e);
  }
  const perCall = options.homesPerCall ?? RECONCILE_HOMES_PER_CALL;

  let { data: run } = await db
    .from("cleaner_sync_runs")
    .select("*")
    .eq("kind", "nightly")
    .eq("window_to", today)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!run) {
    const homes = (await participatingProperties())
      .filter((p) => p.breezeway_property_id)
      .map((p) => ({ property_id: p.property_id, home_id: p.breezeway_property_id!, tracking_from: p.tracking_from }));
    const created = await db
      .from("cleaner_sync_runs")
      .insert({
        kind: "nightly",
        window_from: addDays(today, -RECONCILE_WINDOW_DAYS),
        window_to: today,
        home_queue: homes as never,
      } as never)
      .select("*")
      .single();
    if (created.error) throw new Error(created.error.message);
    run = created.data;
  }
  const r = run as unknown as RunRow;
  if (r.status === "complete") return { runId: r.id, status: "complete", homes: r.home_queue.length };

  // People directory refresh once per night (restores the stalled mirror).
  if (!r.people_refreshed_at) {
    try {
      const { syncBreezewayPeople } = await import("./breezeway-people.server");
      await syncBreezewayPeople();
    } catch (e) {
      console.error("[cleaner-hours] people refresh failed", e instanceof Error ? e.message : e);
    }
    await db.from("cleaner_sync_runs").update({ people_refreshed_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never).eq("id", r.id);
  }

  let cursor = r.cursor;
  let tasksSeen = r.tasks_seen;
  let created = r.snapshots_created;
  const errors = [...(r.errors ?? [])];
  const stop = Math.min(cursor + perCall, r.home_queue.length);

  for (; cursor < stop; cursor++) {
    const home = r.home_queue[cursor]!;
    const from = home.tracking_from > r.window_from ? home.tracking_from : r.window_from;
    try {
      const seen = new Set<number>();
      let page = 1;
      let pages = 1;
      do {
        const data = await breezewayRequest<{ results?: RawTask[]; total_pages?: number }>("/task/", {
          params: { home_id: home.home_id, type_department: "housekeeping", limit: 1000, page },
        });
        pages = data.total_pages || 1;
        for (const t of data.results ?? []) {
          if (t.type_department !== "housekeeping") continue;
          const day = String((t as { finished_at?: string | null }).finished_at ?? t.scheduled_date ?? "").slice(0, 10);
          if (!day || day < from) continue;
          seen.add(t.id);
          tasksSeen += 1;
          const res = await ingestRawTask(t, "reconcile");
          if (res?.["snapshot_created"]) created += 1;
        }
        page += 1;
      } while (page <= pages && page <= 5);

      // Previously tracked Tasks in the window that Breezeway no longer lists.
      const { data: tracked } = await db
        .from("cleaner_exposure_ledger")
        .select("breezeway_task_id")
        .eq("property_id", home.property_id)
        .gte("completion_date", from)
        .is("superseded_at", null)
        .not("breezeway_task_id", "is", null);
      for (const id of new Set(((tracked ?? []) as { breezeway_task_id: number }[]).map((x) => x.breezeway_task_id))) {
        if (!seen.has(id)) await flagMissing(id, "Not returned by Breezeway during nightly reconciliation");
      }
    } catch (e) {
      errors.push({ home: home.home_id, at: new Date().toISOString(), error: e instanceof Error ? e.message.slice(0, 300) : "failed" });
    }
    await db
      .from("cleaner_sync_runs")
      .update({ cursor: cursor + 1, tasks_seen: tasksSeen, snapshots_created: created, errors: errors as never, updated_at: new Date().toISOString() } as never)
      .eq("id", r.id);
  }

  const done = cursor >= r.home_queue.length;
  if (done) {
    await db
      .from("cleaner_sync_runs")
      .update({ status: "complete", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
      .eq("id", r.id);
  }
  return { runId: r.id, status: done ? "complete" : "running", processed: cursor, homes: r.home_queue.length, tasksSeen, snapshotsCreated: created, errors: errors.length };
}
