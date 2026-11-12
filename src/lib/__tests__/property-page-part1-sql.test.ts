// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { DEFAULT_STATUS_STAGE_MAP } from "@/lib/onboarding-home-page";

/**
 * Practice run of docs/pending/property-page-part1/apply.sql and its undo on an isolated copy
 * (property page Part 1, Nov 12). Live column names, fake rows only; nothing touches the real database.
 */
const DIR = "docs/pending/property-page-part1";
const USER = "00000000-0000-4000-8000-0000000000a1";
const HOME = "00000000-0000-4000-8000-0000000000b1";
const TEMPLATE_STEP = "00000000-0000-4000-8000-0000000000c1";

let db: PGlite;
const one = async (sql: string, args: unknown[] = []) => (await db.query(sql, args)).rows[0];
const fails = async (p: Promise<unknown>) => {
  try { await p; } catch (e) { return String((e as Error).message); }
  throw new Error("expected a refusal");
};

beforeEach(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA private;
    CREATE TABLE public.app_settings (key text PRIMARY KEY, value jsonb NOT NULL DEFAULT '{}', updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE public.property_owners (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source text NOT NULL DEFAULT 'ownerrez', source_owner_id text NOT NULL, name text, email text, phone text);
    CREATE TABLE public.onboarding_tasks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid NOT NULL, stage text NOT NULL, title text NOT NULL,
      status text NOT NULL DEFAULT 'open', template_task_id uuid, follow_up_of uuid, carryover_of uuid, created_by uuid,
      updated_at timestamptz NOT NULL DEFAULT now());
    INSERT INTO public.property_owners (source_owner_id, name) VALUES ('1', 'Owner One');
    INSERT INTO public.onboarding_tasks (property_id, stage, title, created_by) VALUES ('${HOME}', 'Intake', 'Added before', '${USER}');
  `);
  await db.exec(readFileSync(`${DIR}/apply.sql`, "utf8"));
});

describe("property page Part 1 staged change (practice on an isolated copy)", () => {
  it("adds preferred method and Telegram to the owner record, with the four methods only", async () => {
    await db.query("UPDATE public.property_owners SET preferred_method = 'text', telegram = 'owner_one'");
    expect(await one("SELECT preferred_method, telegram FROM public.property_owners")).toEqual({ preferred_method: "text", telegram: "owner_one" });
    expect(await fails(db.query("UPDATE public.property_owners SET preferred_method = 'fax'"))).toMatch(/preferred_method_check/);
  });

  it("marks a Task added on the page as one-off, never a plan, follow-up or carry over Task, and the caller cannot change it", async () => {
    const r = async (cols: string, vals: string) =>
      (await one(`INSERT INTO public.onboarding_tasks (property_id, stage, title, ${cols}) VALUES ('${HOME}', 'Intake', 't', ${vals}) RETURNING id, is_one_off`));
    expect((await r("created_by", `'${USER}'`)).is_one_off).toBe(true);
    expect((await r("created_by, template_task_id", `'${USER}', '${TEMPLATE_STEP}'`)).is_one_off).toBe(false);
    expect((await r("created_by, is_one_off", `NULL, true`)).is_one_off).toBe(false);
    const fu = await r("created_by", `'${USER}'`);
    expect((await r("created_by, follow_up_of", `'${USER}', '${fu.id}'`)).is_one_off).toBe(false);
    expect((await r("created_by, carryover_of", `'${USER}', '${fu.id}'`)).is_one_off).toBe(false);
    await db.query("UPDATE public.onboarding_tasks SET is_one_off = false WHERE id = $1", [fu.id]);
    expect((await one("SELECT is_one_off FROM public.onboarding_tasks WHERE id = $1", [fu.id])).is_one_off).toBe(true);
    // Existing rows are not backfilled.
    expect((await one("SELECT is_one_off FROM public.onboarding_tasks WHERE title = 'Added before'")).is_one_off).toBe(false);
  });

  it("seeds the Status to stage map exactly as approved, and keeps an existing value", async () => {
    const row = await one("SELECT value FROM public.app_settings WHERE key = 'onboarding_status_stage_map'");
    expect(row.value).toEqual({ ...DEFAULT_STATUS_STAGE_MAP });
    await db.query("UPDATE public.app_settings SET value = '{\"Repairs\": 4}' WHERE key = 'onboarding_status_stage_map'");
    await db.exec(readFileSync(`${DIR}/apply.undo.sql`, "utf8"));
    await db.query("INSERT INTO public.app_settings (key, value) VALUES ('onboarding_status_stage_map', '{\"Repairs\": 4}')");
    await db.exec(readFileSync(`${DIR}/apply.sql`, "utf8"));
    expect((await one("SELECT value FROM public.app_settings WHERE key = 'onboarding_status_stage_map'")).value).toEqual({ Repairs: 4 });
  });

  it("undo removes exactly what apply added", async () => {
    await db.exec(readFileSync(`${DIR}/apply.undo.sql`, "utf8"));
    const cols = (await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name IN ('property_owners','onboarding_tasks') AND column_name IN ('preferred_method','telegram','is_one_off')",
    )).rows;
    expect(cols).toEqual([]);
    expect((await one("SELECT count(*)::int AS n FROM public.app_settings")).n).toBe(0);
    expect((await one("SELECT count(*)::int AS n FROM pg_proc WHERE proname = 'mark_onboarding_one_off'")).n).toBe(0);
    // Apply again after undo works (repeatable).
    await db.exec(readFileSync(`${DIR}/apply.sql`, "utf8"));
    expect((await one("SELECT count(*)::int AS n FROM public.app_settings")).n).toBe(1);
  });
});
