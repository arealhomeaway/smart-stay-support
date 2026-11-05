/**
 * Admin-only Notion ticket import. Runs only when an Admin presses a button,
 * never on a schedule. Reads Notion only. Writes go through the pending
 * caller-authenticated import functions (docs/pending/notion-ticket-import).
 * Each call handles one small batch and returns a cursor, so an interrupted
 * run resumes where it stopped and a rerun updates instead of duplicating.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  emptyReport,
  inScope,
  mapComment,
  mapNotionPage,
  relationIds,
  safeFileName,

  text,
  type RunReport,
  type StaffUser,
} from "./notion-import/mapping";
import { ATTACHMENT_BUCKET } from "./attachments";

type Ctx = { supabase: SupabaseClient<Database>; userId: string };
// The import functions are staged, so they are not in the generated types yet.
type LooseRpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
// Bind: supabase-js rpc reads this.rest, so a detached reference crashes.
const rpc = (ctx: Ctx) => ctx.supabase.rpc.bind(ctx.supabase) as unknown as LooseRpc;

async function assertAdmin({ supabase, userId }: Ctx) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("Only an Admin can run the Notion import.");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const NOT_READY = /could not find the function|does not exist|schema cache/i;
const READY_MESSAGE = "The import is waiting for its database change. Nothing was written.";

async function context() {
  const db = await admin();
  const [staffRes, rolesRes, propsRes] = await Promise.all([
    db.from("profiles").select("id, full_name, email"),
    db.from("user_roles").select("user_id, role"),
    db.from("properties").select("id, ownerrez_property_id").eq("is_demo", false),
  ]);
  if (staffRes.error || rolesRes.error || propsRes.error) throw new Error("Could not read Resolve users and homes.");
  const staffIds = new Set(
    (rolesRes.data ?? []).filter((r) => ["admin", "manager", "tech", "onboarding"].includes(String(r.role))).map((r) => r.user_id),
  );
  const staff: StaffUser[] = (staffRes.data ?? []).filter((p) => staffIds.has(p.id) && !/resolve-test\.invalid$/i.test(p.email ?? ""));
  const propertyByOwnerRez = new Map<string, string>();
  for (const p of propsRes.data ?? []) {
    const id = String(p.ownerrez_property_id ?? "").replace(/^ORP/i, "").trim();
    if (id) propertyByOwnerRez.set(id, p.id);
  }
  return { staff, propertyByOwnerRez };
}

async function saveReport(userId: string, runId: string, report: RunReport, done: boolean) {
  const db = await admin();
  await db.from("integration_events").insert({
    system: "notion_ticket_import",
    direction: "inbound",
    entity_type: "notion_import_run",
    external_id: runId,
    operation: report.pass,
    status: report.failures.length ? "failed" : done ? "completed" : "partial",
    request_payload: report as never,
    resolved_by: userId,
  } as never);
}

const runIdOf = (v: unknown) => (typeof v === "string" && /^[\w-]{6,64}$/.test(v) ? v : crypto.randomUUID());

// ---------- dry run and Pass 1 ----------
async function ticketBatch(ctx: Ctx, cursor: string | null, write: boolean) {
  const { queryTicketPage, pidOwnerRez } = await import("./notion-import/notion.server");
  const { staff, propertyByOwnerRez } = await context();
  const page = await queryTicketPage(cursor);
  const report = emptyReport(write ? "pass1" : "dry_run");
  for (const p of page.results) {
    if (!inScope(p)) continue;
    report.inScope++;
    const title = text(p, "Issue Description") || "Imported Notion ticket";
    try {
      const pidOwnerRezMap = new Map<string, string | null>();
      let homeLabel: string | null = null;
      for (const pid of relationIds(p, "Property Address")) {
        const info = await pidOwnerRez(pid);
        pidOwnerRezMap.set(pid, info.ownerRez);
        homeLabel ??= info.label;
      }
      const out = mapNotionPage(p, { staff, pidOwnerRez: pidOwnerRezMap, propertyByOwnerRez, homeLabel });
      if (out.missingLogin) report.unassignedMissingLogin.push({ title, assignee: out.missingLogin });
      if (out.ticket.import_hold === "needs_home") report.needsHome.push({ title, home: out.formerProperty ?? homeLabel ?? "none" });
      if (out.ticket.import_hold === "backlog_review") report.backlog++;
      if (out.ticket.claim) report.claims++;
      if (!write) continue;
      const { data, error } = await rpc(ctx)("import_notion_ticket", { p: out.ticket });
      if (error) {
        if (NOT_READY.test(error.message)) throw new Error(READY_MESSAGE);
        report.failures.push({ title, error: error.message });
        continue;
      }
      const action = (data as { action?: string } | null)?.action;
      if (action === "created") report.created++;
      else if (action === "updated") report.updated++;
      else report.skipped++;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (message === READY_MESSAGE) throw e;
      report.failures.push({ title, error: message });
    }
  }
  return { report, nextCursor: page.has_more ? page.next_cursor : null };
}

const cursorInput = (input: { cursor?: string | null; runId?: string } | undefined) => ({
  cursor: typeof input?.cursor === "string" && input.cursor.length < 200 ? input.cursor : null,
  runId: runIdOf(input?.runId),
});

export const notionImportDryRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(cursorInput)
  .handler(async ({ data, context: ctx }) => {
    await assertAdmin(ctx);
    const { report, nextCursor } = await ticketBatch(ctx, data.cursor, false);
    return { runId: data.runId, report, nextCursor };
  });

export const notionImportPass1 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(cursorInput)
  .handler(async ({ data, context: ctx }) => {
    await assertAdmin(ctx);
    const { report, nextCursor } = await ticketBatch(ctx, data.cursor, true);
    await saveReport(ctx.userId, data.runId, report, !nextCursor);
    return { runId: data.runId, report, nextCursor };
  });

// ---------- Pass 2: comments and files ----------
const PASS2_BATCH = 2;
const MAX_FILE_BYTES = 250 * 1024 * 1024;

export const notionImportPass2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { cursor?: string | null; runId?: string } | undefined) => ({
    offset: Math.max(0, Number(input?.cursor ?? 0) || 0),
    runId: runIdOf(input?.runId),
  }))
  .handler(async ({ data, context: ctx }) => {
    await assertAdmin(ctx);
    const { listComments, pageBody, commentFiles, notionUserName } = await import("./notion-import/notion.server");
    const db = await admin();
    const report = emptyReport("pass2");
    const { data: tickets, error } = await db
      .from("tickets")
      .select("id, title, external_id")
      .eq("external_source", "notion")
      .order("ref", { ascending: true })
      .range(data.offset, data.offset + PASS2_BATCH - 1);
    if (error) throw new Error("Could not read imported tickets.");

    for (const t of tickets ?? []) {
      try {
        const comments = await listComments(t.external_id!);
        const body = await pageBody(t.external_id!);
        const rows = [];
        for (const c of comments) rows.push(mapComment(c, await notionUserName(c.created_by?.id)));
        if (body.text.trim()) rows.push({ external_id: `body:${t.external_id}`, created_at: "", author: "Notion page notes", body: body.text });
        const inserted = await rpc(ctx)("import_notion_ticket_comments", { p_ticket_id: t.id, p_comments: rows });
        if (inserted.error) {
          if (NOT_READY.test(inserted.error.message)) throw new Error(READY_MESSAGE);
          throw new Error(inserted.error.message);
        }
        report.comments += Number(inserted.data ?? 0);

        const files = [...body.files, ...comments.flatMap(commentFiles)];
        const keys = files.map((f) => f.key);
        const { data: existing } = keys.length
          ? await db.from("documents").select("upload_key").in("upload_key", keys)
          : { data: [] as { upload_key: string | null }[] };
        const have = new Set((existing ?? []).map((d) => d.upload_key));
        for (const f of files) {
          if (have.has(f.key)) { report.skipped++; continue; }
          try {
            const res = await fetch(f.url);
            if (!res.ok) throw new Error(`download failed [${res.status}]`);
            const blob = await res.blob();
            if (blob.size > MAX_FILE_BYTES) throw new Error("larger than 250 MB");
            const path = `ticket/${t.id}/notion-${f.key.replace(/[^\w-]/g, "_")}-${safeFileName(f.name)}`;
            const up = await db.storage.from(ATTACHMENT_BUCKET).upload(path, blob, {
              contentType: blob.type || "application/octet-stream",
              upsert: true,
            });
            if (up.error) throw new Error(up.error.message);
            const rec = await rpc(ctx)("import_notion_ticket_file", {
              p_ticket_id: t.id,
              p: { upload_key: f.key, storage_path: path, title: f.name, original_filename: f.name, mime_type: blob.type || null, size_bytes: blob.size, kind: f.kind },
            });
            if (rec.error) throw new Error(rec.error.message);
            report.files++;
          } catch (e) {
            report.failures.push({ title: `${t.title}: ${f.name}`, error: e instanceof Error ? e.message : String(e) });
          }
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (message === READY_MESSAGE) throw e;
        report.failures.push({ title: t.title, error: message });
      }
    }
    const done = (tickets ?? []).length < PASS2_BATCH;
    await saveReport(ctx.userId, data.runId, report, done);
    return { runId: data.runId, report, nextCursor: done ? null : String(data.offset + PASS2_BATCH) };
  });

export const notionImportHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context: ctx }) => {
    await assertAdmin(ctx);
    const db = await admin();
    const { data } = await db
      .from("integration_events")
      .select("external_id, operation, status, request_payload, created_at")
      .eq("system", "notion_ticket_import")
      .order("created_at", { ascending: false })
      .limit(400);
    const runs = new Map<string, { runId: string; pass: string; startedAt: string; finishedAt: string; status: string; report: RunReport }>();
    for (const row of [...(data ?? [])].reverse()) {
      const id = row.external_id ?? "";
      const r = row.request_payload as unknown as RunReport;
      const cur = runs.get(id);
      if (!cur) runs.set(id, { runId: id, pass: row.operation ?? "", startedAt: row.created_at, finishedAt: row.created_at, status: row.status ?? "", report: r });
      else {
        const { mergeReport } = await import("./notion-import/mapping");
        cur.report = mergeReport(cur.report, r);
        cur.finishedAt = row.created_at;
        cur.status = cur.status === "failed" ? "failed" : row.status ?? cur.status;
      }
    }
    return [...runs.values()].reverse().slice(0, 10);
  });


