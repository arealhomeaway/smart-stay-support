// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
/**
 * Build 18 (Emily, Nov 10) item 6b: Edit selected on a home's Tasks shows only to the people the
 * bulk save allows. Isolated PostgreSQL check of docs/pending/build18/01_build18.sql and its undo.
 * Fake people and homes only.
 */
import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const HOME = "00000000-0000-4000-8000-00000000f001";
const OTHER_HOME = "00000000-0000-4000-8000-00000000f002";
const PM = "00000000-0000-4000-8000-0000000000e1";
const OTHER_PM = "00000000-0000-4000-8000-0000000000e2";
const LEADER = "00000000-0000-4000-8000-0000000000e3";
const UTIL = "00000000-0000-4000-8000-0000000000e4";
const OPS = "00000000-0000-4000-8000-0000000000e5";

const STUBS = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private;
CREATE TABLE public.me(id uuid);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.me LIMIT 1 $$;
CREATE TABLE public.staff(id uuid, onboarding boolean, leader boolean);
INSERT INTO public.staff VALUES ('${PM}', true, false), ('${OTHER_PM}', true, false), ('${LEADER}', true, true),
  ('${UTIL}', true, false), ('${OPS}', false, false);
CREATE FUNCTION private.is_onboarding_staff(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT coalesce((SELECT onboarding FROM public.staff WHERE id = _u), false) $$;
CREATE FUNCTION private.is_onboarding_leader(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT coalesce((SELECT leader FROM public.staff WHERE id = _u), false) $$;
CREATE TABLE public.onboarding_projects(id uuid DEFAULT gen_random_uuid(), property_id uuid, status text,
  project_manager uuid, director uuid, created_at timestamptz DEFAULT now());
INSERT INTO public.onboarding_projects(property_id, status, project_manager, director, created_at) VALUES
  ('${HOME}', 'cancelled', '${UTIL}', NULL, now() - interval '2 days'),
  ('${HOME}', 'active', '${PM}', NULL, now() - interval '1 day'),
  ('${OTHER_HOME}', 'active', '${OTHER_PM}', NULL, now());
CREATE FUNCTION private.bonus_pays_on(date) RETURNS text LANGUAGE sql AS $$ SELECT 'x' $$;
`;

let db: PGlite;
const can = async (uid: string | null, home = HOME) => {
  await db.exec("DELETE FROM public.me");
  if (uid) await db.exec(`INSERT INTO public.me VALUES ('${uid}')`);
  return (await db.query(`SELECT public.can_bulk_edit_home_tasks($1) c`, [home])).rows[0].c;
};

describe("Build 18 item 6b: Edit selected follows the bulk save rule", () => {
  beforeEach(async () => {
    db = new PGlite();
    await db.exec(STUBS);
    // The bonus functions in the same file read tables this fixture does not stub.
    await db.exec("SET check_function_bodies = off;\n" + readFileSync("docs/pending/build18/01_build18.sql", "utf8") + "\nSET check_function_bodies = on;");
  });

  it("this home's Project Manager and an onboarding leader may edit", async () => {
    expect(await can(PM)).toBe(true);
    expect(await can(LEADER)).toBe(true);
  });

  it("onboarding staff on another home, staff from a cancelled project, Operations and signed out may not", async () => {
    expect(await can(OTHER_PM)).toBe(false);
    expect(await can(UTIL)).toBe(false);
    expect(await can(OPS)).toBe(false);
    expect(await can(null)).toBe(false);
  });

  it("each home's own lead only edits their own home", async () => {
    expect(await can(OTHER_PM, OTHER_HOME)).toBe(true);
    expect(await can(PM, OTHER_HOME)).toBe(false);
  });

  it("signed out callers cannot run it at all, signed in staff can", async () => {
    const acl = (await db.query(`SELECT proacl::text a FROM pg_proc WHERE proname = 'can_bulk_edit_home_tasks'`)).rows[0].a;
    expect(acl).toContain("authenticated=X");
    expect(acl).not.toContain("anon=X");
  });

  it("the undo removes it", async () => {
    await db.exec("SET check_function_bodies = off;\n" + readFileSync("docs/pending/build18/01_build18.undo.sql", "utf8"));
    expect((await db.query(`SELECT count(*)::int n FROM pg_proc WHERE proname = 'can_bulk_edit_home_tasks'`)).rows[0].n).toBe(0);
  });
});
