import { describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Isolated PostgreSQL check of the staged portal requests change
 * (docs/pending/portal-requests/). Today's reply, approval and follow-up
 * functions are loaded verbatim from live-capture/ (byte-identical to live on
 * Nov 10, 2026); their helpers come verbatim from the applied migrations. Only
 * tables are stubbed. Nothing touches the real database.
 */
const DIR = "docs/pending/portal-requests";
const read = (p: string) => readFileSync(p, "utf8");
const live = (n: string) => read(`${DIR}/live-capture/public.${n}.sql`).trimEnd() + ";\n";
const STAGED = read(`${DIR}/01_portal_requests.sql`);
const UNDO = read(`${DIR}/01_undo_portal_requests.sql`);

function fromMigration(file: string, name: string) {
  const text = read(`drizzle/migrations/${file}`);
  const start = text.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  if (start < 0) throw new Error(`missing ${name}`);
  const ends = [text.indexOf("END $$;", start), text.indexOf("\n$$;", start)].filter((i) => i > 0).sort((a, b) => a - b);
  const end = ends[0]!;
  return text.slice(start, end + (text.startsWith("END $$;", end) ? "END $$;".length : "\n$$;".length));
}

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const SUP = U(1), DIR_OPS = U(2), PC = U(4), PC2 = U(5), ADMIN = U(6);
const H_OK = U(11), H_OK2 = U(12), H_PROGRAM = U(13);

const SCHEMA = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
CREATE TYPE public.lead_stage AS ENUM ('new','first_contact','follow_up_1','final_follow_up','engaged','booking_pending','converted','lost');
CREATE TABLE public.staff(id uuid PRIMARY KEY);
CREATE FUNCTION public.is_internal_staff(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS (SELECT 1 FROM public.staff WHERE id = _u) $$;
CREATE FUNCTION public.has_role(_user_id uuid, _role text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT _user_id = '${ADMIN}'::uuid AND _role = 'admin' $$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY, email text, full_name text);
CREATE TABLE public.functional_roles(code text PRIMARY KEY, active boolean DEFAULT true, current_seat_holder uuid);
CREATE TABLE public.functional_role_members(role_code text, user_id uuid);
CREATE TABLE public.app_settings(key text PRIMARY KEY, value jsonb);
CREATE TABLE public.properties(id uuid PRIMARY KEY, name text);
CREATE TABLE public.owner_program_properties(property_id uuid, archived_at timestamptz);
CREATE TABLE public.staff_notifications(user_id uuid, kind text, title text, body text, entity_type text, entity_id uuid, link_path text, priority text, is_demo boolean);
CREATE TABLE public.lead_activity(lead_id uuid, channel text, outcome text, note text, actor_id uuid, occurred_at timestamptz);
CREATE TABLE public.leads(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text, partner_name text, subject text, email text,
  owned_by uuid, reply_to text, reply_cc text[], reply_subject text, reply_body text,
  offered_property_ids uuid[], reply_sent_at timestamptz, reply_sent_by uuid, reply_sent_via text, quote_sent_at timestamptz,
  last_contact_at timestamptz, last_follow_up_at timestamptz, follow_up_due_at timestamptz,
  partner_approved_at timestamptz, stage public.lead_stage DEFAULT 'new', updated_at timestamptz,
  outcome text, is_demo boolean DEFAULT false, created_at timestamptz DEFAULT now());
CREATE TABLE public.direct_booking_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL, requested_at timestamptz NOT NULL DEFAULT now(), reply jsonb NOT NULL,
  property_ids uuid[] NOT NULL DEFAULT '{}', escalated_at timestamptz,
  decision text, decided_by uuid, decided_at timestamptz, decided_as text, note text);
CREATE UNIQUE INDEX direct_booking_one_pending ON public.direct_booking_approvals (lead_id) WHERE decision IS NULL;
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.leads TO authenticated;
`;

const PERIOD_ON = `{"approvalStart": "2000-01-01", "approvalEnd": "2999-12-31", "requireApprovalAfterEnd": false}`;
const PERIOD_OFF = `{"approvalStart": "2000-01-01", "approvalEnd": "2000-01-02", "requireApprovalAfterEnd": false}`;

async function fresh(opts: { staged?: boolean; period?: "on" | "off" } = {}) {
  const db = new PGlite();
  await db.exec(SCHEMA);
  for (const n of ["holds_functional_role", "functional_role_holders", "direct_booking_settings", "direct_booking_approval_required", "direct_booking_notify"])
    await db.exec(fromMigration("0262_direct_bookings.sql", n));
  for (const n of ["direct_booking_active_owner_homes", "direct_booking_cc_emails"]) await db.exec(fromMigration("0283_guarded_actions.sql", n));
  for (const n of ["request_direct_booking_approval", "decide_direct_booking_approval", "record_direct_booking_reply", "record_direct_booking_follow_up"])
    await db.exec(live(n));
  await db.exec(`
    INSERT INTO public.staff VALUES ('${SUP}'), ('${DIR_OPS}'), ('${PC}'), ('${PC2}'), ('${ADMIN}');
    INSERT INTO public.profiles VALUES ('${SUP}', 'sup@arha.test', 'S'), ('${DIR_OPS}', 'dir@arha.test', 'D'), ('${PC}', 'pc@arha.test', 'P');
    INSERT INTO public.functional_roles(code, current_seat_holder) VALUES ('ops_supervisor', '${SUP}'), ('director_ops', '${DIR_OPS}');
    INSERT INTO public.properties VALUES ('${H_OK}', 'Oak Home'), ('${H_OK2}', 'Ash Home'), ('${H_PROGRAM}', 'Elm Home');
    INSERT INTO public.owner_program_properties VALUES ('${H_PROGRAM}', NULL);
    INSERT INTO public.app_settings(key, value) VALUES ('direct_booking_settings', '${opts.period === "off" ? PERIOD_OFF : PERIOD_ON}');
  `);
  if (opts.staged !== false) await db.exec(STAGED);
  return db;
}

const as = (db: PGlite, user: string | null) => db.query("SELECT set_config('test.uid', $1, false)", [user ?? ""]);
const err = async (p: Promise<unknown>) => {
  try { await p; return null; } catch (e) { return (e as Error).message; }
};
const newLead = async (db: PGlite, extra: Record<string, string> = {}) => {
  const base: Record<string, string> = { kind: "direct_booking", owned_by: PC, partner_name: "Owl Marketplace", subject: "Need a home", email: "noreply@owlmarketplace.com", ...extra };
  const cols = Object.keys(base);
  const vals = Object.values(base);
  const r = await db.query<{ id: string }>(`INSERT INTO public.leads(${cols.join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING id`, vals);
  return r.rows[0]!.id;
};
const lead = async (db: PGlite, id: string) =>
  (await db.query<Record<string, unknown>>(
    `SELECT reply_sent_at, reply_method, portal_answered_at, portal_answered_by, portal_answer_note, stage::text AS stage,
            extract(epoch FROM follow_up_due_at - reply_sent_at)::int / 3600 AS follow_hours, offered_property_ids, reply_body, quote_sent_at
       FROM public.leads WHERE id = $1`, [id])).rows[0]!;
const history = async (db: PGlite, id: string) =>
  (await db.query<{ outcome: string; note: string; actor_id: string }>("SELECT outcome, note, actor_id FROM public.lead_activity WHERE lead_id = $1 ORDER BY occurred_at", [id])).rows;
const answer = (db: PGlite, id: string, note: string, reply: object | null = null, ids: string[] | null = null) =>
  db.query("SELECT public.answer_direct_booking_in_portal($1, $2, $3::jsonb, $4::uuid[]) AS at", [id, note, reply ? JSON.stringify(reply) : null, ids]);
const askOk = (db: PGlite, id: string, ids = [H_OK]) =>
  db.query("SELECT public.request_direct_booking_approval($1, $2::jsonb, $3::uuid[])", [id, JSON.stringify({ to: "noreply@owlmarketplace.com", subject: "RE: Need a home", body: "Here is the home.", portal: true }), ids]);
const decide = (db: PGlite, id: string) => db.query("SELECT public.decide_direct_booking_approval($1, 'approved', NULL)", [id]);

describe("staged columns and the backfill", () => {
  it("adds five optional columns and marks replies sent before as email", async () => {
    const db = await fresh({ staged: false });
    const sent = await newLead(db, { reply_sent_at: "2026-11-09T15:00:00Z" });
    const open = await newLead(db);
    await db.exec(STAGED);
    const cols = (await db.query<{ column_name: string; is_nullable: string }>("SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'leads' AND column_name IN ('portal_link','reply_method','portal_answered_at','portal_answered_by','portal_answer_note')")).rows;
    expect(cols).toHaveLength(5);
    expect(cols.every((c) => c.is_nullable === "YES")).toBe(true);
    expect((await lead(db, sent)).reply_method).toBe("email");
    expect((await lead(db, open)).reply_method).toBeNull();
  });

  it("stores a link only from a listed partner host", async () => {
    const db = await fresh();
    for (const ok of [
      "https://source.owlmarketplace.com/incoming/121121",
      "https://www.reloquest.com/requests/RQ-5512",
      "https://portal.travelershaven.com/housing-requests/88213/details",
      "https://app.aleasetech.com/realto/inquiry/4410",
    ])
      expect(await err(newLead(db, { portal_link: ok }))).toBeNull();
    for (const bad of ["https://owlmarketplace.com.evil.test/incoming/1", "https://evil.test/?u=https://owlmarketplace.com", "javascript:alert(1)", "https://user@owlmarketplace.com/x"])
      expect(await err(newLead(db, { portal_link: bad }))).toMatch(/leads_portal_link_host_check/);
  });
});

describe("only Resolve writes how a request was answered", () => {
  it("a signed in user cannot set or change the portal answer, the method or the link directly", async () => {
    const db = await fresh();
    const id = await newLead(db, { portal_link: "https://source.owlmarketplace.com/incoming/1" });
    await db.exec("SET ROLE authenticated");
    expect(await err(db.query("UPDATE public.leads SET portal_answered_at = now() WHERE id = $1", [id]))).toMatch(/recorded only by Resolve/);
    expect(await err(db.query("UPDATE public.leads SET reply_method = 'portal' WHERE id = $1", [id]))).toMatch(/recorded only by Resolve/);
    expect(await err(db.query("UPDATE public.leads SET portal_link = 'https://source.owlmarketplace.com/incoming/2' WHERE id = $1", [id]))).toMatch(/recorded only by Resolve/);
    expect(await err(db.query("INSERT INTO public.leads(kind, reply_method) VALUES ('direct_booking', 'portal')"))).toMatch(/recorded only by Resolve/);
    // Intake may insert the link; other fields stay editable as before.
    expect(await err(db.query("INSERT INTO public.leads(kind, portal_link) VALUES ('direct_booking', 'https://source.owlmarketplace.com/incoming/3')"))).toBeNull();
    expect(await err(db.query("UPDATE public.leads SET partner_name = 'Owl' WHERE id = $1", [id]))).toBeNull();
    await db.exec("RESET ROLE");
  });
});

describe("I answered in the partner's portal", () => {
  it("during the approval period: refused until a supervisor approves, then stops the clock at the press time", async () => {
    const db = await fresh({ period: "on" });
    const id = await newLead(db);
    await as(db, PC);
    expect(await err(answer(db, id, "Portal quote 4471", { subject: "RE", body: "x" }, [H_OK]))).toMatch(/supervisor must OK this quote/);
    await askOk(db, id);
    expect(await err(answer(db, id, "Portal quote 4471"))).toMatch(/supervisor must OK this quote/);
    await as(db, SUP);
    await decide(db, id);
    await as(db, PC);
    const before = Date.now();
    const at = (await answer(db, id, "  Portal quote\n4471  ")).rows[0] as { at: string };
    const after = Date.now();
    const row = await lead(db, id);
    const sent = new Date(row.reply_sent_at as string).getTime();
    expect(sent).toBeGreaterThanOrEqual(before - 1000);
    expect(sent).toBeLessThanOrEqual(after + 1000);
    expect(new Date(at.at).getTime()).toBe(sent);
    expect(row.portal_answered_at).toEqual(row.reply_sent_at);
    expect(row.reply_method).toBe("portal");
    expect(row.portal_answered_by).toBe(PC);
    expect(row.portal_answer_note).toBe("Portal quote 4471");
    expect(row.stage).toBe("engaged");
    expect(row.follow_hours).toBe(48);
    expect(row.offered_property_ids).toEqual([H_OK]);
    const lines = await history(db, id);
    expect(lines.filter((l) => l.outcome === "Answered in the partner's portal")).toEqual([{ outcome: "Answered in the partner's portal", note: "Portal quote 4471", actor_id: PC }]);
    // Approved during the period: no extra Supervisor copy.
    expect((await db.query("SELECT 1 FROM public.staff_notifications WHERE kind = 'direct_booking_sent_copy'")).rows).toHaveLength(0);
  });

  it("pressed twice changes nothing and writes no second history line", async () => {
    const db = await fresh({ period: "off" });
    const id = await newLead(db);
    await as(db, PC);
    const first = (await answer(db, id, "Quote 1", { subject: "RE", body: "Body" }, [H_OK])).rows[0] as { at: string };
    const second = (await answer(db, id, "Quote 2", { subject: "RE", body: "Other" }, [H_OK2])).rows[0] as { at: string };
    expect(second.at).toEqual(first.at);
    const row = await lead(db, id);
    expect(row.portal_answer_note).toBe("Quote 1");
    expect(row.offered_property_ids).toEqual([H_OK]);
    expect((await history(db, id)).filter((l) => l.outcome === "Answered in the partner's portal")).toHaveLength(1);
  });

  it("after the approval period: available at once to the person who started it, with the Supervisor copy as for email", async () => {
    const db = await fresh({ period: "off" });
    const id = await newLead(db);
    await as(db, PC2);
    expect(await err(answer(db, id, "Quote", { subject: "RE", body: "B" }, [H_OK]))).toMatch(/Only the person who started/);
    await as(db, PC);
    expect(await err(answer(db, id, "   ", { subject: "RE", body: "B" }, [H_OK]))).toMatch(/Add a short note/);
    expect(await err(answer(db, id, "Quote", { subject: "RE", body: "B" }, []))).toMatch(/Pick at least one home/);
    expect(await err(answer(db, id, "Quote", { subject: "RE", body: "B" }, [H_PROGRAM]))).toMatch(/Active Owner/);
    await answer(db, id, "Quote", { subject: "RE: Need a home", body: "The reply" }, [H_OK, H_OK2]);
    const row = await lead(db, id);
    expect(row.reply_method).toBe("portal");
    expect(row.reply_body).toBe("The reply");
    expect(row.offered_property_ids).toEqual([H_OK, H_OK2]);
    const copies = (await db.query<{ user_id: string; title: string }>("SELECT user_id, title FROM public.staff_notifications WHERE kind = 'direct_booking_sent_copy'")).rows;
    expect(copies).toEqual([{ user_id: SUP, title: "A direct booking request was answered in the partner's portal" }]);
  });

  it("already emailed: the reply time stays, the method stays email, the portal answer is added", async () => {
    const db = await fresh({ period: "off" });
    const id = await newLead(db, { email: "partner@company.test" });
    await as(db, PC);
    await db.query("UPDATE public.leads SET offered_property_ids = $2 WHERE id = $1", [id, [H_OK]]);
    await db.query("SELECT public.record_direct_booking_reply($1, 'mailbox')", [id]);
    const emailed = await lead(db, id);
    expect(emailed.reply_method).toBe("email");
    await new Promise((r) => setTimeout(r, 20));
    await answer(db, id, "Also posted, quote 77");
    const row = await lead(db, id);
    expect(row.reply_sent_at).toEqual(emailed.reply_sent_at);
    expect(row.reply_method).toBe("email");
    expect(row.portal_answered_at).not.toBeNull();
    expect(new Date(row.portal_answered_at as string).getTime()).toBeGreaterThan(new Date(row.reply_sent_at as string).getTime());
    expect((await history(db, id)).map((l) => l.outcome)).toEqual(["Answered in the partner's portal"]);
  });

  it("a follow-up after a portal answer works as after an emailed quote", async () => {
    const db = await fresh({ period: "off" });
    const id = await newLead(db);
    await as(db, PC);
    await answer(db, id, "Quote", { subject: "RE", body: "B" }, [H_OK]);
    expect(await err(db.query("SELECT public.record_direct_booking_follow_up($1)", [id]))).toBeNull();
  });
});

describe("correcting a portal answer", () => {
  it("the coordinator cannot; the Supervisor or an Admin can, with a reason, and the clock runs again", async () => {
    const db = await fresh({ period: "off" });
    const id = await newLead(db);
    await as(db, PC);
    await answer(db, id, "Quote", { subject: "RE", body: "B" }, [H_OK]);
    expect(await err(db.query("SELECT public.correct_direct_booking_portal_answer($1, 'Wrong request')", [id]))).toMatch(/Only the Operations Supervisor or an Admin/);
    await as(db, SUP);
    expect(await err(db.query("SELECT public.correct_direct_booking_portal_answer($1, ' ')", [id]))).toMatch(/short reason/);
    await db.query("SELECT public.correct_direct_booking_portal_answer($1, 'Posted on the wrong request')", [id]);
    const row = await lead(db, id);
    expect(row.reply_sent_at).toBeNull();
    expect(row.reply_method).toBeNull();
    expect(row.portal_answered_at).toBeNull();
    expect(row.quote_sent_at).toBeNull();
    expect(row.stage).toBe("new");
    expect((await history(db, id)).map((l) => [l.outcome, l.note])).toEqual([
      ["Answered in the partner's portal", "Quote"],
      ["Portal answer corrected", "Posted on the wrong request"],
    ]);
    // An Admin can correct too.
    await as(db, PC);
    await answer(db, id, "Quote again", { subject: "RE", body: "B" }, [H_OK]);
    await as(db, ADMIN);
    expect(await err(db.query("SELECT public.correct_direct_booking_portal_answer($1, 'Admin fix')", [id]))).toBeNull();
  });

  it("not after a follow-up", async () => {
    const db = await fresh({ period: "off" });
    const id = await newLead(db);
    await as(db, PC);
    await answer(db, id, "Quote", { subject: "RE", body: "B" }, [H_OK]);
    await db.query("SELECT public.record_direct_booking_follow_up($1)", [id]);
    await as(db, SUP);
    expect(await err(db.query("SELECT public.correct_direct_booking_portal_answer($1, 'Too late')", [id]))).toMatch(/cannot be corrected/);
  });
});

describe("undo", () => {
  it("restores record_direct_booking_reply exactly as live and removes everything added", async () => {
    const db = await fresh();
    await db.exec(UNDO);
    const def = (await db.query<{ d: string }>("SELECT pg_get_functiondef('public.record_direct_booking_reply(uuid, text)'::regprocedure) AS d")).rows[0]!.d;
    const fresh0 = await fresh({ staged: false });
    const before = (await fresh0.query<{ d: string }>("SELECT pg_get_functiondef('public.record_direct_booking_reply(uuid, text)'::regprocedure) AS d")).rows[0]!.d;
    expect(def).toBe(before);
    const left = (await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'leads' AND column_name IN ('portal_link','reply_method','portal_answered_at','portal_answered_by','portal_answer_note')")).rows;
    expect(left).toHaveLength(0);
    const fns = (await db.query("SELECT proname FROM pg_proc WHERE proname IN ('answer_direct_booking_in_portal','correct_direct_booking_portal_answer','guard_lead_portal_fields')")).rows;
    expect(fns).toHaveLength(0);
  });
});
