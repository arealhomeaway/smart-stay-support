// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Practice run of docs/pending/task-upload-folder (and its undo) on an isolated copy.
 * The live upload step is loaded from live-capture; helper checks are stubbed to "staff, open record".
 */
const DIR = "docs/pending/task-upload-folder";
const STAFF = "00000000-0000-4000-8000-0000000000a1";
const HOME = "00000000-0000-4000-8000-0000000000b1";
const TASK = "00000000-0000-4000-8000-0000000000c1";

const FIXTURE = `
CREATE SCHEMA private;
CREATE TABLE public.owner_programs (id uuid, owner_record_id uuid);
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_type text, entity_id uuid, property_id uuid, title text,
  original_filename text, mime_type text, size_bytes bigint, kind text, visibility text, storage_path text,
  upload_key text UNIQUE, upload_status text, uploaded_by uuid, note text, category text, is_demo boolean,
  owner_recipient_id uuid, owner_recipient_program_id uuid, fulfils_request_id uuid, requested_from text,
  fulfilled_by_document_id uuid, deleted_at timestamptz, archived_at timestamptz);
CREATE TABLE public.document_recipient_events (document_id uuid, owner_id uuid, program_id uuid, actor_id uuid, event text);
CREATE TABLE public.audit_log (id uuid DEFAULT gen_random_uuid(), actor_id uuid, actor_label text, action text, entity_type text,
  entity_id uuid, entity_label text, reason text, before_value jsonb, after_value jsonb, created_at timestamptz DEFAULT now());
CREATE FUNCTION private.attachment_actor(uuid) RETURNS boolean LANGUAGE sql AS 'SELECT true';
CREATE FUNCTION private.attachment_context(_t text, _id uuid) RETURNS jsonb LANGUAGE sql AS
  $$ SELECT jsonb_build_object('propertyId', '${HOME}', 'isDemo', false, 'closed', false) $$;
CREATE FUNCTION private.owner_current_property_for_actor(uuid, uuid, uuid) RETURNS boolean LANGUAGE sql AS 'SELECT false';
CREATE FUNCTION public.is_supervisor(uuid) RETURNS boolean LANGUAGE sql AS 'SELECT false';
CREATE FUNCTION public.owner_document_access(uuid, uuid) RETURNS boolean LANGUAGE sql AS 'SELECT false';
CREATE FUNCTION private.attachment_recipient(uuid, boolean) RETURNS public.owner_programs LANGUAGE sql AS 'SELECT NULL::uuid, NULL::uuid';
`;

let db: PGlite;
let n = 0;
const begin = async (entityType: string, entityId: string, category: string | null, key?: string) => {
  const k = key ?? `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  const input = { entityType, entityId, uploadKey: k, filename: "a.pdf", mimeType: "application/pdf", sizeBytes: 10, kind: "document",
    path: `${entityType}/${entityId}/${k}-a.pdf`, category };
  const r = await db.query("SELECT public.begin_attachment_upload($1, $2::jsonb) AS r", [STAFF, JSON.stringify(input)]);
  return { key: k, id: r.rows[0].r.documentId };
};
const categoryOf = async (id: string) => (await db.query("SELECT category FROM public.documents WHERE id = $1", [id])).rows[0].category;

beforeEach(async () => {
  db = new PGlite();
  await db.exec(FIXTURE);
  await db.exec(readFileSync(`${DIR}/live-capture/begin_attachment_upload.sql`, "utf8") + ";");
  n = 0;
});

describe("task-upload-folder practice run", () => {
  it("before: the live step drops the folder for a Task upload (it lands in Other)", async () => {
    const d = await begin("onboarding_task", TASK, "agreement");
    expect(await categoryOf(d.id)).toBeNull();
  });

  it("preflight passes on the captured version and the apply keeps the Task folder in one step", async () => {
    await db.exec(readFileSync(`${DIR}/00_preflight.sql`, "utf8"));
    await db.exec(readFileSync(`${DIR}/apply.sql`, "utf8"));
    let refused = "";
    try { await db.exec(readFileSync(`${DIR}/00_preflight.sql`, "utf8")); } catch (e) { refused = String(e.message); }
    expect(refused).toContain("changed since Nov 15");
    for (const c of ["design", "agreement", "estimate_invoice", "media", "assessment"]) {
      const d = await begin("onboarding_task", TASK, c);
      expect(await categoryOf(d.id)).toBe(c);
    }
    expect((await db.query("SELECT count(*)::int n FROM public.audit_log WHERE action = 'task_upload_folder_applied'")).rows[0].n).toBe(1);
  });

  it("a Task upload never takes Other or an unknown folder", async () => {
    await db.exec(readFileSync(`${DIR}/apply.sql`, "utf8"));
    expect(await categoryOf((await begin("onboarding_task", TASK, "other")).id)).toBeNull();
    expect(await categoryOf((await begin("onboarding_task", TASK, "insurance")).id)).toBeNull();
    expect(await categoryOf((await begin("onboarding_task", TASK, null)).id)).toBeNull();
  });

  it("property uploads and other records are unchanged", async () => {
    await db.exec(readFileSync(`${DIR}/apply.sql`, "utf8"));
    expect(await categoryOf((await begin("property", HOME, null)).id)).toBe("other");
    expect(await categoryOf((await begin("property", HOME, "insurance")).id)).toBe("insurance");
    expect(await categoryOf((await begin("ticket", TASK, "agreement")).id)).toBeNull();
  });

  it("a retry of the same Task upload is accepted, not refused as a different attempt", async () => {
    await db.exec(readFileSync(`${DIR}/apply.sql`, "utf8"));
    const first = await begin("onboarding_task", TASK, "media");
    const again = await begin("onboarding_task", TASK, "media", first.key);
    expect(again.id).toBe(first.id);
  });

  it("undo puts back the captured live step exactly", async () => {
    const before = (await db.query("SELECT md5(pg_get_functiondef('public.begin_attachment_upload(uuid, jsonb)'::regprocedure)) m")).rows[0].m;
    await db.exec(readFileSync(`${DIR}/apply.sql`, "utf8"));
    await db.exec(readFileSync(`${DIR}/apply.undo.sql`, "utf8"));
    const after = (await db.query("SELECT md5(pg_get_functiondef('public.begin_attachment_upload(uuid, jsonb)'::regprocedure)) m")).rows[0].m;
    expect(after).toBe(before);
    expect(await categoryOf((await begin("onboarding_task", TASK, "agreement")).id)).toBeNull();
  });
});
