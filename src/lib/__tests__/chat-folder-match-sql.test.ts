// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
// Practice copy of docs/pending/chat-folder-match/apply.sql (Admin, Nov 16). Nothing here touches the real database.
import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { CHAT_FOLDERS } from "@/lib/owner-tab";
import { UPLOAD_FOLDERS } from "@/lib/home-details";

const APPLY = readFileSync("docs/pending/chat-folder-match/apply.sql", "utf8");
const UNDO = readFileSync("docs/pending/chat-folder-match/apply.undo.sql", "utf8");
const OWNER = "00000000-0000-4000-8000-0000000000a1";
const STAFF = "00000000-0000-4000-8000-0000000000a2";
const OTHER_OWNER = "00000000-0000-4000-8000-0000000000a3";
const HOME = "00000000-0000-4000-8000-0000000000b1";
const HOME2 = "00000000-0000-4000-8000-0000000000b2";

const SCHEMA = `
CREATE SCHEMA auth; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
CREATE FUNCTION public.home_chat_staff(u uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT u = '${STAFF}'::uuid $$;
CREATE FUNCTION public.home_owner_contact_writer(p uuid, u uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT u = '${STAFF}'::uuid $$;
CREATE FUNCTION public.home_owner_member(p uuid, u uuid) RETURNS boolean LANGUAGE sql AS $$
  SELECT (u = '${OWNER}'::uuid AND p = '${HOME}'::uuid) OR (u = '${OTHER_OWNER}'::uuid AND p = '${HOME2}'::uuid) $$;
CREATE FUNCTION public.format_property_label(j jsonb) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('primary', j->>'name') $$;
CREATE FUNCTION public.home_chat_team_recipients(p uuid) RETURNS uuid[] LANGUAGE sql AS $$ SELECT ARRAY['${STAFF}'::uuid] $$;
CREATE TABLE public.notices(kind text, n int);
CREATE FUNCTION public.home_chat_notify(r uuid[], a uuid, k text, t text, b text, m uuid, l text, d boolean) RETURNS void LANGUAGE sql AS
  $$ INSERT INTO public.notices VALUES (k, coalesce(array_length(r,1),0)) $$;
CREATE TABLE public.properties(id uuid PRIMARY KEY, name text, is_demo boolean DEFAULT false);
CREATE TABLE public.profiles(id uuid PRIMARY KEY, full_name text, email text);
CREATE TABLE public.documents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, entity_type text, entity_id uuid,
  uploaded_by uuid, visibility text, deleted_at timestamptz);
CREATE TABLE public.home_chats(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, kind text, UNIQUE(property_id, kind));
CREATE TABLE public.home_chat_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), chat_id uuid, author_id uuid, author_type text,
  body text, attachments jsonb, mentions uuid[], is_demo boolean, created_at timestamptz DEFAULT now());
CREATE TABLE public.home_chat_reads(chat_id uuid, user_id uuid, last_read_at timestamptz, PRIMARY KEY(chat_id, user_id));
CREATE TABLE public.audit_log(actor_id uuid, actor_label text, action text, entity_type text, entity_label text, reason text);
INSERT INTO public.properties(id, name) VALUES ('${HOME}', '1399 Foxtail Ln'), ('${HOME2}', '9211 Fitzgerald Dr');
`;

let db: PGlite;
const one = async (sql: string, args: unknown[] = []) => (await db.query(sql, args)).rows[0];
const as = (uid: string) => db.exec(`SET test.uid = '${uid}'`);
const post = (home: string, kind: string, att: unknown[]) =>
  one("SELECT public.post_home_chat_message($1, $2, 'Here is the photo', $3::jsonb, '{}') id", [home, kind, JSON.stringify(att)]);
const doc = async (by: string, vis = "owner_shared", home = HOME) =>
  (await one("INSERT INTO public.documents(property_id, entity_type, entity_id, uploaded_by, visibility) VALUES ($1, 'property', $1, $2, $3) RETURNING id", [home, by, vis])).id;
const fail = async (p: Promise<unknown>) => { try { await p; return null; } catch (e) { return (e as Error).message; } };

beforeEach(async () => {
  db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(APPLY);
});

describe("Team chat attachments use the home's Files folders", () => {
  it("the picker's folder list is the Files tab's five folders, and the save check accepts exactly that list", () => {
    expect(CHAT_FOLDERS.map((f) => f.id)).toEqual(UPLOAD_FOLDERS.map((f) => f.id));
    expect(CHAT_FOLDERS.map((f) => f.id)).toEqual(["design", "agreements", "estimates", "photos", "inspections"]);
    const list = /NOT IN \(([^)]*)\) THEN\s+RAISE EXCEPTION 'Choose a folder/.exec(APPLY)![1]!.split(",").map((s) => s.trim().replace(/'/g, ""));
    expect(list).toEqual(CHAT_FOLDERS.map((f) => f.id));
  });

  for (const kind of ["team", "owner"]) {
    it(`a staff member attaches a file in the ${kind} chat with each picker folder`, async () => {
      await as(STAFF);
      for (const f of CHAT_FOLDERS) {
        const d = await doc(STAFF, "internal");
        await post(HOME, kind, [{ document_id: d, name: "x.pdf", folder: f.id }]);
      }
      expect((await one("SELECT count(*)::int n FROM public.home_chat_messages WHERE author_type = 'staff'")).n).toBe(5);
    });
  }

  it("a staff file with no folder, Other, or an old folder name is refused", async () => {
    const d = await doc(STAFF, "internal");
    await as(STAFF);
    for (const folder of [undefined, "other", "media", "property_ownership"]) {
      expect(await fail(post(HOME, "team", [{ document_id: d, name: "x", ...(folder ? { folder } : {}) }]))).toContain("Choose a folder");
    }
  });

  it("the owner-side rule is unchanged", async () => {
    const mine = await doc(OWNER);
    const internal = await doc(STAFF, "internal");
    await as(OWNER);
    await post(HOME, "owner", [{ document_id: mine, name: "porch.jpg", folder: "photos" }]);
    expect(await fail(post(HOME, "owner", [{ document_id: internal, name: "x", folder: "photos" }]))).toContain("not in this home's Files");
    expect(await fail(post(HOME, "team", [{ document_id: mine, name: "x", folder: "photos" }]))).toContain("team only");
  });

  it("writes one audit row, and undo restores the earlier list", async () => {
    expect((await one("SELECT count(*)::int n FROM public.audit_log WHERE action = 'chat_folder_match_applied'")).n).toBe(1);
    await db.exec(UNDO);
    const d = await doc(STAFF, "internal");
    await as(STAFF);
    expect(await fail(post(HOME, "team", [{ document_id: d, name: "x", folder: "design" }]))).toContain("Choose a folder");
    await post(HOME, "team", [{ document_id: d, name: "x", folder: "media" }]);
    expect((await one("SELECT count(*)::int n FROM public.audit_log WHERE action = 'chat_folder_match_undone'")).n).toBe(1);
  });
});
