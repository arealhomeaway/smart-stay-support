/**
 * Admin-only Notion ticket import runner. Nothing runs on a schedule; every
 * call starts from an Admin pressing a button on the Notion import page.
 * Reads Notion only. Writes go through the caller-authenticated database
 * functions import_notion_ticket, import_notion_ticket_comments and
 * import_notion_ticket_file, which refuse anyone who is not an Admin and keep
 * imports quiet (no clocks, routing, alerts or notifications).
 *
 * Each batch call handles a few Notion rows and saves the run state (rules in
 * notion-import/runner.ts), so Stop, Resume and a crash all continue from the
 * saved cursor, and a rerun can never create a duplicate.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  IMPORT_GROUP_LABELS,
  mapComment,
  mapNotionPage,
  mapPageNotes,
  relationIds,
  safeFileName,
  text,
  type ImportGroup,
  type MapContext,
  type NotionPage,
  type StaffUser,
} from "./notion-import/mapping";
import {
  DRY_RUN_PAGE_SIZE,
  FILE_ATTEMPTS,
  MAX_FILE_BYTES,
  RUNNER_SETTINGS_KEY,
  RUN_PAGE_SIZE,
  RunnerRuleError,
  claimBatch,
  countOutcome,
  effectiveStatus,
  emptyBatch,
  emptyDryRun,
  explainNotionProblem,
  failBatch,
  finishBatch,
  leftInGroup,
  parseState,
  planTicketWrite,
  requestStop,
  resumeJob,
  retryDelayMs,
  startJob,
  ticketForWrite,
  type BatchResult,
  type FailedFile,
  type RunnerState,
} from "./notion-import/runner";
import { ATTACHMENT_BUCKET } from "./attachments";
import { cleanNotionText } from "./notion-ticket-display";
import { formatPropertyLabel, type PropertyLabelFields } from "./property-label";
import { CLAIM_STAGE_LABELS } from "./claims";
import { teamOf } from "./coverage-model";
import { priorityMeta } from "@/lib/tickets";

type Ctx = { supabase: SupabaseClient<Database>; userId: string };
type LooseRpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
// Bind: supabase-js rpc reads this.rest, so a detached reference crashes.
const rpc = (ctx: Ctx) => ctx.supabase.rpc.bind(ctx.supabase) as unknown as LooseRpc;

const HOME_CACHE_KEY = "notion_import_home_cache";
const NOT_READY = /could not find the function|does not exist|schema cache/i;
const READY_MESSAGE = "The import is waiting for its database change. Nothing was written.";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function assertAdmin({ supabase, userId }: Ctx) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("Only an Admin can run the Notion import.");
}

/** Privileged client, loaded only after the Admin check: storage copies and the integration log. */
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// ---------- saved state ----------

async function loadSetting(ctx: Ctx, key: string): Promise<unknown> {
  const { data, error } = await ctx.supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
  if (error) throw new Error("Could not read the import status.");
  return data?.value ?? null;
}
async function saveSetting(ctx: Ctx, key: string, value: unknown) {
  const { error } = await ctx.supabase
    .from("app_settings")
    .upsert({ key, value: value as never, updated_by: ctx.userId, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(`Could not save the import status: ${error.message}`);
}
const loadState = async (ctx: Ctx) => parseState(await loadSetting(ctx, RUNNER_SETTINGS_KEY));
const saveState = (ctx: Ctx, s: RunnerState) => saveSetting(ctx, RUNNER_SETTINGS_KEY, s);

async function logBatch(ctx: Ctx, s: RunnerState, result: BatchResult, error: string | null) {
  const j = s.job;
  if (!j) return;
  const db = await admin();
  await db.from("integration_events").insert({
    system: "notion_ticket_import",
    direction: "inbound",
    entity_type: "notion_import_batch",
    external_id: j.runId,
    operation: j.kind === "dry_run" ? "dry_run" : `run_${j.group}`,
    status: error ? "failed" : result.counts.failed || result.failedFiles.length ? "partial" : j.status === "done" ? "completed" : "ok",
    request_payload: {
      batch: j.batches,
      counts: result.counts,
      comments: result.comments,
      files: result.files,
      bytes: result.bytes,
      failures: result.failures.slice(0, 20),
      failedFiles: result.failedFiles.slice(0, 20).map((f) => ({ pageId: f.pageId, name: f.name, error: f.error })),
    } as never,
    error_message: error,
    resolved_by: ctx.userId,
  } as never);
}

// ---------- Resolve lookups ----------

type Lookups = MapContext & { propertyLabels: Map<string, string>; staffNames: Map<string, string> };

async function lookups(ctx: Ctx, cutoffIso: string): Promise<Lookups> {
  const sb = ctx.supabase;
  const [profiles, roles, props, seats, members] = await Promise.all([
    sb.from("profiles").select("id, full_name, email, removed_at, archived_at"),
    sb.from("user_roles").select("user_id, role"),
    sb.from("properties").select("id, ownerrez_property_id, name, nickname, address_line1, unit, city, state, postal_code").eq("is_demo", false),
    sb.from("functional_roles").select("code, team, current_seat_holder, active"),
    sb.from("functional_role_members").select("role_code, user_id"),
  ]);
  if (profiles.error || roles.error || props.error || seats.error || members.error) throw new Error("Could not read Resolve staff and homes.");
  const staffIds = new Set(
    (roles.data ?? []).filter((r) => ["admin", "manager", "tech", "onboarding"].includes(String(r.role))).map((r) => r.user_id),
  );
  // Active staff with a login: a profile exists only for a login; removed and archived people are left out.
  const staff: StaffUser[] = (profiles.data ?? []).filter(
    (p) => staffIds.has(p.id) && !p.removed_at && !p.archived_at && !/resolve-test\.invalid$/i.test(p.email ?? ""),
  );
  const directorIds = new Set<string>();
  const teamByUser = new Map<string, string>();
  for (const r of seats.data ?? []) {
    if (r.code === "director_ops" && r.current_seat_holder) directorIds.add(r.current_seat_holder);
    if (r.active && r.current_seat_holder) {
      const team = r.team ?? teamOf(r.code);
      if (team) teamByUser.set(r.current_seat_holder, team);
    }
  }
  for (const m of members.data ?? []) if (m.role_code === "director_ops" && m.user_id) directorIds.add(m.user_id);
  const propertyByOwnerRez = new Map<string, string>();
  const propertyLabels = new Map<string, string>();
  const propertyStreets = new Map<string, string>();
  for (const p of props.data ?? []) {
    const id = String(p.ownerrez_property_id ?? "").replace(/^ORP/i, "").trim();
    if (id) propertyByOwnerRez.set(id, p.id);
    propertyLabels.set(p.id, formatPropertyLabel(p as PropertyLabelFields).full);
    if (p.address_line1) propertyStreets.set(p.id, String(p.address_line1));
  }
  return {
    staff,
    directorIds,
    homeTeamOf: (id) => (id ? (teamByUser.get(id) ?? null) : null),
    pidOwnerRez: new Map(),
    propertyByOwnerRez,
    propertyStreets,
    propertyLabels,
    staffNames: new Map(staff.map((s) => [s.id, s.full_name ?? "Staff member"])),
    cutoff: Date.parse(cutoffIso),
  };
}

async function mapPage(p: NotionPage, base: Lookups) {
  const { pidOwnerRez } = await import("./notion-import/notion.server");
  const map = new Map<string, string | null>();
  let homeLabel: string | null = null;
  for (const pid of relationIds(p, "Property Address")) {
    const info = await pidOwnerRez(pid);
    map.set(pid, info.ownerRez);
    homeLabel ??= info.label;
  }
  return { out: mapNotionPage(p, { ...base, pidOwnerRez: map, homeLabel }), homeLabel };
}

async function withHomeCache<T>(ctx: Ctx, fn: () => Promise<T>): Promise<T> {
  const srv = await import("./notion-import/notion.server");
  const before = (await loadSetting(ctx, HOME_CACHE_KEY)) as Record<string, { ownerRez: string | null; label: string | null }> | null;
  srv.seedPidCache(before ?? {});
  try {
    return await fn();
  } finally {
    const after = srv.pidCacheSnapshot();
    if (Object.keys(after).length > Object.keys(before ?? {}).length) await saveSetting(ctx, HOME_CACHE_KEY, after).catch(() => undefined);
  }
}

// ---------- comments and files for one ticket ----------

/** notesAt: the ticket's Notion created date, used for the page notes, which carry no date of their own. */
async function copyHistory(ctx: Ctx, ticketId: string, pageId: string, result: BatchResult, onlyKeys?: Set<string>, notesAt = "") {
  const srv = await import("./notion-import/notion.server");
  const db = await admin();
  const comments = await srv.listComments(pageId);
  const body = await srv.pageBody(pageId);
  if (!onlyKeys) {
    const rows = [];
    for (const c of comments) rows.push(mapComment(c, await srv.notionUserName(c.created_by?.id)));
    if (body.text.trim()) rows.push(mapPageNotes(pageId, body.text, notesAt));
    if (rows.length) {
      const inserted = await rpc(ctx)("import_notion_ticket_comments", { p_ticket_id: ticketId, p_comments: rows });
      if (inserted.error) throw new Error(NOT_READY.test(inserted.error.message) ? READY_MESSAGE : inserted.error.message);
      result.comments += Number(inserted.data ?? 0);
    }
  }
  let files = [...body.files, ...comments.flatMap(srv.commentFiles)];
  if (onlyKeys) files = files.filter((f) => onlyKeys.has(f.key));
  const keys = files.map((f) => f.key);
  const { data: existing } = keys.length
    ? await ctx.supabase.from("documents").select("upload_key").in("upload_key", keys)
    : { data: [] as { upload_key: string | null }[] };
  const have = new Set((existing ?? []).map((d) => d.upload_key));
  let allOk = true;
  for (const f of files) {
    if (have.has(f.key)) continue;
    let lastErr = "";
    let ok = false;
    for (let attempt = 0; attempt < FILE_ATTEMPTS && !ok; attempt++) {
      try {
        // Notion links last about an hour, so each file is fetched right after its link is read.
        const res = await fetch(f.url);
        if (!res.ok) throw new Error(`download failed [${res.status}]`);
        const declared = Number(res.headers.get("content-length") ?? 0);
        if (declared > MAX_FILE_BYTES) {
          lastErr = "Larger than 60 MB. Copy it by hand from the Notion page.";
          break;
        }
        const blob = await res.blob();
        if (blob.size > MAX_FILE_BYTES) {
          lastErr = "Larger than 60 MB. Copy it by hand from the Notion page.";
          break;
        }
        const path = `ticket/${ticketId}/notion-${f.key.replace(/[^\w-]/g, "_")}-${safeFileName(f.name)}`;
        const up = await db.storage.from(ATTACHMENT_BUCKET).upload(path, blob, { contentType: blob.type || "application/octet-stream", upsert: true });
        if (up.error) throw new Error(up.error.message);
        const rec = await rpc(ctx)("import_notion_ticket_file", {
          p_ticket_id: ticketId,
          p: { upload_key: f.key, storage_path: path, title: f.name, original_filename: f.name, mime_type: blob.type || null, size_bytes: blob.size, kind: f.kind },
        });
        if (rec.error) throw new Error(rec.error.message);
        result.files++;
        result.bytes += blob.size;
        ok = true;
      } catch (e) {
        lastErr = errText(e);
        if (attempt < FILE_ATTEMPTS - 1) await sleep(retryDelayMs(attempt, null));
      }
    }
    if (!ok) {
      allOk = false;
      result.failedFiles.push({ pageId, ticketId, key: f.key, name: f.name, error: lastErr, at: new Date().toISOString() });
    }
  }
  if (allOk) result.filesCleared.push(pageId);
}

// ---------- one batch ----------

async function runOneBatch(ctx: Ctx, state: RunnerState): Promise<{ result: BatchResult; nextCursor: string | null; restarted: boolean }> {
  const job = state.job!;
  const srv = await import("./notion-import/notion.server");
  const result = emptyBatch();
  const pageSize = job.kind === "dry_run" ? DRY_RUN_PAGE_SIZE : RUN_PAGE_SIZE;
  let restarted = false;
  let page;
  try {
    page = await srv.queryTicketPage({ cursor: job.cursor, pageSize, group: job.group, cutoffIso: job.cutoff });
  } catch (e) {
    if (!srv.isBadCursor(e)) throw e;
    // The saved cursor expired. Start this group again; every write is keyed on the page ID.
    page = await srv.queryTicketPage({ cursor: null, pageSize, group: job.group, cutoffIso: job.cutoff });
    restarted = true;
  }
  const base = await lookups(ctx, job.cutoff);
  if (job.kind === "dry_run") result.dryRun = emptyDryRun();

  for (const p of page.results) {
    if (p.archived || p.in_trash) continue;
    const title = cleanNotionText(text(p, "Issue Description")) || "Imported Notion ticket";
    try {
      const { out } = await mapPage(p, base);
      if (job.kind === "dry_run") {
        result.dryRun = countOutcome(result.dryRun!, out);
        continue;
      }
      if (out.group !== job.group) continue; // belongs to another run
      const { data: existing, error: exErr } = await ctx.supabase
        .from("tickets")
        .select("id, external_status, external_synced_at")
        .eq("external_source", "notion")
        .eq("external_id", p.id)
        .maybeSingle();
      if (exErr) throw new Error(exErr.message);
      const plan = planTicketWrite(existing, out.ticket, job.group!);
      let ticketId = existing?.id ?? null;
      if (plan === "keep_live" || plan === "unchanged" || plan === "keep_existing") {
        result.counts.skipped++;
      } else {
        const { data, error } = await rpc(ctx)("import_notion_ticket", { p: ticketForWrite(plan, out.group, out.ticket) });
        if (error) throw new Error(NOT_READY.test(error.message) ? READY_MESSAGE : error.message);
        const r = data as { action?: string; ticket_id?: string } | null;
        ticketId = r?.ticket_id ?? ticketId;
        if (r?.action === "created" || r?.action === "updated") result.counts.done++;
        else result.counts.skipped++;
      }
      if (ticketId) await copyHistory(ctx, ticketId, p.id, result, undefined, String(out.ticket.reported_at ?? ""));
    } catch (e) {
      const message = errText(e);
      if (message === READY_MESSAGE) throw e;
      result.counts.failed++;
      result.failures.push({ pageId: p.id, group: job.group, title, error: message, at: new Date().toISOString() });
    }
  }
  return { result, nextCursor: page.has_more ? page.next_cursor : null, restarted };
}

// ---------- public shape for the page ----------

async function storageBytes(ctx: Ctx): Promise<number> {
  let total = 0;
  for (let from = 0; from < 50_000; from += 1000) {
    const { data, error } = await ctx.supabase
      .from("documents")
      .select("size_bytes")
      .like("upload_key", "notion:%")
      .range(from, from + 999);
    if (error) return total;
    for (const d of data ?? []) total += Number(d.size_bytes ?? 0);
    if ((data ?? []).length < 1000) break;
  }
  return total;
}

function publicView(state: RunnerState, now: number, bytes: number) {
  return {
    status: effectiveStatus(state, now),
    job: state.job,
    progress: state.progress,
    left: {
      recent_open: leftInGroup(state, "recent_open"),
      older_open: leftInGroup(state, "older_open"),
      closed: leftInGroup(state, "closed"),
    } as Record<ImportGroup, number | null>,
    dryRun: state.dryRun,
    failures: state.failures.slice(-50).reverse(),
    failedFiles: state.failedFiles.slice(-50).reverse(),
    failedFileCount: state.failedFiles.length,
    lastError: state.lastError,
    storageBytes: bytes,
  };
}
export type NotionImportView = ReturnType<typeof publicView>;

const groupOf = (v: unknown): ImportGroup | null =>
  v === "recent_open" || v === "older_open" || v === "closed" ? v : null;
const runIdOf = (v: unknown) => (typeof v === "string" && /^[\w-]{6,64}$/.test(v) ? v : null);

function ruleError(e: unknown): never {
  if (e instanceof RunnerRuleError) throw new Error(e.message);
  throw e;
}

// ---------- server functions ----------

export const notionImportStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context: ctx }) => {
    await assertAdmin(ctx);
    const [state, bytes] = await Promise.all([loadState(ctx), storageBytes(ctx)]);
    return publicView(state, Date.now(), bytes);
  });

/** Reads exactly one ticket and says yes or no, with the reason and what to do. */
export const notionImportCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context: ctx }) => {
    await assertAdmin(ctx);
    const srv = await import("./notion-import/notion.server");
    try {
      const page = await srv.queryTicketPage({ cursor: null, pageSize: 1, group: null, cutoffIso: new Date().toISOString() });
      const first = page.results[0];
      if (!first) return { ok: false as const, reason: "The ticket database answered but has no tickets.", fix: "Check that the connection can see Maintenance Ticket Management." };
      return { ok: true as const, reason: "Notion answered and one ticket was read.", fix: null, ticket: cleanNotionText(text(first, "Issue Description")) || "A ticket with no title" };
    } catch (e) {
      const status = e instanceof srv.NotionError ? e.status : null;
      const body = e instanceof srv.NotionError ? e.body : errText(e);
      return { ok: false as const, ...explainNotionProblem(status, body) };
    }
  });

export const notionImportStart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind?: string; group?: string } | undefined) => ({
    kind: input?.kind === "dry_run" ? ("dry_run" as const) : ("run" as const),
    group: groupOf(input?.group),
  }))
  .handler(async ({ data, context: ctx }) => {
    await assertAdmin(ctx);
    const state = await loadState(ctx);
    let next: RunnerState;
    try {
      next = startJob(state, { kind: data.kind, group: data.group, runId: crypto.randomUUID(), now: Date.now() });
    } catch (e) {
      ruleError(e);
    }
    await saveState(ctx, next);
    return publicView(next, Date.now(), 0);
  });

export const notionImportBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { runId?: string } | undefined) => ({ runId: runIdOf(input?.runId) }))
  .handler(async ({ data, context: ctx }) => {
    await assertAdmin(ctx);
    if (!data.runId) throw new Error("Missing run.");
    let state = await loadState(ctx);
    try {
      state = claimBatch(state, data.runId, Date.now());
    } catch (e) {
      ruleError(e);
    }
    await saveState(ctx, state);
    if (state.job?.status !== "running") return publicView(state, Date.now(), 0);
    try {
      const { result, nextCursor, restarted } = await withHomeCache(ctx, () => runOneBatch(ctx, state));
      const fresh = await loadState(ctx); // picks up a Stop pressed during the batch
      let next = finishBatch({ ...fresh, job: fresh.job ? { ...fresh.job, cursor: state.job!.cursor } : fresh.job }, data.runId, result, nextCursor, Date.now());
      if (restarted) next = { ...next, lastError: "Notion's saved place had expired, so this run started its list again. Nothing was duplicated." };
      await saveState(ctx, next);
      await logBatch(ctx, next, result, null).catch(() => undefined);
      return publicView(next, Date.now(), 0);
    } catch (e) {
      const message = errText(e);
      const next = failBatch(await loadState(ctx), data.runId, message, Date.now());
      await saveState(ctx, next);
      await logBatch(ctx, next, emptyBatch(), message).catch(() => undefined);
      return publicView(next, Date.now(), 0);
    }
  });

export const notionImportStop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context: ctx }) => {
    await assertAdmin(ctx);
    let next: RunnerState;
    try {
      next = requestStop(await loadState(ctx), Date.now());
    } catch (e) {
      ruleError(e);
    }
    await saveState(ctx, next);
    return publicView(next, Date.now(), 0);
  });

export const notionImportResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context: ctx }) => {
    await assertAdmin(ctx);
    let next: RunnerState;
    try {
      next = resumeJob(await loadState(ctx), Date.now());
    } catch (e) {
      ruleError(e);
    }
    await saveState(ctx, next);
    return publicView(next, Date.now(), 0);
  });

/** Tries the listed failed files again, a few tickets at a time, with fresh Notion links. */
export const notionImportRetryFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context: ctx }) => {
    await assertAdmin(ctx);
    const state = await loadState(ctx);
    const s = effectiveStatus(state, Date.now());
    if (s === "running" || s === "stopping") throw new Error("Wait for the run to stop first.");
    const byPage = new Map<string, FailedFile[]>();
    for (const f of state.failedFiles) byPage.set(f.pageId, [...(byPage.get(f.pageId) ?? []), f]);
    const pages = [...byPage.entries()].slice(0, 3);
    const result = emptyBatch();
    for (const [pageId, files] of pages) {
      try {
        await copyHistory(ctx, files[0]!.ticketId, pageId, result, new Set(files.map((f) => f.key)));
      } catch (e) {
        for (const f of files) result.failedFiles.push({ ...f, error: errText(e), at: new Date().toISOString() });
      }
    }
    const fresh = await loadState(ctx);
    const tried = new Set(pages.flatMap(([, fs]) => fs.map((f) => f.key)));
    const next: RunnerState = {
      ...fresh,
      failedFiles: [...fresh.failedFiles.filter((f) => !tried.has(f.key)), ...result.failedFiles],
    };
    await saveState(ctx, next);
    return { copied: result.files, stillFailing: result.failedFiles.length, left: next.failedFiles.length };
  });

/**
 * Copies comments and files again for listed failures whose ticket already
 * exists in Resolve. Never creates or changes a ticket; comments and files
 * already copied are skipped by their Notion IDs. Cleared failures leave the list.
 */
export const notionImportRetryHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context: ctx }) => {
    await assertAdmin(ctx);
    const state = await loadState(ctx);
    const s = effectiveStatus(state, Date.now());
    if (s === "running" || s === "stopping") throw new Error("Wait for the run to stop first.");
    const pageIds = [...new Set(state.failures.map((f) => f.pageId))].slice(0, 3);
    const { data: tickets, error } = pageIds.length
      ? await ctx.supabase
          .from("tickets")
          .select("id, external_id, reported_at")
          .eq("external_source", "notion")
          .in("external_id", pageIds)
      : { data: [] as { id: string; external_id: string | null; reported_at: string | null }[], error: null };
    if (error) throw new Error(error.message);
    const result = emptyBatch();
    const cleared = new Set<string>();
    const stillFailing: { pageId: string; error: string }[] = [];
    for (const t of tickets ?? []) {
      if (!t.external_id) continue;
      try {
        await copyHistory(ctx, t.id, t.external_id, result, undefined, String(t.reported_at ?? ""));
        cleared.add(t.external_id);
      } catch (e) {
        stillFailing.push({ pageId: t.external_id, error: errText(e) });
      }
    }
    const fresh = await loadState(ctx);
    const next: RunnerState = {
      ...fresh,
      failures: fresh.failures.filter((f) => !cleared.has(f.pageId)),
      failedFiles: [...fresh.failedFiles, ...result.failedFiles],
    };
    await saveState(ctx, next);
    return { comments: result.comments, files: result.files, cleared: cleared.size, stillFailing, noTicket: pageIds.length - (tickets ?? []).length };
  });

export type SampleRow = {
  pageId: string;
  url: string | null;
  title: string;
  group: string;
  notionAssignee: string;
  assignee: string;
  team: string;
  priority: string;
  claim: string;
  home: string;
  comments: { author: string; date: string; text: string }[];
};

const TEAM_LABEL = { team_a: "Team A", team_b: "Team B", unassigned: "Unassigned" } as const;

/** Read-only: 20 tickets exactly as the runner would import them. Writes nothing. */
export const notionImportSample = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context: ctx }) => {
    await assertAdmin(ctx);
    const srv = await import("./notion-import/notion.server");
    const cutoffIso = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const base = await lookups(ctx, cutoffIso);
    const want: [ImportGroup, number][] = [["recent_open", 8], ["older_open", 6], ["closed", 6]];
    const rows: SampleRow[] = [];
    await withHomeCache(ctx, async () => {
      for (const [group, n] of want) {
        const page = await srv.queryTicketPage({ cursor: null, pageSize: n + 4, group, cutoffIso });
        let taken = 0;
        for (const p of page.results) {
          if (taken >= n || p.archived || p.in_trash) continue;
          const { out } = await mapPage(p, base);
          if (out.group !== group) continue;
          taken++;
          const comments = await srv.listComments(p.id, 3);
          const firstLines = [];
          for (const c of comments.slice(0, 3)) {
            const m = mapComment(c, await srv.notionUserName(c.created_by?.id));
            firstLines.push({ author: m.author, date: m.created_at, text: cleanNotionText(m.body).slice(0, 160) });
          }
          const t = out.ticket;
          rows.push({
            pageId: p.id,
            url: t.external_url,
            title: cleanNotionText(t.title),
            group: IMPORT_GROUP_LABELS[out.group],
            notionAssignee: out.notionAssignee ? cleanNotionText(out.notionAssignee) : "Blank",
            assignee: t.assigned_to ? (base.staffNames.get(t.assigned_to) ?? "Staff member") : "Unassigned",
            team: out.teamGroup ? TEAM_LABEL[out.teamGroup] : "Not in the queue",
            priority: priorityMeta(t.priority).short,
            claim: !t.claim ? "No claim" : t.waiting_reason === "claim review" ? "Claim review" : CLAIM_STAGE_LABELS[t.claim.stage],
            home: t.property_id ? (base.propertyLabels.get(t.property_id) ?? "Home") : "Needs a home",
            comments: firstLines,
          });
        }
      }
    });
    return rows;
  });
