// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Isolated PostgreSQL check of docs/pending/scorecard-capture/*.sql.
 * Tables and role helpers are stubbed. Nothing touches the real database.
 */
const DIR = "docs/pending/scorecard-capture";
const SUP = "00000000-0000-4000-8000-0000000000a1"; // holds ops_supervisor (manager)
const DIR_OPS = "00000000-0000-4000-8000-0000000000a2"; // holds director_ops (manager)
const COO = "00000000-0000-4000-8000-0000000000a3"; // holds coo
const TECH = "00000000-0000-4000-8000-0000000000a4"; // coordinator
const ADMIN = "00000000-0000-4000-8000-0000000000a5";
const ONB = "00000000-0000-4000-8000-0000000000a6"; // onboarding staff
const OWNER = "00000000-0000-4000-8000-0000000000a7";
const HOME = "00000000-0000-4000-8000-0000000000b1";
let db: PGlite;

const STUBS = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private;
GRANT USAGE ON SCHEMA public, auth, private TO authenticated, anon, service_role;
CREATE TYPE public.app_role AS ENUM ('admin','manager','tech','vendor','owner','onboarding');
CREATE TABLE public.me(id uuid);
GRANT SELECT ON public.me TO authenticated, anon;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.me LIMIT 1 $$;
CREATE TABLE public.user_roles(user_id uuid, role public.app_role);
INSERT INTO public.user_roles VALUES
  ('${SUP}','manager'), ('${DIR_OPS}','manager'), ('${COO}','manager'), ('${TECH}','tech'),
  ('${ADMIN}','admin'), ('${ONB}','onboarding'), ('${OWNER}','owner');
CREATE TABLE public.functional_roles(id uuid DEFAULT gen_random_uuid(), code text UNIQUE, name text, team text,
  sort_order int DEFAULT 0, active boolean DEFAULT true, current_seat_holder uuid);
INSERT INTO public.functional_roles(code, name, team, sort_order, current_seat_holder) VALUES
  ('ops_supervisor','Operations Supervisor','leadership',5,'${SUP}'),
  ('director_ops','Director of Operations','leadership',6,'${DIR_OPS}'),
  ('ceo','CEO','leadership',8,NULL);
CREATE TABLE public.functional_role_members(role_code text, user_id uuid);
CREATE FUNCTION public.has_role(_u uuid, _r public.app_role) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_u AND role=_r) $$;
CREATE FUNCTION private.has_role(_u uuid, _r public.app_role) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT public.has_role(_u,_r) $$;
CREATE FUNCTION public.holds_functional_role(_u uuid, _c text) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS (SELECT 1 FROM public.functional_roles WHERE code=_c AND active AND current_seat_holder=_u)
         OR EXISTS (SELECT 1 FROM public.functional_role_members WHERE role_code=_c AND user_id=_u) $$;
CREATE FUNCTION public.seat_holder_at(_c text, _at timestamptz DEFAULT now()) RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT current_seat_holder FROM public.functional_roles WHERE code=_c $$;
CREATE FUNCTION private.is_director(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT public.has_role(_u,'admin') OR public.seat_holder_at('director_ops') = _u $$;
CREATE FUNCTION private.is_supervisor(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_u AND role::text IN ('admin','manager')) $$;
CREATE FUNCTION private.is_staff(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_u AND role::text IN ('admin','manager','tech','onboarding')) $$;
CREATE FUNCTION public.is_internal_staff(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT private.is_staff(_u) $$;
CREATE TABLE public.properties(id uuid PRIMARY KEY, check_in_time text, time_zone text, is_demo boolean DEFAULT false);
INSERT INTO public.properties VALUES ('${HOME}', '16:00', NULL, false);
CREATE TABLE public.work_types(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), category text);
CREATE TABLE public.tickets(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text DEFAULT 'Ticket', category text DEFAULT 'guest',
  work_type_id uuid, linked_feedback_id uuid, external_source text, is_demo boolean DEFAULT false,
  archived_at timestamptz, archived_by uuid, archive_reason text, reported_at timestamptz DEFAULT now(),
  next_action text, next_action_due_at timestamptz, status text DEFAULT 'open', waiting_on text,
  waiting_reason text, next_review_at timestamptz, resolved_at timestamptz);
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY tickets_all ON public.tickets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY tickets_delete_admin ON public.tickets FOR DELETE
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'manager'::app_role));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
CREATE TABLE public.ticket_activity(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id uuid, author_id uuid,
  kind text DEFAULT 'note', event_type text DEFAULT 'update', body text, internal boolean DEFAULT true,
  is_demo boolean DEFAULT false, created_at timestamptz DEFAULT now(), event_at timestamptz DEFAULT now(),
  external_id text, external_author_name text,
  -- Test only (Build 9 A8): insert order, so two lines saved in the same instant read back in order.
  seq bigint GENERATED ALWAYS AS IDENTITY);
GRANT SELECT, INSERT ON public.ticket_activity TO authenticated;
CREATE TABLE public.routine_controls(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text DEFAULT 'guest_review',
  status text DEFAULT 'due', notes text, completed_at timestamptz, completed_by uuid, follow_up_ticket_id uuid,
  is_demo boolean DEFAULT false, updated_at timestamptz DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routine_controls TO authenticated;
CREATE TABLE public.app_settings(key text PRIMARY KEY, value jsonb NOT NULL DEFAULT '{}', updated_by uuid, updated_at timestamptz DEFAULT now());
CREATE TABLE public.audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid, action text, entity_type text,
  entity_id uuid, entity_label text, reason text, before_value jsonb, after_value jsonb, created_at timestamptz DEFAULT now());
`;

const FILES = ["01_scorecard_records.sql", "02_ticket_times_and_states.sql", "03_routine_check_lock.sql", "04_ticket_archive.sql"];
const asUser = (id: string) => db.exec(`DELETE FROM public.me; INSERT INTO public.me VALUES ('${id}');`);
const one = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows[0];
const newTicket = async (cols = "", vals = "") =>
  (await one(`INSERT INTO public.tickets(title${cols ? "," + cols : ""}) VALUES ('T'${vals ? "," + vals : ""}) RETURNING id`)).id;
const tomorrow = "((now() AT TIME ZONE 'America/Chicago')::date + 1)";

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  for (const f of FILES) await db.exec(readFileSync(`${DIR}/${f}`, "utf8"));
});

describe("scorecard records are permanent", () => {
  it("refuses update and delete for everyone, by trigger and by missing grants", async () => {
    await asUser(TECH);
    const r = await one(`SELECT public.record_arrival_readiness('${HOME}', ${tomorrow}) r`);
    const id = r.r.record_id;
    await expect(db.query(`UPDATE public.scorecard_records SET note='x' WHERE id=$1`, [id])).rejects.toThrow(/permanent/);
    await expect(db.query(`DELETE FROM public.scorecard_records WHERE id=$1`, [id])).rejects.toThrow(/permanent/);
    await expect(db.query(`TRUNCATE public.scorecard_records`)).rejects.toThrow(/permanent/);
    await db.exec(`SET ROLE authenticated`);
    try {
      await expect(db.query(`UPDATE public.scorecard_records SET note='x' WHERE id=$1`, [id])).rejects.toThrow(/permission denied/);
      await expect(db.query(`DELETE FROM public.scorecard_records WHERE id=$1`, [id])).rejects.toThrow(/permission denied/);
      await expect(db.query(`INSERT INTO public.scorecard_records(kind, recorded_by) VALUES ('queue_sweep', '${TECH}')`)).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec(`RESET ROLE`);
    }
  });

  it("takes the time from the server, never from the caller", async () => {
    await asUser(SUP);
    const row = await one(`INSERT INTO public.scorecard_records(kind, recorded_by, recorded_at)
      VALUES ('finance_packet', '${SUP}', '2020-01-01T00:00:00Z') RETURNING recorded_at`);
    expect(Math.abs(new Date(row.recorded_at).getTime() - Date.now())).toBeLessThan(60_000);
  });

  it("keeps the stay's check-in time and never records the same arrival twice", async () => {
    await asUser(TECH);
    const first = (await one(`SELECT public.record_arrival_readiness('${HOME}', ${tomorrow} + 1, 'BK-1') r`)).r;
    const again = (await one(`SELECT public.record_arrival_readiness('${HOME}', ${tomorrow} + 1, 'BK-1') r`)).r;
    expect(again.already_recorded).toBe(true);
    expect(again.record_id).toBe(first.record_id);
    const row = await one(`SELECT details FROM public.scorecard_records WHERE id=$1`, [first.record_id]);
    expect(row.details.check_in_known).toBe(true);
    expect(new Date(row.details.check_in_at).getUTCHours()).toBe(new Date(row.details.check_in_at).getUTCHours());
    const hour = (await one(`SELECT extract(hour from ($1::timestamptz AT TIME ZONE 'America/Chicago'))::int h`, [row.details.check_in_at])).h;
    expect(hour).toBe(16);
  });
});

describe("each record function rejects the wrong role", () => {
  it("arrival readiness: Operations staff only", async () => {
    for (const who of [ONB, OWNER]) {
      await asUser(who);
      await expect(db.query(`SELECT public.record_arrival_readiness('${HOME}', ${tomorrow})`)).rejects.toThrow(/Only Operations staff/);
    }
  });

  it("queue sweep: logged only for the Operations Supervisor, at most once per 5 minutes per page", async () => {
    await asUser(TECH);
    expect((await one(`SELECT public.log_queue_open('team_queue') r`)).r.recorded).toBe(false);
    await asUser(DIR_OPS);
    expect((await one(`SELECT public.log_queue_open('team_queue') r`)).r.recorded).toBe(false);
    await asUser(SUP);
    expect((await one(`SELECT public.log_queue_open('team_queue') r`)).r.recorded).toBe(true);
    expect((await one(`SELECT public.log_queue_open('team_queue') r`)).r.recorded).toBe(false);
    expect((await one(`SELECT public.log_queue_open('supervisor_check') r`)).r.recorded).toBe(true);
    const n = (await one(`SELECT count(*)::int n FROM public.scorecard_records WHERE kind='queue_sweep'`)).n;
    expect(n).toBe(2);
  });

  it("coaching: the Operations Supervisor only, about a coordinator", async () => {
    for (const who of [TECH, DIR_OPS, COO]) {
      await asUser(who);
      await expect(db.query(`SELECT public.record_coaching_conversation('${TECH}', 'Calm guest call', 'Faster replies')`)).rejects.toThrow(/Only the Operations Supervisor/);
    }
    await asUser(SUP);
    await expect(db.query(`SELECT public.record_coaching_conversation('${ONB}', 'Calm guest call', 'Faster replies')`)).rejects.toThrow(/coordinator/);
    const r = (await one(`SELECT public.record_coaching_conversation('${TECH}', 'Calm guest call', 'Faster replies', 'Check in Friday') r`)).r;
    const row = await one(`SELECT about_user_id, details FROM public.scorecard_records WHERE id=$1`, [r.record_id]);
    expect(row.about_user_id).toBe(TECH);
    expect(row.details.strength).toBe("Calm guest call");
    expect(row.details.follow_up).toBe("Check in Friday");
  });

  it("corrective commitment: Supervisor or Director, guest issue tickets only; COO approval is a new line", async () => {
    const guest = await newTicket("category", "'guest'");
    const plumbing = await newTicket("category", "'plumbing'");
    await asUser(TECH);
    await expect(db.query(`SELECT public.record_corrective_commitment('${guest}', 'Deep clean before next stay', ${tomorrow})`)).rejects.toThrow(/Only the Operations Supervisor or Director/);
    await asUser(DIR_OPS);
    await expect(db.query(`SELECT public.record_corrective_commitment('${plumbing}', 'Deep clean before next stay', ${tomorrow})`)).rejects.toThrow(/guest issue/);
    const c = (await one(`SELECT public.record_corrective_commitment('${guest}', 'Deep clean before next stay', ${tomorrow}) r`)).r;
    await expect(db.query(`SELECT public.approve_corrective_commitment('${c.record_id}')`)).rejects.toThrow(/Only the COO/);
    await db.exec(`INSERT INTO public.functional_role_members VALUES ('coo', '${COO}')`);
    await asUser(COO);
    const a = (await one(`SELECT public.approve_corrective_commitment('${c.record_id}') r`)).r;
    expect(a.already_recorded).toBe(false);
    expect((await one(`SELECT public.approve_corrective_commitment('${c.record_id}') r`)).r.already_recorded).toBe(true);
    const row = await one(`SELECT refers_to, details FROM public.scorecard_records WHERE id=$1`, [a.record_id]);
    expect(row.refers_to).toBe(c.record_id);
    expect(row.details.action).toBe("coo_approval");
  });

  it("finance packet: Supervisor or Director; an incomplete packet needs what was missing", async () => {
    await asUser(TECH);
    await expect(db.query(`SELECT public.record_finance_packet(${tomorrow}, true)`)).rejects.toThrow(/Only the Operations Supervisor or Director/);
    await asUser(SUP);
    await expect(db.query(`SELECT public.record_finance_packet(${tomorrow}, false)`)).rejects.toThrow(/missing/);
    const r = (await one(`SELECT public.record_finance_packet(${tomorrow}, false, 'Two receipts') r`)).r;
    expect(r.record_id).toBeTruthy();
  });

  it("guest rating channels: Supervisor or Director only, default Airbnb and Vrbo", async () => {
    const def = await one(`SELECT value FROM public.app_settings WHERE key='guest_rating_channels'`);
    expect(def.value.channels).toEqual(["airbnb", "vrbo"]);
    await asUser(TECH);
    await expect(db.query(`SELECT public.set_guest_rating_channels(ARRAY['airbnb'])`)).rejects.toThrow(/Only the Operations Supervisor or Director/);
    await asUser(DIR_OPS);
    await expect(db.query(`SELECT public.set_guest_rating_channels(ARRAY['tiktok'])`)).rejects.toThrow(/Unknown channel/);
    const v = (await one(`SELECT public.set_guest_rating_channels(ARRAY['vrbo','airbnb','booking_com']) r`)).r;
    expect(v.channels).toEqual(["airbnb", "booking_com", "vrbo"]);
  });
});

describe("Notion imports stay excludable", () => {
  it("flags records about imported tickets and leaves them out of the countable view", async () => {
    const imported = await newTicket("external_source", "'notion'");
    const live = await newTicket();
    await asUser(SUP);
    await one(`SELECT public.record_corrective_commitment('${imported}', 'Replace the lock box', ${tomorrow})`);
    await one(`SELECT public.record_corrective_commitment('${live}', 'Replace the lock box', ${tomorrow})`);
    const flags = (await db.query(`SELECT ticket_id, about_imported_ticket FROM public.scorecard_records WHERE ticket_id IN ($1,$2)`, [imported, live])).rows;
    expect(flags.find((f) => f.ticket_id === imported).about_imported_ticket).toBe(true);
    expect(flags.find((f) => f.ticket_id === live).about_imported_ticket).toBe(false);
    const counted = (await db.query(`SELECT ticket_id FROM public.scorecard_records_countable WHERE ticket_id IN ($1,$2)`, [imported, live])).rows;
    expect(counted.map((c) => c.ticket_id)).toEqual([live]);
  });
});

describe("ticket receipt time and history time", () => {
  it("a screen cannot pick the received time, and nobody can change it later", async () => {
    await asUser(TECH);
    await db.exec(`SET ROLE authenticated`);
    let id: string;
    try {
      id = (await one(`INSERT INTO public.tickets(title, reported_at) VALUES ('Leak', '2020-01-01T00:00:00Z') RETURNING id, reported_at`)).id;
    } finally {
      await db.exec(`RESET ROLE`);
    }
    const row = await one(`SELECT reported_at FROM public.tickets WHERE id=$1`, [id]);
    expect(Math.abs(new Date(row.reported_at).getTime() - Date.now())).toBeLessThan(60_000);
    await expect(db.query(`UPDATE public.tickets SET reported_at = now() - interval '1 day' WHERE id=$1`, [id])).rejects.toThrow(/cannot be changed/);
    await db.query(`UPDATE public.tickets SET title='Leak under sink' WHERE id=$1`, [id]);
  });

  it("a trusted server function (the Notion import) keeps the original date", async () => {
    const id = await newTicket("reported_at", "'2025-03-01T12:00:00Z'");
    const row = await one(`SELECT reported_at FROM public.tickets WHERE id=$1`, [id]);
    expect(new Date(row.reported_at).toISOString()).toBe("2025-03-01T12:00:00.000Z");
  });

  it("every history line from a screen gets the server time", async () => {
    const t = await newTicket();
    await asUser(TECH);
    await db.exec(`SET ROLE authenticated`);
    try {
      await db.query(`INSERT INTO public.ticket_activity(ticket_id, author_id, body, created_at, event_at, event_type, external_id)
        VALUES ($1, '${TECH}', 'Called guest', '2020-01-01', '2020-01-01', 'imported_comment', 'x')`, [t]);
    } finally {
      await db.exec(`RESET ROLE`);
    }
    const row = await one(`SELECT created_at, event_at FROM public.ticket_activity WHERE ticket_id=$1`, [t]);
    expect(Math.abs(new Date(row.event_at).getTime() - Date.now())).toBeLessThan(60_000);
    expect(Math.abs(new Date(row.created_at).getTime() - Date.now())).toBeLessThan(60_000);
  });

  it("records next action set, changed and completed, and Waiting as its own state", async () => {
    await asUser(TECH);
    const t = await newTicket();
    await db.query(`UPDATE public.tickets SET next_action='Call plumber', next_action_due_at=now() + interval '2 hours' WHERE id=$1`, [t]);
    await db.query(`UPDATE public.tickets SET next_action='Call second plumber' WHERE id=$1`, [t]);
    await db.query(`UPDATE public.tickets SET status='waiting', waiting_on='vendor', next_review_at=now() + interval '1 day' WHERE id=$1`, [t]);
    await db.query(`UPDATE public.tickets SET next_review_at=now() + interval '2 days' WHERE id=$1`, [t]);
    await db.query(`UPDATE public.tickets SET status='in_progress', waiting_on=NULL, next_review_at=NULL WHERE id=$1`, [t]);
    await db.query(`UPDATE public.tickets SET next_action=NULL WHERE id=$1`, [t]);
    const rows = (await db.query(`SELECT field, change, waiting_on, actor_id FROM public.ticket_state_log WHERE ticket_id=$1 ORDER BY recorded_at, field, change`, [t])).rows;
    const pairs = rows.map((r) => `${r.field}:${r.change}`);
    expect(pairs.filter((p) => p.startsWith("next_action"))).toEqual(["next_action:set", "next_action:changed", "next_action:completed"]);
    expect(pairs.filter((p) => p.startsWith("waiting"))).toEqual(["waiting:started", "waiting:updated", "waiting:ended"]);
    expect(rows.find((r) => r.change === "ended").waiting_on).toBe("vendor");
    expect(rows.every((r) => r.actor_id === TECH)).toBe(true);
    await expect(db.query(`DELETE FROM public.ticket_state_log WHERE ticket_id=$1`, [t])).rejects.toThrow(/permanent/);
  });
});

describe("completed routine checks are locked", () => {
  it("stamps server time on completion, refuses edits and deletes, allows one follow-up link", async () => {
    await asUser(TECH);
    const id = (await one(`INSERT INTO public.routine_controls(status) VALUES ('due') RETURNING id`)).id;
    await db.query(`UPDATE public.routine_controls SET status='completed', completed_at='2020-01-01', notes='Fine' WHERE id=$1`, [id]);
    const row = await one(`SELECT completed_at, completed_by FROM public.routine_controls WHERE id=$1`, [id]);
    expect(Math.abs(new Date(row.completed_at).getTime() - Date.now())).toBeLessThan(60_000);
    expect(row.completed_by).toBe(TECH);
    await expect(db.query(`UPDATE public.routine_controls SET notes='Changed' WHERE id=$1`, [id])).rejects.toThrow(/permanent/);
    await expect(db.query(`DELETE FROM public.routine_controls WHERE id=$1`, [id])).rejects.toThrow(/permanent/);
    const t = await newTicket();
    await db.query(`UPDATE public.routine_controls SET follow_up_ticket_id=$2 WHERE id=$1`, [id, t]);
    const t2 = await newTicket();
    await expect(db.query(`UPDATE public.routine_controls SET follow_up_ticket_id=$2 WHERE id=$1`, [id, t2])).rejects.toThrow(/permanent/);
  });

  it("adds a correction as a new line, never on an unsaved check, by staff only", async () => {
    const open = (await one(`INSERT INTO public.routine_controls(status) VALUES ('due') RETURNING id`)).id;
    const done = (await one(`INSERT INTO public.routine_controls(status) VALUES ('completed') RETURNING id`)).id;
    await asUser(OWNER);
    await expect(db.query(`SELECT public.add_routine_correction($1, 'Wrong home')`, [done])).rejects.toThrow(/Only staff/);
    await asUser(TECH);
    await expect(db.query(`SELECT public.add_routine_correction($1, 'Wrong home')`, [open])).rejects.toThrow(/not saved yet/);
    const r = (await one(`SELECT public.add_routine_correction($1, 'Guest was in unit 2') r`, [done])).r;
    expect(r.correction_id).toBeTruthy();
    await expect(db.query(`UPDATE public.routine_check_corrections SET note='x'`)).rejects.toThrow(/permanent/);
  });
});

describe("archive replaces delete", () => {
  it("nobody can delete a ticket, Admin included, and the delete policy is gone", async () => {
    const t = await newTicket();
    await expect(db.query(`DELETE FROM public.tickets WHERE id=$1`, [t])).rejects.toThrow(/never deleted/);
    await asUser(ADMIN);
    await db.exec(`SET ROLE authenticated`);
    try {
      await expect(db.query(`DELETE FROM public.tickets WHERE id=$1`, [t])).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec(`RESET ROLE`);
    }
    const p = await one(`SELECT count(*)::int n FROM pg_policy WHERE polname='tickets_delete_admin'`);
    expect(p.n).toBe(0);
  });

  it("archive needs a reason and a Supervisor or Admin, keeps history, and only an Admin restores", async () => {
    const t = await newTicket();
    await asUser(TECH);
    await expect(db.query(`SELECT public.archive_ticket($1, 'Duplicate')`, [t])).rejects.toThrow(/Only an Admin or a Supervisor/);
    await asUser(SUP);
    await expect(db.query(`SELECT public.archive_ticket($1, ' ')`, [t])).rejects.toThrow(/reason/);
    await one(`SELECT public.archive_ticket($1, 'Duplicate of another ticket')`, [t]);
    const row = await one(`SELECT archived_at, archived_by, archive_reason FROM public.tickets WHERE id=$1`, [t]);
    expect(row.archived_at).toBeTruthy();
    expect(row.archived_by).toBe(SUP);
    expect(row.archive_reason).toBe("Duplicate of another ticket");
    await expect(db.query(`SELECT public.restore_ticket($1)`, [t])).rejects.toThrow(/Only an Admin/);
    await asUser(ADMIN);
    await one(`SELECT public.restore_ticket($1)`, [t]);
    const back = await one(`SELECT archived_at FROM public.tickets WHERE id=$1`, [t]);
    expect(back.archived_at).toBeNull();
    const lines = (await db.query(`SELECT event_type, body FROM public.ticket_activity WHERE ticket_id=$1 ORDER BY created_at, seq`, [t])).rows;
    expect(lines.map((l) => l.event_type)).toEqual(["archived", "restored"]);
    expect(lines[0].body).toBe("Archived. Reason: Duplicate of another ticket");
  });

  it("an archived ticket's records drop out of the countable view", async () => {
    const t = await newTicket();
    await asUser(SUP);
    await one(`SELECT public.record_corrective_commitment('${t}', 'Swap the mattress', ${tomorrow})`);
    await one(`SELECT public.archive_ticket($1, 'Opened by mistake')`, [t]);
    const n = (await one(`SELECT count(*)::int n FROM public.scorecard_records_countable WHERE ticket_id=$1`, [t])).n;
    expect(n).toBe(0);
    const kept = (await one(`SELECT count(*)::int n FROM public.scorecard_records WHERE ticket_id=$1`, [t])).n;
    expect(kept).toBe(1);
  });
});

describe("undo files run clean", () => {
  it("removes functions and triggers in reverse order and keeps every recorded line", async () => {
    const before = (await one(`SELECT count(*)::int n FROM public.scorecard_records`)).n;
    for (const f of ["04_undo_ticket_archive.sql", "03_undo_routine_check_lock.sql", "02_undo_ticket_times_and_states.sql", "01_undo_scorecard_records.sql"]) {
      await db.exec(readFileSync(`${DIR}/${f}`, "utf8"));
    }
    expect((await one(`SELECT count(*)::int n FROM public.scorecard_records`)).n).toBe(before);
    expect((await one(`SELECT count(*)::int n FROM pg_policy WHERE polname='tickets_delete_admin'`)).n).toBe(1);
    expect((await one(`SELECT count(*)::int n FROM pg_proc WHERE proname IN ('archive_ticket','record_arrival_readiness','log_ticket_state','add_routine_correction')`)).n).toBe(0);
  });
});
