import { beforeAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Isolated PostgreSQL check of the staged Direct Bookings fix
 * (docs/pending/direct-bookings-fix/). Today's five functions are loaded
 * verbatim from live-capture/; the helpers they call come verbatim from the
 * applied Direct Bookings migration. Only tables are stubbed. Nothing touches
 * the real database.
 */
const DIR = "docs/pending/direct-bookings-fix";
const read = (p: string) => readFileSync(p, "utf8");
const live = (n: string) => read(`${DIR}/live-capture/public.${n}.sql`).trimEnd() + ";\n";
const MIGRATION = read("drizzle/migrations/0262_direct_bookings.sql");
/** One function from the applied migration, exactly as written there. */
function applied(name: string) {
  const start = MIGRATION.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  if (start < 0) throw new Error(`missing ${name}`);
  const plpgsql = MIGRATION.indexOf("END $$;", start);
  const sql = MIGRATION.indexOf("\n$$;", start);
  const end = [plpgsql, sql].filter((i) => i > 0).sort((a, b) => a - b)[0]!;
  return MIGRATION.slice(start, end + (end === plpgsql ? "END $$;".length : "\n$$;".length));
}
const FIELDS = read(`${DIR}/01_request_fields.sql`);
const FIELDS_UNDO = read(`${DIR}/01_undo_request_fields.sql`);
const ACTIONS = read(`${DIR}/02_guarded_actions.sql`);
const ACTIONS_UNDO = read(`${DIR}/02_undo_guarded_actions.sql`);
const LIVE_FNS = ["request_direct_booking_approval", "decide_direct_booking_approval", "record_direct_booking_reply", "record_direct_booking_follow_up", "mark_direct_booking_outcome"];

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const SUP = U(1), DIR_OPS = U(2), COO = U(3), PC = U(4), PC2 = U(5);
const H_OK = U(11), H_PROGRAM = U(12), H_MAX = U(13), H_LEFT_PROGRAM = U(14);

const SCHEMA = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
CREATE TABLE public.staff(id uuid PRIMARY KEY);
CREATE FUNCTION public.is_internal_staff(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS (SELECT 1 FROM public.staff WHERE id = _u) $$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY, email text, full_name text);
CREATE TABLE public.functional_roles(code text PRIMARY KEY, active boolean DEFAULT true, current_seat_holder uuid);
CREATE TABLE public.functional_role_members(role_code text, user_id uuid);
CREATE TABLE public.app_settings(key text PRIMARY KEY, value jsonb, updated_by uuid, updated_at timestamptz);
CREATE TABLE public.audit_log(actor_id uuid, action text, entity_type text, entity_label text, after_value jsonb);
CREATE TABLE public.properties(id uuid PRIMARY KEY, name text);
CREATE TABLE public.owner_program_properties(property_id uuid, archived_at timestamptz);
CREATE TABLE public.staff_notifications(user_id uuid, kind text, title text, body text, entity_type text, entity_id uuid, link_path text, priority text, is_demo boolean);
CREATE TABLE public.lead_activity(lead_id uuid, channel text, outcome text, note text, actor_id uuid, occurred_at timestamptz);
CREATE TABLE public.leads(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text, partner_name text, company text, subject text,
  owned_by uuid, assigned_to uuid, started_at timestamptz, reply_to text, reply_cc text[], reply_subject text, reply_body text,
  offered_property_ids uuid[], reply_sent_at timestamptz, reply_sent_by uuid, reply_sent_via text, quote_sent_at timestamptz,
  last_contact_at timestamptz, last_follow_up_at timestamptz, stage text, updated_at timestamptz,
  outcome text, outcome_at timestamptz, outcome_by uuid, booked_property_id uuid, booked_move_in date,
  converted_at timestamptz, converted_by uuid, converted_property_id uuid,
  not_booked_reason text, not_booked_note text, lost_at timestamptz, lost_note text,
  is_demo boolean DEFAULT false, created_at timestamptz DEFAULT now());
CREATE TABLE public.direct_booking_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL, requested_at timestamptz NOT NULL DEFAULT now(), reply jsonb NOT NULL,
  property_ids uuid[] NOT NULL DEFAULT '{}', escalated_at timestamptz,
  decision text CHECK (decision IS NULL OR decision IN ('approved','sent_back')), decided_by uuid, decided_at timestamptz,
  decided_as text, note text);
CREATE UNIQUE INDEX direct_booking_one_pending ON public.direct_booking_approvals (lead_id) WHERE decision IS NULL;
`;

async function fresh(withFix = true) {
  const db = new PGlite();
  await db.exec(SCHEMA);
  for (const n of ["holds_functional_role", "functional_role_holders", "direct_booking_settings", "direct_booking_approval_required", "direct_booking_notify", "escalate_direct_booking_approvals"])
    await db.exec(applied(n));
  for (const n of LIVE_FNS) await db.exec(live(n));
  await db.exec(`
    INSERT INTO public.staff VALUES ('${SUP}'), ('${DIR_OPS}'), ('${COO}'), ('${PC}'), ('${PC2}');
    INSERT INTO public.profiles VALUES ('${SUP}', 'Sup@arha.test', 'S'), ('${DIR_OPS}', 'dir@arha.test', 'D'), ('${COO}', 'coo@arha.test', 'C'), ('${PC}', 'pc@arha.test', 'P'), ('${PC2}', 'pc2@arha.test', 'Q');
    INSERT INTO public.functional_roles(code, current_seat_holder) VALUES ('ops_supervisor', '${SUP}'), ('director_ops', '${DIR_OPS}'), ('coo', '${COO}'), ('ge_day', '${PC}');
    INSERT INTO public.properties VALUES ('${H_OK}', 'Oak Home'), ('${H_PROGRAM}', 'Elm Home'), ('${H_MAX}', 'Ash 7D MAX'), ('${H_LEFT_PROGRAM}', 'Fir Home');
    INSERT INTO public.owner_program_properties VALUES ('${H_PROGRAM}', NULL), ('${H_LEFT_PROGRAM}', now() - interval '1 day');
    INSERT INTO public.app_settings(key, value) VALUES ('direct_booking_settings', '{"requireApprovalAfterEnd": true, "approvalStart": "2000-01-01", "approvalEnd": "2000-01-02"}');
  `);
  if (withFix) {
    await db.exec(FIELDS);
    await db.exec(ACTIONS);
  }
  return db;
}

const as = (db: PGlite, user: string | null) => db.query("SELECT set_config('test.uid', $1, false)", [user ?? ""]);
const newLead = async (db: PGlite, owner: string | null = PC, extra = "") =>
  (await db.query<{ id: string }>(`INSERT INTO public.leads(kind, owned_by, partner_name, subject${extra ? ", " + extra.split("=")[0] : ""}) VALUES ('direct_booking', $1, 'Partner', 'Need a home'${extra ? ", " + extra.split("=")[1] : ""}) RETURNING id`, [owner])).rows[0]!.id;
const err = async (p: Promise<unknown>) => {
  try { await p; return null; } catch (e) { return (e as Error).message; }
};
const reply = (cc: string[] = []) => JSON.stringify({ to: "partner@x.test", subject: "RE: Need a home", body: "Hello", cc });

describe("staged Direct Bookings fix: request fields (part 1)", () => {
  it("adds the nine fields, all optional, and backfills the follow-up time for sent quotes", async () => {
    const db = await fresh(false);
    const sent = await newLead(db);
    await db.query("UPDATE public.leads SET reply_sent_at = '2026-11-10T15:00:00Z' WHERE id = $1", [sent]);
    await db.exec(FIELDS);
    const cols = (await db.query<{ column_name: string; is_nullable: string }>("SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'leads' AND column_name IN ('asap','stay_length','preferred_bedrooms','near_address','distance_wanted','follow_up_due_at','partner_approved_at','partner_approved_by','partner_approved_note')")).rows;
    expect(cols).toHaveLength(9);
    expect(cols.every((c) => c.is_nullable === "YES")).toBe(true);
    const due = (await db.query<{ d: string }>("SELECT to_char(follow_up_due_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') d FROM public.leads WHERE id = $1", [sent])).rows[0]!.d;
    expect(due).toBe("2026-11-12 15:00");
    expect(await err(db.query("UPDATE public.leads SET preferred_bedrooms = 40 WHERE id = $1", [sent]))).toMatch(/preferred_bedrooms/);
  });
});

describe("staged Direct Bookings fix: guarded actions (part 2)", () => {
  let db: PGlite;
  beforeAll(async () => { db = await fresh(); });

  it("7. the copy list is the Operations Supervisor and Director of Operations holders, never the COO", async () => {
    expect((await db.query<{ c: string[] }>("SELECT public.direct_booking_cc_emails() c")).rows[0]!.c).toEqual(["dir@arha.test", "sup@arha.test"]);
    // A COO holder who is also named a Director is still never copied.
    await db.exec(`INSERT INTO public.functional_role_members VALUES ('director_ops', '${COO}')`);
    expect((await db.query<{ c: string[] }>("SELECT public.direct_booking_cc_emails() c")).rows[0]!.c).toEqual(["dir@arha.test", "sup@arha.test"]);
    await db.exec(`DELETE FROM public.functional_role_members WHERE user_id = '${COO}'`);
  });

  it("13. refuses an Active Owner home at send, and forces the copy to the two roles", async () => {
    const lead = await newLead(db);
    await as(db, PC);
    for (const home of [H_PROGRAM, H_MAX])
      expect(await err(db.query("SELECT public.request_direct_booking_approval($1, $2::jsonb, $3::uuid[])", [lead, reply(), `{${H_OK},${home}}`]))).toMatch(/Active Owner program/);
    const r = (await db.query<{ r: { approval_required: boolean; reply: { cc: string[] } } }>(
      "SELECT public.request_direct_booking_approval($1, $2::jsonb, $3::uuid[]) r", [lead, reply(["coo@arha.test", "anyone@x.test"]), `{${H_OK},${H_LEFT_PROGRAM}}`])).rows[0]!.r;
    expect(r.approval_required).toBe(true);
    expect(r.reply.cc).toEqual(["dir@arha.test", "sup@arha.test"]);
    const saved = (await db.query<{ reply_cc: string[] }>("SELECT reply_cc FROM public.leads WHERE id = $1", [lead])).rows[0]!;
    expect(saved.reply_cc).toEqual(["dir@arha.test", "sup@arha.test"]);
    const stored = (await db.query<{ cc: string[] }>("SELECT reply->'cc' cc FROM public.direct_booking_approvals WHERE lead_id = $1", [lead])).rows[0]!;
    expect(stored.cc).toEqual(["dir@arha.test", "sup@arha.test"]);
  });

  it("13. a home that joined Active Owner after it was picked cannot be approved; approval returns the role copy", async () => {
    const lead = await newLead(db);
    await as(db, PC);
    await db.query("SELECT public.request_direct_booking_approval($1, $2::jsonb, $3::uuid[])", [lead, reply(), `{${H_OK}}`]);
    await db.exec(`INSERT INTO public.owner_program_properties VALUES ('${H_OK}', NULL)`);
    await as(db, SUP);
    expect(await err(db.query("SELECT public.decide_direct_booking_approval($1, 'approved')", [lead]))).toMatch(/Active Owner program/);
    expect((await db.query<{ n: number }>("SELECT count(*)::int n FROM public.direct_booking_approvals WHERE lead_id = $1 AND decision IS NULL", [lead])).rows[0]!.n).toBe(1);
    await db.exec(`DELETE FROM public.owner_program_properties WHERE property_id = '${H_OK}'`);
    // Sending back still works with an Active Owner home, so the coordinator can fix it.
    const r = (await db.query<{ r: { decided_as: string; reply: { cc: string[] } } }>("SELECT public.decide_direct_booking_approval($1, 'approved') r", [lead])).rows[0]!.r;
    expect(r.decided_as).toBe("ops_supervisor");
    expect(r.reply.cc).toEqual(["dir@arha.test", "sup@arha.test"]);
  });

  it("5. recording the reply stores a follow-up due 48 hours later; each follow-up moves it 48 hours on", async () => {
    const lead = await newLead(db);
    await as(db, PC);
    await db.query("SELECT public.request_direct_booking_approval($1, $2::jsonb, $3::uuid[])", [lead, reply(), `{${H_OK}}`]);
    await as(db, SUP);
    await db.query("SELECT public.decide_direct_booking_approval($1, 'approved')", [lead]);
    await db.query("SELECT public.record_direct_booking_reply($1, 'mailbox')", [lead]);
    const a = (await db.query<{ h: number }>("SELECT extract(epoch FROM follow_up_due_at - reply_sent_at)::int / 3600 h FROM public.leads WHERE id = $1", [lead])).rows[0]!;
    expect(a.h).toBe(48);
    await as(db, PC);
    await db.query("SELECT public.record_direct_booking_follow_up($1)", [lead]);
    const b = (await db.query<{ h: number }>("SELECT extract(epoch FROM follow_up_due_at - last_follow_up_at)::int / 3600 h FROM public.leads WHERE id = $1", [lead])).rows[0]!;
    expect(b.h).toBe(48);
  });

  it("14. not booked needs a reason from the list and a note, in the database", async () => {
    const lead = await newLead(db);
    await db.query("UPDATE public.leads SET reply_sent_at = now() WHERE id = $1", [lead]);
    await as(db, PC2);
    expect(await err(db.query("SELECT public.mark_direct_booking_outcome($1, 'not_booked', NULL, NULL, NULL, 'went elsewhere')", [lead]))).toMatch(/Choose a reason/);
    expect(await err(db.query("SELECT public.mark_direct_booking_outcome($1, 'not_booked', NULL, NULL, 'Too expensive', 'x')", [lead]))).toMatch(/Choose a reason/);
    expect(await err(db.query("SELECT public.mark_direct_booking_outcome($1, 'not_booked', NULL, NULL, 'Price was too high', '  ')", [lead]))).toMatch(/Add a short note/);
    await db.query("SELECT public.mark_direct_booking_outcome($1, 'not_booked', NULL, NULL, 'Price was too high', 'Went with a hotel')", [lead]);
    const row = (await db.query<{ outcome: string; not_booked_reason: string }>("SELECT outcome, not_booked_reason FROM public.leads WHERE id = $1", [lead])).rows[0]!;
    expect(row).toEqual({ outcome: "not_booked", not_booked_reason: "Price was too high" });
  });

  it("4. the coordinator confirms the partner approved: once, with history, only on a sent and open quote", async () => {
    const lead = await newLead(db);
    await as(db, PC);
    expect(await err(db.query("SELECT public.mark_direct_booking_partner_approved($1, 'ok')", [lead]))).toMatch(/Send the reply first/);
    await db.query("UPDATE public.leads SET reply_sent_at = now() WHERE id = $1", [lead]);
    const first = (await db.query<{ t: string }>("SELECT public.mark_direct_booking_partner_approved($1, 'The adjuster approved the home.') t", [lead])).rows[0]!.t;
    const again = (await db.query<{ t: string }>("SELECT public.mark_direct_booking_partner_approved($1, 'again') t", [lead])).rows[0]!.t;
    expect(String(again)).toBe(String(first));
    const row = (await db.query<{ partner_approved_by: string; partner_approved_note: string }>("SELECT partner_approved_by, partner_approved_note FROM public.leads WHERE id = $1", [lead])).rows[0]!;
    expect(row).toEqual({ partner_approved_by: PC, partner_approved_note: "The adjuster approved the home." });
    expect((await db.query<{ n: number }>("SELECT count(*)::int n FROM public.lead_activity WHERE lead_id = $1 AND outcome = 'Partner approved'", [lead])).rows[0]!.n).toBe(1);
    // Booking from Approved still goes through the same outcome rule.
    await db.query("SELECT public.mark_direct_booking_outcome($1, 'booked')", [lead]);
    expect(await err(db.query("SELECT public.mark_direct_booking_partner_approved($1, NULL)", [lead]))).toMatch(/already finished/);
    await as(db, U(99));
    expect(await err(db.query("SELECT public.mark_direct_booking_partner_approved($1, NULL)", [lead]))).toMatch(/staff only/);
  });

  it("12. the 2 minute check alerts the Director of Operations once, with no screen open", async () => {
    const lead = await newLead(db);
    await as(db, PC);
    await db.query("SELECT public.request_direct_booking_approval($1, $2::jsonb, $3::uuid[])", [lead, reply(), `{${H_OK}}`]);
    await db.query("UPDATE public.direct_booking_approvals SET requested_at = now() - interval '3 minutes' WHERE lead_id = $1", [lead]);
    await as(db, null);
    await db.query("SELECT public.escalate_direct_booking_approvals()");
    await db.query("SELECT public.escalate_direct_booking_approvals()");
    const n = (await db.query<{ n: number }>("SELECT count(*)::int n FROM public.staff_notifications WHERE entity_id = $1 AND kind = 'direct_booking_escalated' AND user_id = $2", [lead, DIR_OPS])).rows[0]!.n;
    expect(n).toBe(1);
    const job = read(`${DIR}/03_escalation_schedule.sql`).replace(/^--.*$/gm, "");
    expect(job).toMatch(/cron\.schedule\(\s*'direct-booking-approval-escalation',\s*'20 seconds',\s*\$\$SELECT public\.escalate_direct_booking_approvals\(\)\$\$\s*\)/);
    expect(read(`${DIR}/03_undo_escalation_schedule.sql`)).toMatch(/cron\.unschedule\('direct-booking-approval-escalation'\)/);
  });

  it("who may act is unchanged: only the owner sends, only the two roles approve", async () => {
    const lead = await newLead(db);
    await as(db, PC2);
    expect(await err(db.query("SELECT public.request_direct_booking_approval($1, $2::jsonb, $3::uuid[])", [lead, reply(), `{${H_OK}}`]))).toMatch(/Only the person who started/);
    await as(db, PC);
    await db.query("SELECT public.request_direct_booking_approval($1, $2::jsonb, $3::uuid[])", [lead, reply(), `{${H_OK}}`]);
    for (const who of [PC, PC2, COO]) {
      await as(db, who);
      expect(await err(db.query("SELECT public.decide_direct_booking_approval($1, 'approved')", [lead]))).toMatch(/Only the Operations Supervisor/);
    }
    await as(db, DIR_OPS);
    expect(await err(db.query("SELECT public.decide_direct_booking_approval($1, 'approved')", [lead]))).toMatch(/after 2 minutes/);
  });

  it("the new helpers are not open to anonymous callers", async () => {
    for (const fn of ["direct_booking_active_owner_homes(uuid[])", "direct_booking_cc_emails()", "mark_direct_booking_partner_approved(uuid,text)"]) {
      const r = (await db.query<{ anon: boolean; auth: boolean }>(`SELECT has_function_privilege('anon', 'public.${fn}', 'EXECUTE') anon, has_function_privilege('authenticated', 'public.${fn}', 'EXECUTE') auth`)).rows[0]!;
      expect(r).toEqual({ anon: false, auth: true });
    }
  });
});

describe("staged Direct Bookings fix: undo", () => {
  it("restores today's five functions exactly and removes everything added", async () => {
    const before = await fresh(false);
    const original: Record<string, string> = {};
    for (const n of LIVE_FNS)
      original[n] = (await before.query<{ d: string }>("SELECT pg_get_functiondef(p.oid) d FROM pg_proc p WHERE p.proname = $1", [n])).rows[0]!.d;
    const db = await fresh(true);
    await db.exec(ACTIONS_UNDO);
    await db.exec(FIELDS_UNDO);
    for (const n of LIVE_FNS) {
      const now = (await db.query<{ d: string }>("SELECT pg_get_functiondef(p.oid) d FROM pg_proc p WHERE p.proname = $1", [n])).rows[0]!.d;
      expect({ n, same: now === original[n] }).toEqual({ n, same: true });
    }
    const gone = (await db.query<{ n: number }>("SELECT count(*)::int n FROM pg_proc WHERE proname IN ('direct_booking_active_owner_homes','direct_booking_cc_emails','mark_direct_booking_partner_approved')")).rows[0]!.n;
    expect(gone).toBe(0);
    const cols = (await db.query<{ n: number }>("SELECT count(*)::int n FROM information_schema.columns WHERE table_name = 'leads' AND column_name IN ('asap','follow_up_due_at','partner_approved_at')")).rows[0]!.n;
    expect(cols).toBe(0);
  });
});
