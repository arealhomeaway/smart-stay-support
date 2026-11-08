// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Isolated PostgreSQL check of docs/pending/record-routine. Tables are stubbed.
 * Nothing touches the real database.
 */
const DIR = "docs/pending/record-routine";
const STAFF = "00000000-0000-4000-8000-000000000002";
const OWNER = "00000000-0000-4000-8000-000000000003";
const HOME = "00000000-0000-4000-8000-0000000000a1";
const REVIEW = "00000000-0000-4000-8000-0000000000b1";
const LEGACY = [
  ["a5e4548a-410d-44e2-be4f-765b6aadc744", "cleaning_review", "due"],
  ["9afa4f19-2046-4520-b914-f62a2c3bc36d", "guest_review", "due"],
  ["42303dca-1b7f-4830-9e08-e0d6058a85ad", "cleaning_review", "due"],
  ["2aa3270e-0d88-447b-9098-e97beef7abb2", "guest_review", "in_progress"],
  ["864cc2ea-699b-468b-9ee2-8df30fb6111b", "cleaning_review", "due"],
  ["79cc07e5-ad37-4ca5-8f17-fb3813375c29", "checkout", "due"],
  ["04bea9f5-c65e-4843-a287-f3580e651744", "checkout", "due"],
];

const STUBS = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private;
CREATE TABLE public.me(id uuid);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.me LIMIT 1 $$;
CREATE TABLE public.user_roles(user_id uuid, role text);
INSERT INTO public.user_roles VALUES ('${STAFF}','tech'), ('${OWNER}','owner');
CREATE FUNCTION public.is_internal_staff(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_u AND role IN ('admin','manager','tech','onboarding')) $$;
CREATE TABLE public.properties(id uuid PRIMARY KEY, is_demo boolean DEFAULT false);
INSERT INTO public.properties VALUES ('${HOME}', false);
CREATE TABLE public.guest_feedback(id uuid PRIMARY KEY);
INSERT INTO public.guest_feedback VALUES ('${REVIEW}');
CREATE TABLE public.feature_flags(key text PRIMARY KEY, label text NOT NULL, description text, enabled boolean NOT NULL DEFAULT false,
  updated_by uuid, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE public.work_types(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, category text, bucket text, default_priority text,
  response_minutes int, action_start_minutes int, functional_role_code text, active boolean DEFAULT true);
INSERT INTO public.work_types(name, category, default_priority, response_minutes, action_start_minutes, functional_role_code) VALUES
  ('Maintenance and landscaping work-order review', 'maintenance', 'p3', 120, 1440, 'po_day'),
  ('Ongoing maintenance', 'maintenance', 'p2', 3, 30, 'po_day'),
  ('Current or past guest request', 'guest', 'p2', 3, 5, 'ge_day'),
  ('Guest review, survey and rating logs', 'guest', 'p3', 120, 480, 'ge_day');
CREATE TABLE public.tickets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, description text, property_id uuid,
  work_type_id uuid, functional_role_code text, category text, bucket text, priority text, suggested_priority text, source_channel text,
  record_type text, entry_kind text, status text, reported_at timestamptz, acknowledged_at timestamptz, response_due_at timestamptz,
  action_due_at timestamptz, due_at timestamptz, created_by uuid, record_owner uuid, accountable_owner uuid, guest_name text,
  guest_in_residence boolean, linked_feedback_id uuid, is_demo boolean);
CREATE TABLE public.ticket_activity(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id uuid, author_id uuid, kind text,
  event_type text, body text, internal boolean, is_demo boolean);
CREATE TABLE public.routine_controls(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL, event_key text NOT NULL,
  property_id uuid, ticket_id uuid, follow_up_ticket_id uuid REFERENCES public.tickets(id), status text NOT NULL DEFAULT 'due',
  outcome text, title text NOT NULL, guest_name text, reservation_confirmation text, reservation_channel text, stay_arrival date,
  stay_departure date, due_at timestamptz NOT NULL DEFAULT now(), assigned_to uuid, assigned_role_code text, team text, findings text,
  notes text, contact_result text, evidence_urls text[] NOT NULL DEFAULT '{}', completed_by uuid, completed_at timestamptz,
  created_by uuid, is_demo boolean NOT NULL DEFAULT false, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE UNIQUE INDEX routine_controls_event_key_idx ON public.routine_controls(kind, event_key);
`;

let db: PGlite;
const asUser = (id: string) => db.exec(`DELETE FROM public.me; INSERT INTO public.me VALUES ('${id}');`);
const save = async (c: Record<string, unknown>) =>
  (await db.query<{ r: Record<string, unknown> }>("SELECT public.record_routine_check($1::jsonb) r", [JSON.stringify(c)])).rows[0].r;
const one = async (sql: string, p: unknown[] = []) => (await db.query<Record<string, unknown>>(sql, p)).rows[0];
const count = async (sql: string) => Number((await one(sql)).n);
const touch = (over: Record<string, unknown> = {}) => ({
  kind: "guest_touch_base", event_key: "touchbase:1", property_id: HOME, title: "Touch base", outcome: "looks_good", answers: {}, ...over,
});

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  await db.exec(readFileSync(`${DIR}/01_record_routine.sql`, "utf8"));
});

describe("pending record_routine_check SQL", () => {
  it("only staff can record routine work", async () => {
    await asUser(OWNER);
    await expect(save(touch())).rejects.toThrow(/Only staff/);
  });

  it("retired checks are refused, and no new Cleaning Review row can be made", async () => {
    await asUser(STAFF);
    await expect(save(touch({ kind: "checkout" }))).rejects.toThrow(/retired/);
    await expect(save(touch({ kind: "cleaning_review" }))).rejects.toThrow(/retired/);
    await expect(
      db.exec("INSERT INTO public.routine_controls(kind, event_key, title) VALUES ('cleaning_review','x','x')"),
    ).rejects.toThrow(/retired/);
  });

  it("survey reviews are refused until the switch is on", async () => {
    await asUser(STAFF);
    await expect(save(touch({ kind: "survey_review", event_key: "survey:1" }))).rejects.toThrow(/not live yet/);
    await db.exec(readFileSync(`${DIR}/02_survey_switch.sql`, "utf8"));
    expect((await one("SELECT enabled FROM public.feature_flags WHERE key='survey_review_check'")).enabled).toBe(false);
    await expect(save(touch({ kind: "survey_review", event_key: "survey:1" }))).rejects.toThrow(/not live yet/);
    await db.exec("UPDATE public.feature_flags SET enabled = true WHERE key='survey_review_check'");
    expect((await save(touch({ kind: "survey_review", event_key: "survey:1" }))).ticket_id).toBeNull();
    await db.exec("UPDATE public.feature_flags SET enabled = false WHERE key='survey_review_check'");
  });

  it("a guest review needs the reply, where it was posted and the repeat answer", async () => {
    await asUser(STAFF);
    const r = { kind: "guest_review", event_key: `review:${REVIEW}`, feedback_id: REVIEW, property_id: HOME, title: "Review", outcome: "looks_good" };
    await expect(save({ ...r, answers: {} })).rejects.toThrow(/what we replied/);
    await expect(save({ ...r, answers: { reply_text: "Thanks" } })).rejects.toThrow(/where you posted/);
    await expect(save({ ...r, answers: { reply_text: "Thanks", posted_on: "airbnb" } })).rejects.toThrow(/repeat issue/);
    const ok = await save({ ...r, answers: { reply_text: "Thanks", posted_on: "airbnb", repeat_issue: "no" } });
    const row = await one("SELECT * FROM public.routine_controls WHERE id=$1", [ok.routine_id]);
    expect(row.status).toBe("completed");
    expect(row.completed_by).toBe(STAFF);
    expect(row.property_id).toBe(HOME);
    expect(row.guest_feedback_id).toBe(REVIEW);
    expect(row.answers.posted_on).toBe("airbnb");
  });

  it("no issue found opens no ticket", async () => {
    await asUser(STAFF);
    const before = await count("SELECT count(*) n FROM public.tickets");
    expect((await save(touch({ event_key: "touchbase:quiet" }))).ticket_id).toBeNull();
    expect(await count("SELECT count(*) n FROM public.tickets")).toBe(before);
  });

  it("an issue opens a ticket in the chosen team's queue, linked to the check", async () => {
    await asUser(STAFF);
    const r = await save({
      kind: "maintenance_review", event_key: "bz_maint:42", property_id: HOME, title: "Gutter clean", outcome: "needs_follow_up",
      issue: "Downspout still blocked", fix_team: "property_operations", ticket_title: "Work order review: Downspout still blocked", answers: {},
    });
    const t = await one("SELECT * FROM public.tickets WHERE id=$1", [r.ticket_id]);
    expect(t.functional_role_code).toBe("po_day");
    expect(t.title).toBe("Work order review: Downspout still blocked");
    expect(t.property_id).toBe(HOME);
    expect(t.status).toBe("open");
    expect(t.priority).toBe("p3");
    const routine = await one("SELECT * FROM public.routine_controls WHERE id=$1", [r.routine_id]);
    expect(routine.follow_up_ticket_id).toBe(r.ticket_id);
    expect(routine.findings).toBe("Downspout still blocked");
    expect(await count(`SELECT count(*) n FROM public.ticket_activity WHERE ticket_id='${r.ticket_id}'`)).toBe(1);

    const a = await save(touch({ event_key: "touchbase:ac", outcome: "needs_follow_up", issue: "Guest says AC is loud", fix_team: "guest_experience" }));
    expect((await one("SELECT functional_role_code FROM public.tickets WHERE id=$1", [a.ticket_id])).functional_role_code).toBe("ge_day");
  });

  it("saving the same check twice returns the first result and opens no second ticket", async () => {
    await asUser(STAFF);
    const c = touch({ event_key: "touchbase:twice", outcome: "needs_follow_up", issue: "Hot tub cold", fix_team: "property_operations" });
    const first = await save(c);
    const second = await save(c);
    expect(second.already_saved).toBe(true);
    expect(second.ticket_id).toBe(first.ticket_id);
    expect(await count("SELECT count(*) n FROM public.routine_controls WHERE event_key='touchbase:twice'")).toBe(1);
  });

  it("a found issue needs what to fix and which team", async () => {
    await asUser(STAFF);
    await expect(save(touch({ event_key: "touchbase:x", outcome: "needs_follow_up" }))).rejects.toThrow(/needs fixing/);
    await expect(save(touch({ event_key: "touchbase:x", outcome: "needs_follow_up", issue: "Leak" }))).rejects.toThrow(/which team/);
  });

  it("the undo removes the function and the trigger and keeps saved answers", async () => {
    const u = new PGlite();
    await u.exec(STUBS);
    await u.exec(readFileSync(`${DIR}/01_record_routine.sql`, "utf8"));
    await u.exec(readFileSync(`${DIR}/01_undo_record_routine.sql`, "utf8"));
    const n = (await u.query("SELECT count(*)::int n FROM pg_proc WHERE proname IN ('record_routine_check','refuse_new_retired_routine')")).rows[0].n;
    expect(n).toBe(0);
    const col = (await u.query("SELECT count(*)::int n FROM information_schema.columns WHERE table_name='routine_controls' AND column_name='answers'")).rows[0].n;
    expect(col).toBe(1);
  });
});

describe("closing the 7 legacy rows", () => {
  it("closes exactly the 7 rows with the note, and the undo puts them back", async () => {
    const d = new PGlite();
    await d.exec(STUBS);
    for (const [id, kind, status] of LEGACY)
      await d.query("INSERT INTO public.routine_controls(id, kind, event_key, title, status) VALUES ($1::uuid,$2,$4,'Legacy',$3)", [id, kind, status, id]);
    await d.query("INSERT INTO public.routine_controls(kind, event_key, title, status) VALUES ('guest_touch_base','keep','Keep','due')");
    await d.exec(readFileSync(`${DIR}/03_close_legacy_rows.sql`, "utf8"));
    const closed = (await d.query("SELECT count(*)::int n FROM public.routine_controls WHERE status='cancelled' AND notes='Closed: legacy test row'")).rows[0].n;
    expect(closed).toBe(7);
    expect((await d.query("SELECT status FROM public.routine_controls WHERE event_key='keep'")).rows[0].status).toBe("due");
    await expect(d.exec(readFileSync(`${DIR}/03_close_legacy_rows.sql`, "utf8"))).rejects.toThrow(/Expected 7/);
    await d.exec(readFileSync(`${DIR}/03_undo_close_legacy_rows.sql`, "utf8"));
    const back = (await d.query("SELECT id, status, notes FROM public.routine_controls WHERE event_key <> 'keep' ORDER BY id")).rows;
    for (const [id, , status] of LEGACY) expect(back.find((r) => r.id === id)).toEqual({ id, status, notes: null });
  });
});
