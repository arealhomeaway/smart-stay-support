import { beforeAll, afterAll, describe, it, expect } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

// Isolated database. Permission helpers and the replaced practice-home check are loaded
// byte-for-byte from the captured LIVE definitions; only relations are fixtures.
const root = "docs/pending/co-owners/";
type Fn = { schema: string; name: string; signature: string; definition_base64: string; sha256: string; acl: { grantee: string }[] };
const live = JSON.parse(readFileSync(root + "pass2-live-reference.json", "utf8")) as { functions: Fn[] };
const p3b = JSON.parse(readFileSync(root + "pass3b-live-reference.json", "utf8")) as {
  replaced: { definition_base64: string; live_sha256: string; replacement_base64: string }[];
  dependency_captured: Record<string, { definition_base64: string; sha256: string }>;
};
const decode = (s: string) => Buffer.from(s, "base64").toString("utf8");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const primary = uid(1), existingOwner = uid(2), staffUser = uid(3), admin = uid(4), director = uid(5), manager = uid(6), newLogin = uid(7), demoPrimary = uid(8), demoCo = uid(9);
const progA = uid(10), progB = uid(20), progDemo = uid(30), homeA = uid(11), homeB = uid(21), homeDemo = uid(31);
let db: PGlite;

async function as(user: string | null) {
  await db.query("SELECT set_config('request.test_uid',$1,false)", [user ?? ""]);
}
async function add(user: string | null, program: string, name: string, email: string, account: string | null = null) {
  await as(user);
  await db.exec("SET ROLE authenticated");
  try {
    return (await db.query<{ r: Record<string, unknown> }>("SELECT public.add_program_co_owner($1,$2,$3,$4) r", [program, name, email, account])).rows[0]!.r;
  } finally { await db.exec("RESET ROLE"); }
}
async function remove(user: string | null, program: string, target: string) {
  await as(user);
  await db.exec("SET ROLE authenticated");
  try { return (await db.query<{ r: Record<string, unknown> }>("SELECT public.remove_program_co_owner($1,$2) r", [program, target])).rows[0]!.r; }
  finally { await db.exec("RESET ROLE"); }
}
async function member(program: string, user: string) {
  return (await db.query<{ m: boolean }>("SELECT private.is_program_member($1,$2) m", [program, user])).rows[0]!.m;
}
async function count(sql: string, params: unknown[] = []) {
  return Number((await db.query<{ n: number }>(sql, params)).rows[0]!.n);
}
async function exposure() {
  return (await db.query(`SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) s FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private') AND p.prosecdef AND has_function_privilege('anon',p.oid,'EXECUTE') ORDER BY 1,2,3`)).rows;
}
const def = (name: string) => db.query<{ d: string }>(`SELECT pg_get_functiondef(p.oid) d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname||'.'||p.proname=$1`, [name]).then((r) => r.rows[0]?.d ?? null);
let exposureBefore: unknown[];

describe("pending co-owner provisioning (05) on captured live helpers", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private;
GRANT USAGE ON SCHEMA public, private, auth TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.test_uid',true),'')::uuid $$;
CREATE TYPE public.app_role AS ENUM ('admin','manager','tech','vendor','owner','onboarding');
CREATE TABLE public.user_roles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,role public.app_role,UNIQUE(user_id,role));
CREATE TABLE public.functional_roles(code text,current_seat_holder uuid);
CREATE TABLE auth.users(id uuid PRIMARY KEY,deleted_at timestamptz,banned_until timestamptz,email_confirmed_at timestamptz,email text);
CREATE TABLE public.profiles(id uuid PRIMARY KEY,email text,full_name text,first_name text);
CREATE TABLE public.properties(id uuid PRIMARY KEY,is_demo boolean);
CREATE TABLE public.owner_programs(id uuid PRIMARY KEY,owner_user_id uuid,property_id uuid,status text DEFAULT 'active',is_demo boolean DEFAULT false,archived_at timestamptz,created_at timestamptz DEFAULT now());
CREATE TABLE public.owner_program_properties(program_id uuid,property_id uuid,inclusion_status text,archived_at timestamptz,is_demo boolean);
CREATE TABLE public.audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid,action text,entity_type text,entity_id uuid,before_value jsonb,after_value jsonb,created_at timestamptz DEFAULT now());
CREATE TABLE public.owner_program_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),program_id uuid,property_id uuid,review_id uuid,kind text,summary text,actor_id uuid,previous_value text,new_value text,detail jsonb DEFAULT '{}',created_at timestamptz DEFAULT clock_timestamp());
CREATE TABLE public.owner_welcome_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),program_id uuid,owner_user_id uuid,property_id uuid,recipient text,status text,queued_by uuid,is_demo boolean,UNIQUE(program_id,owner_user_id));
CREATE TABLE public.owner_time_entries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),program_id uuid,owner_user_id uuid,minutes int);
`);
    for (const name of ["private.has_role", "public.has_role", "public.is_onboarding_director", "private.demo_owner_link_ok"]) {
      const f = live.functions.find((x) => x.schema + "." + x.name === name)!;
      expect(sha(decode(f.definition_base64))).toBe(f.sha256);
      await db.exec(decode(f.definition_base64));
      await db.exec(`REVOKE ALL ON FUNCTION ${f.schema}.${f.name}(${f.signature}) FROM PUBLIC`);
      for (const g of f.acl) if (g.grantee !== "postgres") await db.exec(`GRANT EXECUTE ON FUNCTION ${f.schema}.${f.name}(${f.signature}) TO ${g.grantee}`);
    }
    const syn = p3b.dependency_captured["private.is_synthetic_account"]!;
    expect(sha(decode(syn.definition_base64))).toBe(syn.sha256);
    await db.exec(decode(syn.definition_base64));
    await db.exec("REVOKE ALL ON FUNCTION private.is_synthetic_account() FROM PUBLIC; GRANT EXECUTE ON FUNCTION private.is_synthetic_account() TO authenticated, service_role;");
    const users: [string, string, string, string | null][] = [
      [primary, "main@arha-owner.com", "Rachel Main", "owner"], [existingOwner, "mike@arha-owner.com", "Mike Shared", "owner"],
      [staffUser, "staff@arha.com", "Sam Staff", "manager"], [admin, "admin@arha.com", "Ada Admin", "admin"],
      [director, "dir@arha.com", "Dee Director", null], [manager, "mgr@arha.com", "Max Manager", "manager"],
      [demoPrimary, "demo@resolve-test.invalid", "Demo Main", "owner"],
    ];
    for (const [id, email, name, role] of users) {
      await db.query("INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())", [id, email]);
      await db.query("INSERT INTO profiles(id,email,full_name) VALUES($1,$2,$3)", [id, email, name]);
      if (role) await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,$2)", [id, role]);
    }
    await db.exec(`INSERT INTO functional_roles VALUES('onboarding_director','${director}');
INSERT INTO properties VALUES('${homeA}',false),('${homeB}',false),('${homeDemo}',true);
INSERT INTO owner_programs(id,owner_user_id,property_id,is_demo) VALUES('${progA}','${primary}','${homeA}',false),('${progB}','${uid(99)}','${homeB}',false),('${progDemo}','${demoPrimary}','${homeDemo}',true);
INSERT INTO owner_program_properties VALUES('${progDemo}','${homeDemo}','included',NULL,true);
INSERT INTO owner_welcome_messages(program_id,owner_user_id,recipient,status,is_demo) VALUES('${progA}','${primary}','main@arha-owner.com','sent',false);
INSERT INTO audit_log(actor_id,action,entity_type,entity_id,after_value) VALUES('${admin}','owner_program.demo_account_linked','owner_program','${progDemo}',jsonb_build_object('owner_user_id','${demoPrimary}'));`);
    exposureBefore = await exposure();
    await db.exec(readFileSync(root + "01_membership_foundation.sql", "utf8"));
    await db.exec(readFileSync(root + "05_provisioning.sql", "utf8"));
  });
  afterAll(async () => { await db.close(); });

  it("staged replacement matches the proof bytes and leaves the anonymous set unchanged", async () => {
    const r = p3b.replaced[0]!;
    expect(sha(decode(r.definition_base64))).toBe(r.live_sha256);
    expect(await def("private.demo_owner_link_ok")).toBe(decode(r.replacement_base64));
    expect(await exposure()).toEqual(exposureBefore);
    for (const f of ["add_program_co_owner", "remove_program_co_owner", "read_program_homeowners", "read_program_attribution"]) {
      const acl = (await db.query<{ a: string }>(`SELECT proacl::text a FROM pg_proc WHERE proname=$1`, [f])).rows[0]!.a;
      expect(acl).toContain("authenticated=X");
      expect(acl).not.toContain("anon=");
      expect(acl).not.toMatch(/(^|[{,])=X/);
    }
  });

  it("refuses anonymous callers, unauthorized staff and other homeowners", async () => {
    await as(null);
    await db.exec("SET ROLE anon");
    await expect(db.query("SELECT public.add_program_co_owner($1,'Mike','mike@arha-owner.com')", [progA])).rejects.toThrow(/permission denied/);
    await expect(db.query("SELECT public.remove_program_co_owner($1,$2)", [progA, existingOwner])).rejects.toThrow(/permission denied/);
    await db.exec("RESET ROLE");
    await expect(add(null, progA, "Mike Shared", "mike@arha-owner.com")).rejects.toThrow(/Onboarding Director or an Admin/);
    await expect(add(manager, progA, "Mike Shared", "mike@arha-owner.com")).rejects.toThrow(/Onboarding Director or an Admin/);
    await expect(add(primary, progA, "Mike Shared", "mike@arha-owner.com")).rejects.toThrow(/Onboarding Director or an Admin/);
    expect(await count("SELECT count(*) n FROM program_members")).toBe(0);
  });

  it("refuses a staff email and the main homeowner", async () => {
    await expect(add(admin, progA, "Sam Staff", " STAFF@arha.com ")).rejects.toThrow(/belongs to a staff account/);
    await expect(add(admin, progA, "Rachel Main", "main@arha-owner.com")).rejects.toThrow(/already the main homeowner/);
    expect(await count("SELECT count(*) n FROM program_members")).toBe(0);
  });

  it("links an existing owner login, records history, and queues one welcome to the co-owner only", async () => {
    const r = await add(director, progA, "Mike Shared", "Mike@ARHA-owner.com");
    expect(r).toMatchObject({ userId: existingOwner, linkedExisting: true, welcomeQueued: true });
    expect(await member(progA, existingOwner)).toBe(true);
    expect(await member(progB, existingOwner)).toBe(false);
    const w = (await db.query<{ owner_user_id: string; recipient: string; status: string }>("SELECT owner_user_id,recipient,status FROM owner_welcome_messages WHERE program_id=$1 ORDER BY recipient", [progA])).rows;
    expect(w).toEqual([
      { owner_user_id: primary, recipient: "main@arha-owner.com", status: "sent" },
      { owner_user_id: existingOwner, recipient: "mike@arha-owner.com", status: "queued" },
    ]);
    expect(await count("SELECT count(*) n FROM owner_program_events WHERE kind='co_owner_added' AND actor_id=$1", [director])).toBe(1);
    expect(await count("SELECT count(*) n FROM owner_program_events WHERE kind='welcome_queued'")).toBe(1);
    expect(await count("SELECT count(*) n FROM audit_log WHERE action='owner_program.co_owner_added'")).toBe(1);
  });

  it("refuses a duplicate active member without new rows", async () => {
    await expect(add(admin, progA, "Mike Shared", "mike@arha-owner.com")).rejects.toThrow(/already a homeowner/);
    expect(await count("SELECT count(*) n FROM program_members")).toBe(1);
    expect(await count("SELECT count(*) n FROM owner_welcome_messages")).toBe(2);
  });

  it("asks for a login before writing anything, then adds the created login exactly once", async () => {
    const first = await add(admin, progA, "Nina New", "nina@arha-owner.com");
    expect(first).toEqual({ needsAccount: true });
    const again = await add(admin, progA, "Nina New", "nina@arha-owner.com");
    expect(again).toEqual({ needsAccount: true });
    expect(await count("SELECT count(*) n FROM program_members")).toBe(1);
    // The server creates the owner-only login via the canonical path, then calls again.
    await db.query("INSERT INTO auth.users(id,email) VALUES($1,'nina@arha-owner.com')", [newLogin]);
    await db.query("INSERT INTO profiles(id,email,full_name,first_name) VALUES($1,'nina@arha-owner.com','Nina New','Nina')", [newLogin]);
    await expect(add(admin, progA, "Nina New", "nina@arha-owner.com", existingOwner)).rejects.toThrow(/does not match/);
    const done = await add(admin, progA, "Nina New", "nina@arha-owner.com", newLogin);
    expect(done).toMatchObject({ userId: newLogin, linkedExisting: false, welcomeQueued: true });
    expect((await db.query("SELECT role::text r FROM user_roles WHERE user_id=$1", [newLogin])).rows).toEqual([{ r: "owner" }]);
    await expect(add(admin, progA, "Nina New", "nina@arha-owner.com", newLogin)).rejects.toThrow(/already a homeowner/);
    expect(await count("SELECT count(*) n FROM owner_welcome_messages WHERE owner_user_id=$1", [newLogin])).toBe(1);
  });

  it("never removes the main homeowner; removal ends access immediately and keeps hours and history", async () => {
    await expect(remove(admin, progA, primary)).rejects.toThrow(/main homeowner cannot be removed/);
    await expect(remove(manager, progA, existingOwner)).rejects.toThrow(/Onboarding Director or an Admin/);
    await db.exec(`INSERT INTO owner_time_entries(program_id,owner_user_id,minutes) VALUES('${progA}','${primary}',60),('${progA}','${existingOwner}',75);
INSERT INTO owner_program_events(program_id,review_id,kind,summary,actor_id) VALUES('${progA}','${uid(500)}','owner_decision','x','${existingOwner}');`);
    await remove(admin, progA, existingOwner);
    expect(await member(progA, existingOwner)).toBe(false);
    expect(await member(progA, primary)).toBe(true);
    expect(await count("SELECT sum(minutes) n FROM owner_time_entries WHERE program_id=$1", [progA])).toBe(135);
    expect(await count("SELECT count(*) n FROM program_members WHERE user_id=$1 AND removed_at IS NOT NULL AND removed_by=$2", [existingOwner, admin])).toBe(1);
    expect(await count("SELECT count(*) n FROM owner_program_events WHERE kind='co_owner_removed'")).toBe(1);
    expect(await count("SELECT count(*) n FROM audit_log WHERE action='owner_program.co_owner_removed'")).toBe(1);
    await expect(remove(admin, progA, existingOwner)).rejects.toThrow(/not a current co-owner/);
  });

  it("names past and current homeowners and who answered, only for members and staff", async () => {
    await as(primary);
    const rows = (await db.query<{ kind: string; ref_id: string | null; user_id: string; display_name: string | null }>("SELECT * FROM public.read_program_attribution($1)", [progA])).rows;
    expect(rows.filter((r) => r.kind === "member").map((r) => r.display_name).sort()).toEqual(["Mike", "Nina", "Rachel"]);
    expect(rows.find((r) => r.kind === "answer")).toMatchObject({ ref_id: uid(500), user_id: existingOwner });
    await as(existingOwner);
    await expect(db.query("SELECT * FROM public.read_program_attribution($1)", [progA])).rejects.toThrow(/not available/);
    await as(admin);
    const roster = (await db.query<{ user_id: string; role: string }>("SELECT user_id,role FROM public.read_program_homeowners($1)", [progA])).rows;
    expect(roster).toEqual([{ user_id: primary, role: "primary" }, { user_id: newLogin, role: "co_owner" }]);
    await as(primary);
    await expect(db.query("SELECT * FROM public.read_program_homeowners($1)", [progA])).rejects.toThrow(/Onboarding Director or an Admin/);
  });

  it("practice homes: Admin only, practice email only, and the co-owner then passes the practice check", async () => {
    await expect(add(director, progDemo, "Demo Co", "co@resolve-test.invalid")).rejects.toThrow(/practice email only/);
    await expect(add(admin, progDemo, "Demo Co", "co@gmail.com")).rejects.toThrow(/practice email only/);
    await db.query("INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,'co@resolve-test.invalid',now())", [demoCo]);
    await db.query("INSERT INTO profiles(id,email,full_name) VALUES($1,'co@resolve-test.invalid','Demo Co')", [demoCo]);
    expect(await db.query<{ ok: boolean }>("SELECT private.demo_owner_link_ok($1,$2) ok", [demoCo, progDemo]).then((r) => r.rows[0]!.ok)).toBe(false);
    const r = await add(admin, progDemo, "Demo Co", "co@resolve-test.invalid");
    expect(r).toMatchObject({ held: true });
    expect((await db.query("SELECT status FROM owner_welcome_messages WHERE owner_user_id=$1", [demoCo])).rows).toEqual([{ status: "held_demo" }]);
    const ok = (u: string) => db.query<{ ok: boolean }>("SELECT private.demo_owner_link_ok($1,$2) ok", [u, progDemo]).then((x) => x.rows[0]!.ok);
    expect(await ok(demoCo)).toBe(true);
    expect(await ok(demoPrimary)).toBe(true);
    await remove(admin, progDemo, demoCo);
    expect(await ok(demoCo)).toBe(false);
  });

  it("undo restores the exact live practice-home check and removes every new function", async () => {
    await db.exec(readFileSync(root + "undo/05_provisioning.sql", "utf8"));
    expect(await def("private.demo_owner_link_ok")).toBe(decode(p3b.replaced[0]!.definition_base64));
    expect(sha((await def("private.demo_owner_link_ok"))!)).toBe(p3b.replaced[0]!.live_sha256);
    for (const f of ["add_program_co_owner", "remove_program_co_owner", "read_program_homeowners", "read_program_attribution"])
      expect(await def("public." + f)).toBeNull();
    const acl = (await db.query<{ a: string | null }>("SELECT proacl::text a FROM pg_proc WHERE proname='demo_owner_link_ok'")).rows[0]!.a;
    expect(acl ?? "").not.toContain("anon");
    expect(await exposure()).toEqual(exposureBefore);
  });
});
