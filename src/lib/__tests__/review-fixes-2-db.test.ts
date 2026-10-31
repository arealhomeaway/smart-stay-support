import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

// Isolated database: engine 01/02/03 as applied live, then review-fixes-2. Canonical owner check is
// stubbed with the same conditions as the live private.owner_current_property_for_actor.
const read = (p: string) => readFileSync(p, "utf8");
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = U(3), coOwner = U(4), stranger = U(5), staffer = U(2), stepA = U(30);
const home = U(10), home2 = U(12), prog = U(20), card = U(40), card2 = U(41);
const src = read("src/lib/__tests__/ao-engine-rpcs.test.ts");
const STUBS = src.slice(src.indexOf("const STUBS = `") + 15, src.indexOf("`;", src.indexOf("const STUBS = `"))).replaceAll("${stepA}", stepA);
const CANONICAL = `
CREATE TABLE public.enrolled(program_id uuid, property_id uuid, included boolean DEFAULT true);
CREATE TABLE public.owner_state(program_id uuid PRIMARY KEY, owner_active boolean DEFAULT true);
CREATE TABLE public.extra_roles(user_id uuid);
CREATE FUNCTION private.owner_current_property_for_actor(_actor uuid, _property uuid, _program uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT _actor IS NOT NULL AND EXISTS(SELECT 1 FROM public.owner_programs p
    JOIN public.enrolled e ON e.program_id=p.id AND e.property_id=_property AND e.included
    JOIN public.owner_state o ON o.program_id=p.id AND o.owner_active
    WHERE p.id=_program AND p.archived_at IS NULL AND private.is_program_member(p.id,_actor)
      AND NOT EXISTS(SELECT 1 FROM public.extra_roles r WHERE r.user_id=_actor))
$$;`;
let db: PGlite;
const as = (uid: string | null) => db.query(`SELECT set_config('test.uid',$1,false)`, [uid ?? ""]);
const fnState = async () => (await db.query<{ s: string }>(`SELECT string_agg(p.oid::regprocedure::text||md5(pg_get_functiondef(p.oid))||coalesce(p.proacl::text,'')||p.provolatile::text||coalesce(array_to_string(p.proconfig,','),''),',' ORDER BY p.oid::regprocedure::text) s
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private')`)).rows[0]!.s;
const policies = async () => (await db.query<{ s: string }>(`SELECT string_agg(policyname||roles::text||qual,'|' ORDER BY policyname) s FROM pg_policies WHERE policyname IN ('ao_plan_read','ao_contrib_read')`)).rows[0]!.s;
const anonSet = async () => (await db.query<{ s: string }>(`SELECT coalesce(string_agg(p.oid::regprocedure::text,',' ORDER BY p.oid::regprocedure::text),'') s FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE p.prosecdef AND n.nspname IN ('public','private') AND has_function_privilege('anon',p.oid,'EXECUTE')`)).rows[0]!.s;
const visible = async () => {
  await db.exec("SET ROLE authenticated");
  try { return Number((await db.query<{ n: number }>("SELECT count(*)::int n FROM public.ao_home_plan_cards")).rows[0]!.n); }
  finally { await db.exec("RESET ROLE"); }
};
const planRows = async () => (await db.query("SELECT * FROM public.ao_owner_plan($1)", [prog])).rows.length;
const submit = (pc: string) => db.query("SELECT public.ao_submit_card($1,'{\"a\":1}')", [pc]);
let pc1 = "", pc2 = "", before = { fn: "", pol: "", anon: "" };

describe("review fixes 2, item 1: plan cards use the canonical owner check", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(STUBS + CANONICAL);
    await db.exec(read("docs/pending/ao-engine/01_engine_foundation.sql"));
    await db.exec(read("docs/pending/ao-engine/02_engine_rpcs.sql"));
    await db.exec(read("docs/pending/ao-engine/03_screen_reads.sql"));
    await db.exec(`GRANT USAGE ON SCHEMA public, private, auth TO authenticated; GRANT SELECT ON ALL TABLES IN SCHEMA public, private TO authenticated;
      INSERT INTO public.staff VALUES ('${staffer}', false);
      INSERT INTO public.properties VALUES ('${home}', false), ('${home2}', false);
      INSERT INTO public.owner_programs(id, property_id, owner_user_id, status) VALUES ('${prog}','${home}','${owner}','active');
      INSERT INTO private.members VALUES ('${prog}','${owner}',null),('${prog}','${coOwner}',null);
      INSERT INTO public.enrolled VALUES ('${prog}','${home}',true),('${prog}','${home2}',true);
      INSERT INTO public.owner_state VALUES ('${prog}', true);
      INSERT INTO public.ao_library_cards(id, code, title, lane, stage_window, status, why_text) VALUES
        ('${card}','T01','Paint','critical','anytime','released','Why'),('${card2}','T02','Rugs','critical','anytime','released','Why');
      INSERT INTO public.ao_home_plan_settings(property_id, automated) VALUES ('${home}', true), ('${home2}', true);`);
    pc1 = (await db.query<{ id: string }>(`INSERT INTO public.ao_home_plan_cards(property_id, program_id, card_id, card_version, join_outcome, unlocked_at)
      VALUES ('${home}','${prog}','${card}',1,'open',now()) RETURNING id`)).rows[0]!.id;
    pc2 = (await db.query<{ id: string }>(`INSERT INTO public.ao_home_plan_cards(property_id, program_id, card_id, card_version, join_outcome, unlocked_at)
      VALUES ('${home2}','${prog}','${card2}',1,'open',now()) RETURNING id`)).rows[0]!.id;
    before = { fn: await fnState(), pol: await policies(), anon: await anonSet() };
    await db.exec(read("docs/pending/review-fixes-2/01_plan_card_access.sql"));
    await db.exec(read("docs/pending/review-fixes-2/02_ao_central.sql"));
  });
  afterAll(async () => db?.close());

  it("active members (primary and co-owner) read and submit", async () => {
    await as(coOwner);
    expect(await planRows()).toBe(2);
    expect(await visible()).toBe(2);
    await submit(pc1);
    await as(owner);
    expect((await db.query("SELECT * FROM public.ao_contributions")).rows.length).toBe(1);
  });
  it("home no longer enrolled: its card is hidden and cannot be submitted", async () => {
    await db.exec(`UPDATE public.enrolled SET included=false WHERE property_id='${home2}'`);
    await as(owner);
    expect(await planRows()).toBe(1);
    expect(await visible()).toBe(1);
    await expect(submit(pc2)).rejects.toThrow("Not allowed");
    await db.exec(`UPDATE public.enrolled SET included=true WHERE property_id='${home2}'`);
  });
  it("archived program, inactive owner record, staff role or removed member: no access", async () => {
    const cases = [
      [`UPDATE public.owner_programs SET archived_at=now()`, `UPDATE public.owner_programs SET archived_at=null`],
      [`UPDATE public.owner_state SET owner_active=false`, `UPDATE public.owner_state SET owner_active=true`],
      [`INSERT INTO public.extra_roles VALUES ('${owner}')`, `DELETE FROM public.extra_roles`],
      [`UPDATE private.members SET removed_at=now() WHERE user_id='${owner}'`, `UPDATE private.members SET removed_at=null`],
    ];
    for (const [cut, restore] of cases) {
      await db.exec(cut!);
      await as(owner);
      expect(await planRows()).toBe(0);
      expect(await visible()).toBe(0);
      await expect(submit(pc2)).rejects.toThrow("Not allowed");
      await db.exec(restore!);
    }
    await as(stranger);
    expect(await planRows()).toBe(0);
    await as(null);
    await expect(submit(pc2)).rejects.toThrow("Not allowed");
  });
  it("staff read path is unchanged", async () => {
    await as(staffer);
    expect(await planRows()).toBe(2);
    expect(await visible()).toBe(2);
  });
  it("ACLs kept, ao_central STABLE with fixed search_path, anon set unchanged", async () => {
    expect(await anonSet()).toBe(before.anon);
    const f = (await db.query<{ v: string; c: string[] | null }>(`SELECT provolatile v, proconfig c FROM pg_proc WHERE oid='private.ao_central(date,integer)'::regprocedure`)).rows[0]!;
    expect(f.v).toBe("s");
    expect(f.c).toEqual(["search_path=pg_catalog, public"]);
    for (const fn of ["public.ao_submit_card(uuid,jsonb)", "public.ao_owner_plan(uuid)"]) {
      expect((await db.query<{ ok: boolean }>(`SELECT has_function_privilege('anon','${fn}','EXECUTE') ok`)).rows[0]!.ok).toBe(false);
      expect((await db.query<{ ok: boolean }>(`SELECT has_function_privilege('authenticated','${fn}','EXECUTE') ok`)).rows[0]!.ok).toBe(true);
    }
  });
  it("undo in reverse restores every function, ACL and policy exactly", async () => {
    await db.exec(read("docs/pending/review-fixes-2/undo/02_ao_central.sql"));
    await db.exec(read("docs/pending/review-fixes-2/undo/01_plan_card_access.sql"));
    expect(await fnState()).toBe(before.fn);
    expect(await policies()).toBe(before.pol);
    expect(await anonSet()).toBe(before.anon);
  });
});
