// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Practice run of docs/pending/temp-email-safety-removal (Nov 13) on an isolated copy with a stand-in
 * scheduler: the live temporary function and job, then the preflight, the removal and the undo.
 */
const DIR = "docs/pending/temp-email-safety-removal";
const JOB = "temp-close-stalled-email-run";
let db: PGlite;
const one = async (sql: string, args: unknown[] = []) => (await db.query(sql, args)).rows[0];
const count = async (sql: string, args: unknown[] = []) => Number((await one(sql, args)).n);
const fails = async (p: Promise<unknown>) => {
  try { await p; } catch (e) { return String((e as Error).message); }
  throw new Error("expected a refusal");
};
const file = (f: string) => readFileSync(`${DIR}/${f}`, "utf8");
const hasFn = async () => (await one("SELECT to_regprocedure('private.temp_close_stalled_email_run()') IS NOT NULL AS x")).x;
const jobs = (name: string) => count("SELECT count(*) n FROM cron.job WHERE jobname = $1", [name]);

beforeEach(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE SCHEMA cron; CREATE SCHEMA private;
    CREATE TABLE cron.job(jobid serial PRIMARY KEY, jobname text UNIQUE, schedule text, command text, active boolean DEFAULT true);
    CREATE FUNCTION cron.schedule(n text, s text, c text) RETURNS bigint LANGUAGE sql AS
      $$ INSERT INTO cron.job(jobname, schedule, command) VALUES (n, s, c) RETURNING jobid::bigint $$;
    CREATE FUNCTION cron.unschedule(n text) RETURNS boolean LANGUAGE plpgsql AS
      $$ BEGIN DELETE FROM cron.job WHERE jobname = n; IF NOT FOUND THEN RAISE EXCEPTION 'could not find valid entry for job %', n; END IF; RETURN true; END $$;
    CREATE TABLE public.email_job_runs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz, errors jsonb);
    CREATE TABLE public.email_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email_job_run_id uuid, created_at timestamptz NOT NULL DEFAULT now());
    CREATE FUNCTION public.finish_email_job_run(_id uuid, _errors jsonb) RETURNS void LANGUAGE sql AS
      $$ UPDATE public.email_job_runs SET finished_at = now(), errors = _errors WHERE id = _id $$;
    CREATE TABLE public.audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid, actor_label text, action text NOT NULL,
      entity_type text NOT NULL, entity_id uuid, entity_label text, reason text, before_value jsonb, after_value jsonb, created_at timestamptz NOT NULL DEFAULT now());
    SELECT cron.schedule('deliver-owner-alerts', '*/5 * * * *', 'SELECT 1');
  `);
  await db.exec(file("live-capture/temp_close_stalled_email_run.sql"));
  await db.exec(`SELECT cron.schedule('${JOB}', '*/5 * * * *', 'SELECT private.temp_close_stalled_email_run();')`);
});

describe("the live copy", () => {
  it("closes a run stalled 20 minutes with no email activity, and nothing else", async () => {
    await db.exec(`INSERT INTO public.email_job_runs(started_at) VALUES (now() - interval '20 minutes'), (now() - interval '2 minutes')`);
    expect((await one("SELECT private.temp_close_stalled_email_run() AS n")).n).toBe(1);
    expect(await count("SELECT count(*) n FROM public.email_job_runs WHERE finished_at IS NULL")).toBe(1);
  });
});

describe("the removal", () => {
  it("passes the preflight, removes the job and the function, logs once, and leaves other jobs", async () => {
    await db.exec(file("00_preflight.sql"));
    await db.exec(file("apply.sql"));
    expect(await jobs(JOB)).toBe(0);
    expect(await hasFn()).toBe(false);
    expect(await jobs("deliver-owner-alerts")).toBe(1);
    expect(await count("SELECT count(*) n FROM public.audit_log WHERE action = 'temporary_job_removed'")).toBe(1);
  });

  it("the preflight stops a second run", async () => {
    await db.exec(file("apply.sql"));
    expect(await fails(db.exec(file("00_preflight.sql")))).toContain("is not there");
  });

  it("the preflight stops when the job is already gone", async () => {
    await db.exec(`SELECT cron.unschedule('${JOB}')`);
    expect(await fails(db.exec(file("00_preflight.sql")))).toContain("expected one job");
  });

  it("the undo puts the function and the job back", async () => {
    const live = (await one("SELECT pg_get_functiondef('private.temp_close_stalled_email_run()'::regprocedure) d")).d;
    await db.exec(file("apply.sql"));
    await db.exec(file("apply.undo.sql"));
    expect((await one("SELECT pg_get_functiondef('private.temp_close_stalled_email_run()'::regprocedure) d")).d).toBe(live);
    expect(await jobs(JOB)).toBe(1);
    await db.exec(file("00_preflight.sql"));
  });
});
