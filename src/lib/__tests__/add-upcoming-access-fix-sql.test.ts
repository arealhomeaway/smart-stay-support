// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Practice run of docs/pending/add-upcoming-access-fix (Nov 13) on an isolated copy: the Nov 12 live
 * add_upcoming_onboarding_home, then the preflight, the fix and the undo. Fake people and homes only.
 * Rule: Admin, Director of Onboarding and onboarding accounts may add an Upcoming home; Operations
 * (manager) accounts may not.
 */
const DIR = "docs/pending/add-upcoming-access-fix";
const ADMIN = "00000000-0000-4000-8000-0000000000a0";
const DIRECTOR = "00000000-0000-4000-8000-0000000000a1";
const PM = "00000000-0000-4000-8000-0000000000a2";
const OPS = "00000000-0000-4000-8000-0000000000a4";
const REFUSED = "Only the onboarding team can add a home.";

let db: PGlite;
let n = 0;
const as = async (user: string | null) => {
  await db.query("DELETE FROM public.me");
  if (user) await db.query("INSERT INTO public.me VALUES ($1)", [user]);
};
const one = async (sql: string, args: unknown[] = []) => (await db.query(sql, args)).rows[0];
const count = async (sql: string) => Number((await one(sql)).n);
const fails = async (p: Promise<unknown>) => {
  try { await p; } catch (e) { return String((e as Error).message); }
  throw new Error("expected a refusal");
};
const file = (f: string) => readFileSync(`${DIR}/${f}`, "utf8");
const addUpcoming = () => {
  n += 1;
  return one("SELECT public.add_upcoming_onboarding_home($1::uuid, $2, null, 'Round Rock', 'TX', '78664', '2026-12-15'::date, 'DFY lead', null) AS r",
    [`00000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`, `${100 + n} Elm St`]).then((x) => x.r);
};

beforeEach(async () => {
  db = new PGlite();
  await db.exec(readFileSync("src/lib/__tests__/fixtures/onboarding-home-schema.sql", "utf8"));
  await db.exec(`
    INSERT INTO public.user_roles VALUES ('${ADMIN}','admin'), ('${DIRECTOR}','onboarding'), ('${PM}','onboarding'), ('${OPS}','manager');
    INSERT INTO public.directors VALUES ('${DIRECTOR}');
    INSERT INTO public.functional_roles VALUES ('onboarding_director', '${DIRECTOR}', true);
  `);
  await db.exec(readFileSync("docs/pending/onboarding-home/apply.sql", "utf8"));
  await db.exec(file("live-capture/add_upcoming_onboarding_home.sql"));
});

describe("before the fix (live today)", () => {
  it("an Operations account can add an Upcoming home: the gap", async () => {
    await as(OPS);
    expect((await addUpcoming()).ok).toBe(true);
  });
});

describe("the fix", () => {
  it("passes the preflight, then lets the onboarding team and Admin in and keeps Operations out", async () => {
    await db.exec(file("00_preflight.sql"));
    await db.exec(file("apply.sql"));
    for (const who of [ADMIN, DIRECTOR, PM]) {
      await as(who);
      expect((await addUpcoming()).ok).toBe(true);
    }
    for (const who of [OPS, null]) {
      await as(who);
      expect(await fails(addUpcoming())).toContain(REFUSED);
    }
    expect(await count("SELECT count(*) n FROM public.onboarding_projects WHERE project_status = 'Upcoming Property'")).toBe(3);
    expect(await count("SELECT count(*) n FROM public.audit_log WHERE action = 'access_changed' AND entity_label = 'add_upcoming_onboarding_home'")).toBe(1);
  });

  it("changes only the access line", async () => {
    const before = (await one("SELECT pg_get_functiondef('public.add_upcoming_onboarding_home(uuid,text,text,text,text,text,date,text,text)'::regprocedure) d")).d;
    await db.exec(file("apply.sql"));
    const after = (await one("SELECT pg_get_functiondef('public.add_upcoming_onboarding_home(uuid,text,text,text,text,text,date,text,text)'::regprocedure) d")).d;
    const a = before.split("\n"), b = after.split("\n");
    expect(b.length).toBe(a.length);
    const changed = a.filter((line, i) => line !== b[i]);
    expect(changed).toEqual([a.find((l) => l.includes("public.is_onboarding_staff(me)"))]);
  });

  it("the preflight stops a second run", async () => {
    await db.exec(file("apply.sql"));
    expect(await fails(db.exec(file("00_preflight.sql")))).toContain("changed since");
  });

  it("the undo puts back the live version exactly", async () => {
    const live = (await one("SELECT pg_get_functiondef('public.add_upcoming_onboarding_home(uuid,text,text,text,text,text,date,text,text)'::regprocedure) d")).d;
    await db.exec(file("apply.sql"));
    await db.exec(file("apply.undo.sql"));
    expect((await one("SELECT pg_get_functiondef('public.add_upcoming_onboarding_home(uuid,text,text,text,text,text,date,text,text)'::regprocedure) d")).d).toBe(live);
    await db.exec(file("00_preflight.sql"));
    await as(OPS);
    expect((await addUpcoming()).ok).toBe(true);
  });
});
