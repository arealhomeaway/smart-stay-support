import { describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Isolated PostgreSQL check of the staged nightly export change (docs/pending/nightly-export/).
 * backup_runs comes verbatim from its applied migration; the rest of the app is stubbed.
 * Nothing touches the real database, scheduler or anyone's mailbox.
 */
const DIR = "docs/pending/nightly-export";
const read = (p: string) => readFileSync(p, "utf8");
const STAGED = read(`${DIR}/01_nightly_export.sql`);
const UNDO = read(`${DIR}/01_undo_nightly_export.sql`);
const BACKUP_RUNS = read("drizzle/migrations/0249_backup_runs.sql");

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ADMIN = U(1), ADMIN2 = U(2), DIR_OPS = U(3), SUP = U(4), DIR_ONB = U(5), PC = U(6), FIN = U(7);

const SCHEMA = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private; CREATE SCHEMA storage; CREATE SCHEMA cron;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
CREATE TABLE public.user_roles(user_id uuid, role text);
CREATE FUNCTION public.has_role(_user_id uuid, _role text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
CREATE TABLE public.functional_roles(code text PRIMARY KEY, active boolean DEFAULT true, current_seat_holder uuid);
CREATE TABLE public.functional_role_members(role_code text, user_id uuid);
CREATE FUNCTION public.holds_functional_role(_user_id uuid, _code text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.functional_roles WHERE code = _code AND active AND current_seat_holder = _user_id)
      OR EXISTS (SELECT 1 FROM public.functional_role_members WHERE role_code = _code AND user_id = _user_id) $$;
CREATE FUNCTION public.is_director(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT public.has_role(_user_id, 'admin') OR public.holds_functional_role(_user_id, 'director_ops') $$;
CREATE FUNCTION public.is_onboarding_director(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT public.holds_functional_role(_user_id, 'onboarding_director') $$;
CREATE TABLE public.staff_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, kind text, title text, body text,
  link_path text, priority text, email_status text DEFAULT 'none', is_demo boolean DEFAULT false, created_at timestamptz DEFAULT now());
CREATE TABLE public.documents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_type text, entity_id uuid, storage_path text);
CREATE TABLE public.owner_library_videos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), storage_bucket text, storage_path text);
CREATE TABLE public.vendor_documents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), storage_path text);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text, metadata jsonb,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE cron.job(jobid serial PRIMARY KEY, jobname text, schedule text, command text, active boolean DEFAULT true);
CREATE FUNCTION cron.schedule(_name text, _schedule text, _command text) RETURNS bigint LANGUAGE sql AS $$
  INSERT INTO cron.job(jobname, schedule, command) VALUES (_name, _schedule, _command) RETURNING jobid $$;
CREATE FUNCTION cron.unschedule(_id bigint) RETURNS boolean LANGUAGE sql AS $$ DELETE FROM cron.job WHERE jobid = _id RETURNING true $$;
INSERT INTO cron.job(jobname, schedule, command) VALUES ('nightly-backup-0700utc', '0 7 * * *', 'old'), ('nightly-backup-0800utc', '0 8 * * *', 'old');
GRANT USAGE ON SCHEMA public, auth TO authenticated, service_role;
INSERT INTO public.user_roles VALUES ('${ADMIN}', 'admin'), ('${ADMIN2}', 'admin'), ('${DIR_OPS}', 'manager'), ('${SUP}', 'manager'),
  ('${DIR_ONB}', 'onboarding'), ('${PC}', 'tech'), ('${FIN}', 'manager');
INSERT INTO public.functional_roles(code, current_seat_holder) VALUES ('director_ops', '${DIR_OPS}'), ('ops_supervisor', '${SUP}'),
  ('onboarding_director', '${DIR_ONB}'), ('finance_lead', '${FIN}');
`;

async function db() {
  const pg = new PGlite();
  await pg.exec(SCHEMA);
  await pg.exec(BACKUP_RUNS);
  await pg.exec(STAGED);
  return pg;
}
const one = async (pg: PGlite, sql: string) => ((await pg.query(sql)).rows[0] ?? {}) as Record<string, any>;

describe("staged nightly export database step", () => {
  it("adds the two jobs and leaves the two existing nightly backup jobs exactly as they were", async () => {
    const pg = await db();
    const jobs = (await pg.query<{ jobname: string; schedule: string; command: string }>("SELECT jobname, schedule, command FROM cron.job ORDER BY jobname")).rows;
    expect(jobs.map((j) => [j.jobname, j.schedule])).toEqual([
      ["nightly-backup-0700utc", "0 7 * * *"],
      ["nightly-backup-0800utc", "0 8 * * *"],
      ["nightly-export-continue", "5-55/10 7-10 * * *"],
      ["nightly-export-missed-check", "15 10,11 * * *"],
    ]);
    expect(jobs.filter((j) => j.command === "old")).toHaveLength(2);
    expect(jobs.find((j) => j.jobname === "nightly-export-continue")!.command).toContain("backup_cron_token");
  });

  it("alerts every Admin and the Director of Operations once per night, in app and for email", async () => {
    const pg = await db();
    const n = await one(pg, "SELECT public.nightly_export_alert('2026-11-11', 'failed', 'The nightly export for 2026-11-11 failed.') AS n");
    expect(n["n"]).toBe(3);
    const who = (await pg.query<{ user_id: string }>("SELECT user_id FROM public.staff_notifications ORDER BY user_id")).rows.map((r) => r.user_id);
    expect(who).toEqual([ADMIN, ADMIN2, DIR_OPS]);
    const row = await one(pg, "SELECT kind, title, link_path, priority, email_status FROM public.staff_notifications LIMIT 1");
    expect(row).toEqual({ kind: "nightly_export_failed", title: "Nightly export failed", link_path: "/export-check", priority: "high", email_status: "pending" });
    const again = await one(pg, "SELECT public.nightly_export_alert('2026-11-11', 'missed', 'again') AS n");
    expect(again["n"]).toBe(0);
    expect((await one(pg, "SELECT count(*)::int AS c FROM public.staff_notifications"))["c"]).toBe(3);
  });

  it("the 5 AM check alerts when no export passed, and only in the 5 AM Central hour", async () => {
    const pg = await db();
    expect((await one(pg, "SELECT private.nightly_export_missed_check('2026-11-11T10:15:00Z') AS n"))["n"]).toBe(0); // 4:15 AM CST
    expect((await one(pg, "SELECT private.nightly_export_missed_check('2026-11-11T11:15:00Z') AS n"))["n"]).toBe(3); // 5:15 AM CST
    const a = await one(pg, "SELECT reason, message FROM public.backup_export_alerts WHERE folder_name = '2026-11-11'");
    expect(a["reason"]).toBe("missed");
    expect(a["message"]).toContain("No nightly export ran for 2026-11-11 by 5 AM Central");
    expect((await one(pg, "SELECT title FROM public.staff_notifications LIMIT 1"))["title"]).toBe("Nightly export did not finish");
  });

  it("a passed export, or the earlier nightly backup until the export is published, counts as a run", async () => {
    const pg = await db();
    await pg.exec(`INSERT INTO public.backup_runs(folder_name, status, phase, verify_status) VALUES ('2026-11-12', 'succeeded', 'done', 'passed');
                   INSERT INTO public.backup_runs(folder_name, status) VALUES ('2026-11-13', 'succeeded');`);
    expect((await one(pg, "SELECT private.nightly_export_missed_check('2026-11-12T11:15:00Z') AS n"))["n"]).toBe(0);
    expect((await one(pg, "SELECT private.nightly_export_missed_check('2026-11-13T11:15:00Z') AS n"))["n"]).toBe(0);
    await pg.exec(`INSERT INTO public.backup_runs(folder_name, status, phase) VALUES ('2026-11-14', 'running', 'files');`);
    expect((await one(pg, "SELECT private.nightly_export_missed_check('2026-11-14T11:15:00Z') AS n"))["n"]).toBe(3);
    expect((await one(pg, "SELECT message FROM public.backup_export_alerts WHERE folder_name = '2026-11-14'"))["message"]).toContain("had not finished");
  });

  it("opens the run history to Admin, the Operations Supervisor and the Directors only", async () => {
    const pg = await db();
    const can = async (u: string) => (await one(pg, `SELECT public.can_view_export_check('${u}') AS ok`))["ok"];
    expect(await can(ADMIN)).toBe(true);
    expect(await can(SUP)).toBe(true);
    expect(await can(DIR_OPS)).toBe(true);
    expect(await can(DIR_ONB)).toBe(true);
    expect(await can(PC)).toBe(false);
    expect(await can(FIN)).toBe(false);
    await pg.exec(`INSERT INTO public.backup_runs(folder_name, status) VALUES ('2026-11-10', 'succeeded');
                   GRANT USAGE ON SCHEMA private TO authenticated;`);
    const seen = async (u: string) => {
      await pg.exec(`SET ROLE authenticated; SELECT set_config('test.uid', '${u}', false);`);
      const c = (await one(pg, "SELECT count(*)::int AS c FROM public.backup_runs"))["c"];
      await pg.exec("RESET ROLE;");
      return c;
    };
    expect(await seen(SUP)).toBe(1);
    expect(await seen(PC)).toBe(0);
    expect(await seen(FIN)).toBe(0);
  });

  it("only the server may list stored files or send the alert", async () => {
    const pg = await db();
    for (const fn of ["public.backup_list_files()", "public.nightly_export_alert(text, text, text)"]) {
      const r = await one(pg, `SELECT has_function_privilege('authenticated', '${fn}', 'EXECUTE') AS a, has_function_privilege('service_role', '${fn}', 'EXECUTE') AS s`);
      expect(r).toEqual({ a: false, s: true });
    }
  });

  it("lists every stored file with its size, fingerprint and the record it belongs to", async () => {
    const pg = await db();
    await pg.exec(`
      INSERT INTO public.documents(id, entity_type, entity_id, storage_path) VALUES ('${U(50)}', 'ticket', '${U(60)}', 'ticket/1/a.jpg');
      INSERT INTO storage.objects(bucket_id, name, metadata) VALUES
        ('resolve-attachments', 'ticket/1/a.jpg', '{"size": 12, "eTag": "\\"abc\\"", "mimetype": "image/jpeg"}'),
        ('help-feedback', '${PC}/shot.png', '{"size": 7, "eTag": "e2"}'),
        ('resolve-attachments', 'property/x/plan.pdf', '{"size": 3}');`);
    const rows = (await pg.query<Record<string, any>>("SELECT bucket, name, size::int AS size, etag, owner_type, owner_id, owner_label FROM public.backup_list_files()")).rows;
    expect(rows).toEqual([
      { bucket: "help-feedback", name: `${PC}/shot.png`, size: 7, etag: "e2", owner_type: "profiles", owner_id: PC, owner_label: "Help report file" },
      { bucket: "resolve-attachments", name: "property/x/plan.pdf", size: 3, etag: null, owner_type: "folder", owner_id: null, owner_label: "property" },
      { bucket: "resolve-attachments", name: "ticket/1/a.jpg", size: 12, etag: '"abc"', owner_type: "documents", owner_id: U(50), owner_label: `ticket ${U(60)}` },
    ]);
  });

  it("allows one export record per night and leaves earlier backup records free", async () => {
    const pg = await db();
    await pg.exec(`INSERT INTO public.backup_runs(folder_name, status) VALUES ('2026-11-11', 'succeeded'), ('2026-11-11', 'failed');
                   INSERT INTO public.backup_runs(folder_name, status, phase) VALUES ('2026-11-11', 'running', 'start');`);
    let failed = false;
    try {
      await pg.exec(`INSERT INTO public.backup_runs(folder_name, status, phase) VALUES ('2026-11-11', 'running', 'start');`);
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });

  it("the undo removes everything it added and keeps the existing jobs and records", async () => {
    const pg = await db();
    await pg.exec(`INSERT INTO public.backup_runs(folder_name, status) VALUES ('2026-11-09', 'succeeded');`);
    await pg.exec(UNDO);
    const jobs = (await pg.query<{ jobname: string }>("SELECT jobname FROM cron.job ORDER BY jobname")).rows.map((j) => j.jobname);
    expect(jobs).toEqual(["nightly-backup-0700utc", "nightly-backup-0800utc"]);
    const cols = (await pg.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name = 'backup_runs' ORDER BY ordinal_position")).rows.map((c) => c.column_name);
    expect(cols).toEqual(["id", "folder_name", "status", "trigger", "started_at", "finished_at", "folder_item_id", "files", "pruned_count", "pruned_at", "error"]);
    expect((await one(pg, "SELECT count(*)::int AS c FROM public.backup_runs"))["c"]).toBe(1);
    expect((await one(pg, "SELECT to_regclass('public.backup_file_copies') AS t"))["t"]).toBeNull();
    expect((await one(pg, "SELECT to_regprocedure('public.nightly_export_alert(text,text,text)') AS f"))["f"]).toBeNull();
  });
});

/**
 * nightly-export-sunday (Admin, Nov 15): calls every 5 minutes, and the weekly full copy night works
 * and is checked until 7 AM Central. Practice run of docs/pending/nightly-export-sunday on the same copy.
 */
const SUNDAY = "docs/pending/nightly-export-sunday";
async function sundayDb() {
  const pg = await db();
  await pg.exec(`
    CREATE TABLE public.app_settings(key text PRIMARY KEY, value jsonb);
    INSERT INTO public.app_settings VALUES ('nightly_export_settings', '{"daily_keep": 30, "weekly_day": 0, "weekly_keep": 12}');
    CREATE TABLE IF NOT EXISTS public.audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid, actor_label text, action text,
      entity_type text, entity_id uuid, entity_label text, reason text, before_value jsonb, after_value jsonb, created_at timestamptz DEFAULT now());
    CREATE FUNCTION cron.alter_job(job_id bigint, schedule text) RETURNS void LANGUAGE sql AS $$ UPDATE cron.job SET schedule = $2 WHERE jobid = $1 $$;
  `);
  await pg.exec(read("drizzle/migrations/0340_build9_export_fewer_alert.sql"));
  await pg.exec(read(`${SUNDAY}/apply.sql`));
  return pg;
}

describe("nightly export: Sunday full copy hours (applied Nov 15)", () => {
  it("calls every 5 minutes and checks at 7 AM on the weekly night; the call itself is unchanged", async () => {
    const pg = await sundayDb();
    const jobs = (await pg.query<{ jobname: string; schedule: string; command: string }>("SELECT jobname, schedule, command FROM cron.job ORDER BY jobname")).rows;
    expect(jobs.map((j) => [j.jobname, j.schedule])).toEqual([
      ["nightly-backup-0700utc", "0 7 * * *"],
      ["nightly-backup-0800utc", "0 8 * * *"],
      ["nightly-export-continue", "5-55/5 7-12 * * *"],
      ["nightly-export-missed-check", "15 10-13 * * *"],
    ]);
    expect(jobs.find((j) => j.jobname === "nightly-export-continue")!.command).toContain("backup_cron_token");
    expect((await one(pg, "SELECT action FROM public.audit_log"))["action"]).toBe("nightly_export_sunday_applied");
  });

  it("Sunday: no alert at 5 AM, the alert at 7 AM says 7 AM", async () => {
    const pg = await sundayDb();
    await pg.exec(`INSERT INTO public.backup_runs(folder_name, status, phase, weekly) VALUES ('2026-11-22', 'running', 'files', true);`);
    expect((await one(pg, "SELECT private.nightly_export_missed_check('2026-11-22T11:15:00Z') AS n"))["n"]).toBe(0); // 5:15 AM CST
    expect((await one(pg, "SELECT private.nightly_export_missed_check('2026-11-22T12:15:00Z') AS n"))["n"]).toBe(0); // 6:15 AM CST
    expect((await one(pg, "SELECT private.nightly_export_missed_check('2026-11-22T13:15:00Z') AS n"))["n"]).toBe(3); // 7:15 AM CST
    expect((await one(pg, "SELECT message FROM public.backup_export_alerts WHERE folder_name = '2026-11-22'"))["message"]).toContain("had not finished by 7 AM Central");
  });

  it("other nights keep the 5 AM check, worded as before", async () => {
    const pg = await sundayDb();
    expect((await one(pg, "SELECT private.nightly_export_missed_check('2026-11-16T10:15:00Z') AS n"))["n"]).toBe(0); // Mon 4:15 AM CST
    expect((await one(pg, "SELECT private.nightly_export_missed_check('2026-11-16T11:15:00Z') AS n"))["n"]).toBe(3); // Mon 5:15 AM CST
    expect((await one(pg, "SELECT message FROM public.backup_export_alerts WHERE folder_name = '2026-11-16'"))["message"]).toContain("No nightly export ran for 2026-11-16 by 5 AM Central");
    expect((await one(pg, "SELECT private.nightly_export_missed_check('2026-11-16T13:15:00Z') AS n"))["n"]).toBe(0); // Mon 7:15 AM CST
  });

  it("the undo puts back every 10 minutes and the 5 AM check every night", async () => {
    const pg = await sundayDb();
    await pg.exec(read(`${SUNDAY}/apply.undo.sql`));
    const jobs = (await pg.query<{ jobname: string; schedule: string }>("SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'nightly-export%' ORDER BY jobname")).rows;
    expect(jobs.map((j) => j.schedule)).toEqual(["5-55/10 7-10 * * *", "15 10,11 * * *"]);
    await pg.exec(`INSERT INTO public.backup_runs(folder_name, status, phase, weekly) VALUES ('2026-11-22', 'running', 'files', true);`);
    expect((await one(pg, "SELECT private.nightly_export_missed_check('2026-11-22T11:15:00Z') AS n"))["n"]).toBe(3);
    const src = (await one(pg, "SELECT md5(prosrc) AS h FROM pg_proc WHERE proname = 'nightly_export_missed_check'"))["h"];
    expect(src).toBe("3e27b9167c3e103634ce645ef56f80a3");
  });
});
