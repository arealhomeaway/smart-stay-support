// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
// Practice copy of docs/pending/owner-chat-attach/apply.sql (Admin, Nov 16). Nothing here touches the real database.
import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const APPLY = readFileSync("docs/pending/owner-chat-attach/apply.sql", "utf8");
const UNDO = readFileSync("docs/pending/owner-chat-attach/apply.undo.sql", "utf8");
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

describe("Homeowner attaches a file in the home's owner chat", () => {
  it("a homeowner attaches a file they uploaded to their own home, in the owner chat", async () => {
    const d = await doc(OWNER);
    await as(OWNER);
    await post(HOME, "owner", [{ document_id: d, name: "porch.jpg", folder: "photos" }]);
    const m = await one("SELECT author_type, attachments FROM public.home_chat_messages");
    expect(m.author_type).toBe("owner");
    expect(m.attachments).toEqual([{ document_id: d, name: "porch.jpg", folder: "photos" }]);
    expect(await one("SELECT kind FROM public.notices")).toEqual({ kind: "owner_chat_message" });
  });

  it("a homeowner cannot attach a team file or a file someone else uploaded", async () => {
    const internal = await doc(STAFF, "internal");
    const shared = await doc(STAFF, "owner_shared");
    await as(OWNER);
    expect(await fail(post(HOME, "owner", [{ document_id: internal, name: "x", folder: "photos" }]))).toContain("not in this home's Files");
    expect(await fail(post(HOME, "owner", [{ document_id: shared, name: "x", folder: "photos" }]))).toContain("not in this home's Files");
    expect((await one("SELECT count(*)::int n FROM public.home_chat_messages")).n).toBe(0);
  });

  it("a homeowner cannot attach in another home's chat or in the team chat", async () => {
    const d = await doc(OWNER);
    await as(OWNER);
    expect(await fail(post(HOME2, "owner", [{ document_id: d, name: "x", folder: "photos" }]))).toContain("not post");
    expect(await fail(post(HOME, "team", [{ document_id: d, name: "x", folder: "photos" }]))).toContain("team only");
  });

  it("the team side is unchanged: a folder from its own list is still required", async () => {
    const d = await doc(STAFF, "internal");
    await as(STAFF);
    expect(await fail(post(HOME, "owner", [{ document_id: d, name: "x" }]))).toContain("Choose a folder");
    await post(HOME, "owner", [{ document_id: d, name: "x", folder: "media" }]);
    expect((await one("SELECT author_type FROM public.home_chat_messages")).author_type).toBe("staff");
  });

  it("writes one audit row, and undo restores team-only attaching", async () => {
    expect((await one("SELECT count(*)::int n FROM public.audit_log WHERE action = 'owner_chat_attach_applied'")).n).toBe(1);
    await db.exec(UNDO);
    const d = await doc(OWNER);
    await as(OWNER);
    expect(await fail(post(HOME, "owner", [{ document_id: d, name: "x", folder: "photos" }]))).toContain("team side only");
    expect((await one("SELECT count(*)::int n FROM public.audit_log WHERE action = 'owner_chat_attach_undone'")).n).toBe(1);
  });
});
