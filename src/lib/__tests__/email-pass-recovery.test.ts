// @ts-nocheck: isolated SQL fixture and a fake client; shapes are checked by assertions.
import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { runEmailJob } from "../email-job.server";

/**
 * Email pass recovery (Nov 16): docs/pending/email-pass-recovery/apply.sql on an isolated copy with the
 * live run audit functions, plus the runner's one-pass-at-a-time rule against that copy.
 */
const SQL = readFileSync("docs/pending/email-pass-recovery/apply.sql", "utf8");
const UNDO = readFileSync("docs/pending/email-pass-recovery/apply.undo.sql", "utf8");
const REASON = "Closed automatically: run did not finish within 10 minutes";
let db: PGlite;
const one = async (q: string, a: unknown[] = []) => (await db.query(q, a)).rows[0];
const n = async (q: string, a: unknown[] = []) => Number((await one(q, a)).n);
const begin = async () => (await one("SELECT public.begin_email_job_run() AS id")).id as string;
const fails = async (p: Promise<unknown>) => {
  try { await p; } catch (e) { return String((e as Error).message); }
  throw new Error("expected a refusal");
};

beforeEach(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA private;
    CREATE TABLE public.email_job_runs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), started_at timestamptz NOT NULL DEFAULT now(),
      finished_at timestamptz, parts jsonb NOT NULL DEFAULT '{}', email_counts jsonb NOT NULL DEFAULT '{}', errors jsonb NOT NULL DEFAULT '[]');
    CREATE TABLE public.email_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email_job_run_id uuid, email_job_part text, status text, recipient text);
    CREATE TABLE public.audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid, actor_label text, action text NOT NULL,
      entity_type text NOT NULL, entity_id uuid, entity_label text, reason text, before_value jsonb, after_value jsonb, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE public.user_roles(user_id uuid, role text);
    CREATE TABLE public.staff_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, kind text NOT NULL, title text NOT NULL,
      body text NOT NULL DEFAULT '', entity_type text, entity_id uuid, link_path text, priority text NOT NULL DEFAULT 'normal',
      email_status text NOT NULL DEFAULT 'none', retracted_at timestamptz, retracted_reason text);
    CREATE TABLE public.outbox(id int PRIMARY KEY, status text NOT NULL DEFAULT 'pending');
    INSERT INTO public.user_roles VALUES ('00000000-0000-0000-0000-00000000000a','admin'), ('00000000-0000-0000-0000-00000000000b','admin'),
      ('00000000-0000-0000-0000-00000000000c','user');
  `);
  // Live record/finish functions (0155), unchanged by this migration.
  await db.exec(`
    CREATE FUNCTION public.record_email_job_part(_run_id uuid,_part text,_result jsonb,_errors jsonb) RETURNS void LANGUAGE plpgsql AS $$
    BEGIN
     UPDATE public.email_job_runs SET parts=parts || jsonb_build_object(_part,_result),errors=_errors WHERE id=_run_id AND finished_at IS NULL;
     IF NOT FOUND THEN RAISE EXCEPTION 'Run is missing or already finished'; END IF;
    END $$;
    CREATE FUNCTION public.finish_email_job_run(_run_id uuid,_errors jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
    BEGIN
     UPDATE public.email_job_runs SET finished_at=now(),errors=_errors WHERE id=_run_id AND finished_at IS NULL;
     IF NOT FOUND THEN RAISE EXCEPTION 'Run is missing or already finished'; END IF;
     RETURN '{}'::jsonb;
    END $$;
  `);
  await db.exec(SQL);
});

describe("automatic close of a stuck run", () => {
  it("closes an open run older than 10 minutes as failed, audits it, and the new pass starts", async () => {
    const old = (await one(`INSERT INTO public.email_job_runs(started_at) VALUES (now() - interval '11 minutes') RETURNING id`)).id;
    const fresh = await begin();
    expect(fresh).not.toBe(old);
    const r = await one("SELECT finished_at, closed_reason, errors FROM public.email_job_runs WHERE id=$1", [old]);
    expect(r.finished_at).not.toBeNull();
    expect(r.closed_reason).toBe(REASON);
    expect(r.errors).toContain(REASON);
    expect(await n(`SELECT count(*) n FROM public.audit_log WHERE action='email_job_run_closed' AND entity_id=$1 AND reason=$2`, [old, REASON])).toBe(1);
    expect(await n("SELECT count(*) n FROM public.email_job_runs WHERE finished_at IS NULL")).toBe(1);
  });

  it("never closes a run younger than 10 minutes; the new pass is refused and nothing is audited", async () => {
    const young = (await one(`INSERT INTO public.email_job_runs(started_at) VALUES (now() - interval '9 minutes 50 seconds') RETURNING id`)).id;
    expect(await fails(begin())).toContain("An unfinished email run exists");
    expect((await one("SELECT finished_at FROM public.email_job_runs WHERE id=$1", [young])).finished_at).toBeNull();
    expect(await n("SELECT count(*) n FROM public.audit_log")).toBe(0);
  });

  it("a pass whose run was closed under it cannot record more work", async () => {
    const old = (await one(`INSERT INTO public.email_job_runs(started_at) VALUES (now() - interval '12 minutes') RETURNING id`)).id;
    await begin();
    expect(await fails(db.query("SELECT public.record_email_job_part($1,'owner','{}','[]')", [old]))).toContain("already finished");
  });

  it("keeps runs closed by staff out of the success history (backfill)", async () => {
    const d = new PGlite();
    await d.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA private;
      CREATE TABLE public.email_job_runs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz, errors jsonb NOT NULL DEFAULT '[]');
      INSERT INTO public.email_job_runs(finished_at, errors) VALUES (now(), '["Closed by Admin Nov 16: run died"]'), (now(), '[]');`);
    await d.exec(SQL.split("CREATE TABLE IF NOT EXISTS")[0]);
    const rows = (await d.query("SELECT closed_reason FROM public.email_job_runs ORDER BY closed_reason NULLS LAST")).rows;
    expect(rows.map((r) => r.closed_reason)).toEqual(["Closed by Admin Nov 16: run died", null]);
  });
});

describe("outage notice", () => {
  const check = async () => (await one("SELECT private.email_pass_health_check() AS s")).s;
  const notices = () => n("SELECT count(*) n FROM public.staff_notifications WHERE kind='email_pass_outage' AND retracted_at IS NULL");

  it("tells each Admin once, in-app only, when no pass has finished for 30 minutes", async () => {
    await db.exec(`INSERT INTO public.email_job_runs(started_at, finished_at) VALUES ('2026-11-16 21:25:00+00','2026-11-16 21:25:06+00')`);
    expect(await check()).toBe("noticed");
    expect(await check()).toBe("already_noticed");
    expect(await check()).toBe("already_noticed");
    const rows = (await db.query("SELECT user_id, title, email_status FROM public.staff_notifications ORDER BY user_id")).rows;
    expect(rows.length).toBe(2);
    expect(rows[0].title).toBe("Emails have not gone out since Nov 16, 3:25 PM Central");
    expect(rows.every((r) => r.email_status === "none")).toBe(true);
  });

  it("does not count automatically closed runs as success, and clears when a pass finishes", async () => {
    await db.exec(`INSERT INTO public.email_job_runs(started_at, finished_at) VALUES (now() - interval '50 minutes', now() - interval '50 minutes')`);
    await db.exec(`INSERT INTO public.email_job_runs(started_at) VALUES (now() - interval '20 minutes')`);
    const id = await begin(); // closes the stuck run, then notices the outage
    expect(await notices()).toBe(2);
    await db.query("SELECT public.finish_email_job_run($1,'[]')", [id]);
    expect(await check()).toBe("cleared");
    expect(await notices()).toBe(0);
    expect(await n("SELECT count(*) n FROM public.email_pass_outages WHERE cleared_at IS NULL")).toBe(0);
    // A later outage is a new one and notifies again.
    await db.exec(`UPDATE public.email_job_runs SET started_at = started_at - interval '2 hours', finished_at = finished_at - interval '2 hours'`);
    expect(await check()).toBe("noticed");
    expect(await notices()).toBe(2);
  });

  it("stays quiet while passes are finishing", async () => {
    await db.exec(`INSERT INTO public.email_job_runs(started_at, finished_at) VALUES (now() - interval '5 minutes', now() - interval '5 minutes')`);
    expect(await check()).toBe("ok");
    expect(await notices()).toBe(0);
  });

  it("a failed health check never stops a pass from starting", async () => {
    await db.exec(`DROP TABLE public.staff_notifications;
      INSERT INTO public.email_job_runs(started_at, finished_at) VALUES (now() - interval '2 hours', now() - interval '2 hours')`);
    expect(typeof (await begin())).toBe("string");
  });

  it("undo restores the plain start step", async () => {
    await db.exec(UNDO);
    await db.exec(`INSERT INTO public.email_job_runs(started_at) VALUES (now() - interval '30 minutes')`);
    expect(await fails(begin())).toContain("An unfinished email run exists");
    expect((await one("SELECT to_regprocedure('private.email_pass_health_check()') IS NOT NULL AS x")).x).toBe(false);
  });
});

describe("one pass at a time: no duplicate emails", () => {
  // Fake client over the isolated copy: rpc maps to the SQL functions.
  const client = {
    rpc: async (name: string, args: Record<string, unknown> = {}) => {
      try {
        if (name === "begin_email_job_run") return { data: (await one("SELECT public.begin_email_job_run() AS x")).x, error: null };
        if (name === "record_email_job_part") {
          await db.query("SELECT public.record_email_job_part($1,$2,$3,$4)", [args._run_id, args._part, JSON.stringify(args._result ?? null), JSON.stringify(args._errors)]);
          return { data: null, error: null };
        }
        if (name === "finish_email_job_run") return { data: (await one("SELECT public.finish_email_job_run($1,$2) AS x", [args._run_id, JSON.stringify(args._errors)])).x, error: null };
      } catch (e) { return { data: null, error: { message: String(e) } }; }
      throw new Error(name);
    },
  };
  // An email part like the real drains: claim each pending row, then send it.
  const sendPart = (label: string) => ({
    name: "owner",
    run: async (runId: string) => {
      let sent = 0;
      for (const { id } of (await db.query("SELECT id FROM public.outbox WHERE status='pending' ORDER BY id")).rows) {
        const claimed = await db.query("UPDATE public.outbox SET status='sending' WHERE id=$1 AND status='pending' RETURNING id", [id]);
        if (!claimed.rows.length) continue;
        await db.query("INSERT INTO public.email_log(email_job_run_id, email_job_part, status, recipient) VALUES ($1,'owner','sent',$2)", [runId, `${label}:${id}`]);
        await db.query("UPDATE public.outbox SET status='sent' WHERE id=$1", [id]);
        sent++;
      }
      return { sent };
    },
  });

  it("a second pass is refused while the first is running, and every email goes out once", async () => {
    await db.exec("INSERT INTO public.outbox(id) SELECT generate_series(1, 5)");
    let second: unknown;
    const first = await runEmailJob(client, [
      { name: "progress", run: async () => { second = await runEmailJob(client, [sendPart("B")]).catch((e) => String(e.message)); return {}; } },
      sendPart("A"),
    ]);
    expect(second).toContain("no work started");
    expect(first.ok).toBe(true);
    expect(await n("SELECT count(*) n FROM public.email_log")).toBe(5);
    expect(await n("SELECT count(DISTINCT split_part(recipient, ':', 2)) n FROM public.email_log")).toBe(5);
  });

  it("after a stuck run is closed, the old pass stops and the new pass sends each email once", async () => {
    await db.exec("INSERT INTO public.outbox(id) SELECT generate_series(1, 4)");
    // The old pass started 11 minutes ago and is still alive inside its first part.
    let clock = 0;
    const old = runEmailJob(client, [
      { name: "progress", run: async () => {
        await db.exec("UPDATE public.email_job_runs SET started_at = now() - interval '11 minutes' WHERE finished_at IS NULL");
        const next = await runEmailJob(client, [sendPart("NEW")]);
        expect(next.ok).toBe(true);
        return {};
      } },
      sendPart("OLD"),
    ], { now: () => clock });
    expect(await fails(old)).toContain("Run audit failed");
    expect(await n("SELECT count(*) n FROM public.email_log WHERE recipient LIKE 'OLD:%'")).toBe(0);
    expect(await n("SELECT count(*) n FROM public.email_log WHERE recipient LIKE 'NEW:%'")).toBe(4);
    expect(await n(`SELECT count(*) n FROM public.audit_log WHERE action='email_job_run_closed'`)).toBe(1);
  });

  it("starts no new part after the time limit and records the rest as deferred", async () => {
    await db.exec("INSERT INTO public.outbox(id) VALUES (1)");
    let clock = 0;
    const res = await runEmailJob(client, [
      { name: "progress", run: async () => { clock = 7 * 60_000 + 1; return {}; } },
      sendPart("A"),
    ], { now: () => clock });
    expect(res.results.deferred).toEqual(["owner"]);
    expect(await n("SELECT count(*) n FROM public.email_log")).toBe(0);
    expect((await one("SELECT parts->'deferred' AS d, finished_at FROM public.email_job_runs")).d).toEqual(["owner"]);
  });
});
