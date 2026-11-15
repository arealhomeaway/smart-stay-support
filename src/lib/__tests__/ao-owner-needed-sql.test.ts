// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
// Practice run of docs/pending/ao-owner-needed (and its undo) on an isolated PostgreSQL copy built from the
// live table shapes and the engine steps captured live on Nov 15. Nothing here touches the real database.
import { beforeEach, afterEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const DIR = "docs/pending/ao-owner-needed";
const read = (p: string) => readFileSync(p, "utf8");
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ADMIN = "98bd6696-4018-4965-b645-0471c5ae3925";
const owner = U(4), pm = U(6), or1 = U(7), prog = U(21);
const FOXTAIL = "bacd3693-5a52-4ec0-a560-1281aadac37e";
const W104 = "9de75678-9e34-4219-a186-ed0da15f0092";
const FITZ = "79319968-80c9-4f00-b6c9-608c0b1881dc";
const BUCK = "61d75516-d1ea-43b4-a8f9-f2476393c516"; // switched on, not named for A33/N10
const ONB = U(15); // a home still in onboarding
const stepA = U(31), stepB = U(32);
const NEEDED = ["A22", "A24", "A40", "P01", "P02", "A03", "A25", "A26", "A27", "A28", "A30", "A39", "A58", "P03", "P04"];

const STUBS = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private;
CREATE TYPE public.app_role AS ENUM ('admin','manager','tech','vendor','owner','onboarding');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true),'')::uuid $$;
CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
CREATE FUNCTION public.is_internal_staff(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $1 IN ('${ADMIN}'::uuid, '${pm}'::uuid) $$;
CREATE FUNCTION public.has_role(uuid, public.app_role) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $1 = '${ADMIN}'::uuid $$;
CREATE FUNCTION public.is_onboarding_director(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION public.is_director(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION private.actor_label(uuid) RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'Admin'::text $$;
CREATE FUNCTION private.owner_current_property_for_actor(uuid, uuid, uuid DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $1 = '${owner}'::uuid $$;
CREATE FUNCTION private.is_program_member(uuid, uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $2 = '${owner}'::uuid $$;
`;
const AFTER_SCHEMA = `
CREATE TABLE public.tickets(id uuid PRIMARY KEY, property_id uuid, is_demo boolean DEFAULT false);
CREATE TABLE public.owner_time_entries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), review_id uuid, program_id uuid);
CREATE TABLE public.ao_owner_email_days(owner_key uuid, day date, kind text, notification_id uuid, PRIMARY KEY (owner_key, day, kind));
-- the lifecycle guard trusts the owner of this function; in the copy that is the test user, as postgres is live
CREATE FUNCTION public.change_owner_program(uuid,uuid,text,uuid,date,jsonb,text,text,text) RETURNS void LANGUAGE sql AS $$ SELECT $$;
`;
const DEPS = ["owner_program_live", "ao_central", "ao_add_business_days", "ao_home_stage", "ao_title_key", "ao_live_card_match",
  "ao_card_coverage", "ao_guard_owner_item", "ao_home_program", "notify_owner_of_review",
  "guard_owner_lifecycle_writes", "ao_owner_email_now"];
const ENGINE = ["ao_unlock", "ao_process_clocks", "ao_ops_card_rule", "ao_plan_outcomes", "ao_on_handoff"];
const AFTER_ENGINE = ["ao_add_plan_card", "ao_start_home_plan", "ao_task_completed", "ao_unlock_now"];
const TRIGGERS = `
CREATE TRIGGER ao_guard_owner_item BEFORE INSERT ON public.owner_reviews FOR EACH ROW EXECUTE FUNCTION private.ao_guard_owner_item();
CREATE TRIGGER owner_opportunity_write_boundary BEFORE INSERT OR DELETE OR UPDATE ON public.owner_reviews FOR EACH ROW EXECUTE FUNCTION private.guard_owner_lifecycle_writes();
CREATE TRIGGER owner_reviews_notify_owner AFTER INSERT OR UPDATE ON public.owner_reviews FOR EACH ROW WHEN ((NOT new.auto_ticket)) EXECUTE FUNCTION notify_owner_of_review();
CREATE TRIGGER ao_unlock_on_task_complete AFTER UPDATE OF status ON public.onboarding_tasks FOR EACH ROW EXECUTE FUNCTION private.ao_task_completed();
`;

let db: PGlite;
const one = async (sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows[0];
const n = async (sql: string, p: unknown[] = []) => Number((await one(sql, p)).n);
const as = (uid: string) => db.query("SELECT set_config('test.uid', $1, false)", [uid]);
const card = (code: string, o: { stage?: string; lock?: string; links?: string[]; lane?: string; days?: number | null } = {}) =>
  db.query(`INSERT INTO public.ao_library_cards(code, title, lane, stage_window, status, lock_rule, linked_template_task_ids, deadline_business_days, why_text, opens_text)
    VALUES ($1, 'Card ' || $1, $2, $3, 'released', $4, $5::uuid[], $6, 'Why ' || $1, 'finish the step')`,
    [code, o.lane ?? "critical", o.stage ?? "onboarding_early", o.lock ?? "none", `{${o.links?.join(",") ?? ""}}`, o.days === undefined ? 3 : o.days]);
const pcOf = (home: string, code: string) => one(`SELECT pc.*, o.status review_status, o.respond_by, o.available_from FROM public.ao_home_plan_cards pc
  JOIN public.ao_library_cards c ON c.id = pc.card_id LEFT JOIN public.owner_reviews o ON o.id = pc.owner_review_id
  WHERE pc.property_id = $1 AND c.code = $2`, [home, code]);
const dates = (r) => [r.deadline_at, r.reminder_at, r.cutoff_at, r.respond_by];
const fnHash = async () => (await one(`SELECT string_agg(proname || md5(prosrc), ',' ORDER BY proname) h FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
  WHERE s.nspname IN ('public','private') AND proname = ANY ($1)`, [ENGINE])).h;
const dataHash = async () => (await one(`SELECT md5(
  coalesce((SELECT string_agg((to_jsonb(t) - 'updated_at')::text, '|' ORDER BY id) FROM public.ao_home_plan_cards t), '') ||
  coalesce((SELECT string_agg((to_jsonb(t) - 'updated_at')::text, '|' ORDER BY id) FROM public.owner_reviews t), '') ||
  coalesce((SELECT string_agg((to_jsonb(t) - 'updated_at')::text, '|' ORDER BY code) FROM public.ao_library_cards t), '')) h`)).h;

async function build() {
  db = new PGlite();
  await db.exec(STUBS);
  await db.exec(read("src/lib/__tests__/fixtures/active-owner-fix-schema.sql"));
  await db.exec(AFTER_SCHEMA);
  await db.exec(`ALTER TABLE public.ao_library_cards ADD COLUMN IF NOT EXISTS once_per_owner boolean NOT NULL DEFAULT false;`);
  for (const f of DEPS) await db.exec(read(`${DIR}/live-capture/deps/${f}.sql`) + ";");
  for (const f of ENGINE) await db.exec(read(`${DIR}/live-capture/${f}.sql`) + ";");
  for (const f of AFTER_ENGINE) await db.exec(read(`${DIR}/live-capture/deps/${f}.sql`) + ";");
  await db.exec(TRIGGERS);
  await db.exec(`
    INSERT INTO public.property_owners(id, active, source_owner_id) VALUES ('${or1}', true, 'o1');
    INSERT INTO public.properties(id, name, owner_record_id) VALUES ('${FOXTAIL}','1399 Foxtail Ln.','${or1}'),
      ('${W104}','3915 W 104th St. S.','${or1}'),('${FITZ}','9211 Fitzgerald Dr.','${or1}'),('${BUCK}','1464 Buckland Ct.','${or1}'),
      ('${ONB}','5 Onboarding St','${or1}');
    INSERT INTO public.owner_programs(id, property_id, owner_user_id, status, owner_record_id, notify_email) VALUES
      ('${prog}','${FOXTAIL}','${owner}','active','${or1}', true);
    INSERT INTO public.owner_program_properties(program_id, property_id) VALUES
      ('${prog}','${FOXTAIL}'),('${prog}','${W104}'),('${prog}','${FITZ}'),('${prog}','${BUCK}'),('${prog}','${ONB}');
    INSERT INTO public.onboarding_projects(property_id, handoff_state) VALUES
      ('${FOXTAIL}','accepted'),('${W104}','accepted'),('${FITZ}','accepted'),('${BUCK}','in_progress'),('${ONB}','in_progress');`);
  // Owner-needed cards (the 15 codes) and others, including the shapes that matter for the lock rule.
  await card("A22"); await card("A24"); await card("A40");
  await card("A25", { lock: "until_linked_step_done", links: [stepA] });
  await card("P01", { links: [stepB] });
  for (const c of NEEDED.filter((x) => !["A22", "A24", "A40", "A25", "P01"].includes(x))) await card(c, { lock: "until_linked_step_done" });
  await card("P07", { stage: "onboarding_launch" });
  await card("N01", { stage: "anytime", lane: "flexible", days: 5 });
  await card("N02", { stage: "anytime", lane: "flexible", lock: "until_linked_step_done", days: 5 });
  await card("A52", { stage: "anytime", lane: "triggered", lock: "until_linked_step_done", days: 3 });
  for (const c of ["A33", "N10", "A14", "A35", "A51"]) await card(c, { stage: "operations", lane: "triggered", lock: "until_linked_step_done", days: c === "N10" ? 7 : null });
  await db.query(`INSERT INTO public.onboarding_tasks(id, property_id, title, template_task_id, status, assigned_to) VALUES
    ($1,$2,'Step A',$3,'open',$4)`, [U(101), ONB, stepA, pm]);
}

/** The homes as they were switched on live (before the change): plans started, A33 and N10 open on the three. */
async function switchOnLiveHomes() {
  await as(ADMIN);
  for (const h of [FOXTAIL, W104, FITZ, BUCK, ONB]) await db.query("SELECT private.ao_start_home_plan($1, $2)", [h, ADMIN]);
}

beforeEach(build);
afterEach(async () => db?.close());

describe("ao-owner-needed practice run", () => {
  it("before: every opened card gets a deadline, a live home opens A33, N10 and a no-step team-work card", async () => {
    await switchOnLiveHomes();
    expect(dates(await pcOf(FOXTAIL, "N01"))[0]).not.toBeNull();
    expect((await pcOf(FOXTAIL, "A33")).join_outcome).toBe("open");
    expect((await pcOf(FOXTAIL, "N10")).join_outcome).toBe("open");
    expect((await pcOf(FOXTAIL, "A52")).join_outcome).toBe("open");
    expect((await pcOf(FOXTAIL, "N10")).deadline_at).not.toBeNull();
  });

  it("preflight passes on the captured version, apply refuses a second time", async () => {
    await db.exec(read(`${DIR}/apply.sql`));
    await expect(db.exec(read(`${DIR}/apply.sql`))).rejects.toThrow(/Changed since Nov 15/);
  });

  it("item 1: owner_needed is true for exactly the 15 codes, false for every other card", async () => {
    await db.exec(read(`${DIR}/apply.sql`));
    const rows = (await db.query("SELECT code FROM public.ao_library_cards WHERE owner_needed ORDER BY code")).rows.map((r) => r.code);
    expect(rows).toEqual([...NEEDED].sort());
    expect(await n("SELECT count(*) n FROM public.ao_library_cards WHERE NOT owner_needed")).toBe(9);
    await db.query("INSERT INTO public.ao_library_cards(code, title, lane, stage_window) VALUES ('Z99','New','flexible','anytime')");
    expect((await one("SELECT owner_needed FROM public.ao_library_cards WHERE code='Z99'")).owner_needed).toBe(false);
  });

  it("item 2: plan start gives dates only to owner-needed cards; other open cards have all four empty", async () => {
    await db.exec(read(`${DIR}/apply.sql`));
    await switchOnLiveHomes();
    const a22 = await pcOf(BUCK, "A22");
    expect(a22.join_outcome).toBe("open");
    expect(a22.deadline_at).not.toBeNull(); expect(a22.respond_by).not.toBeNull();
    const a24 = await pcOf(BUCK, "A24");
    expect(dates(a24).every((d) => d !== null)).toBe(true); // critical, next-business-day cutoff: all four set
    for (const code of ["P07", "N01"]) {
      const r = await pcOf(BUCK, code);
      expect(r.join_outcome).toBe("open");
      expect(dates(r)).toEqual([null, null, null, null]);
    }
  });

  it("item 2: Unlock now and Task done give dates only to owner-needed cards", async () => {
    await db.exec(read(`${DIR}/apply.sql`));
    await switchOnLiveHomes();
    // Unlock now on a locked owner-needed card and on a locked other card (staff action)
    await as(ADMIN);
    const p03 = await pcOf(BUCK, "P03");
    const a52 = await pcOf(BUCK, "A52");
    expect(p03.join_outcome).toBe("locked"); expect(a52.join_outcome).toBe("locked");
    // the live owner-item guard refuses the recommendation rewrite on a locked card; see the README finding
    await db.exec("ALTER TABLE public.owner_reviews DISABLE TRIGGER owner_opportunity_write_boundary");
    await db.query("SELECT public.ao_unlock_now($1)", [p03.id]);
    await db.query("SELECT public.ao_unlock_now($1)", [a52.id]);
    expect(dates(await pcOf(BUCK, "P03")).every((d) => d !== null)).toBe(true);
    const a52After = await pcOf(BUCK, "A52");
    expect(a52After.unlocked_at).not.toBeNull();
    expect(dates(a52After)).toEqual([null, null, null, null]);
    // Task done on the onboarding home opens the linked owner-needed card with its dates
    await db.query("UPDATE public.onboarding_tasks SET status='complete', completed_by=$2 WHERE id=$1", [U(101), pm]);
    const a25 = await pcOf(ONB, "A25");
    expect(a25.unlocked_at).not.toBeNull();
    expect(a25.deadline_at).not.toBeNull();
  });

  it("finding: the live owner-item guard refuses opening a locked card (Task done and Unlock now fail)", async () => {
    await db.exec(read(`${DIR}/apply.sql`));
    await switchOnLiveHomes();
    await as(ADMIN);
    await expect(db.query("SELECT public.ao_unlock_now($1)", [(await pcOf(BUCK, "P03")).id])).rejects.toThrow(/immutable/);
    await expect(db.query("UPDATE public.onboarding_tasks SET status='complete', completed_by=$2 WHERE id=$1", [U(101), pm])).rejects.toThrow(/immutable/);
  });

  it("finding: the live owner-item guard refuses the ARHA takeover, so the whole clock run fails", async () => {
    await db.exec(read(`${DIR}/apply.sql`));
    await switchOnLiveHomes();
    const far = (await one("SELECT max(cutoff_at) + interval '1 day' t FROM public.ao_home_plan_cards")).t;
    await expect(db.query("SELECT public.ao_process_clocks($1::timestamptz)", [far])).rejects.toThrow(/immutable/);
  });

  it("item 2: the five-minute clock never reminds or expires a card with no deadline", async () => {
    await db.exec(read(`${DIR}/apply.sql`));
    await switchOnLiveHomes();
    // a card with a cutoff but no deadline (bad data) is still left alone
    await db.query("UPDATE public.ao_home_plan_cards pc SET cutoff_at = now() - interval '1 day', reminder_at = now() - interval '2 days' FROM public.ao_library_cards c WHERE c.id = pc.card_id AND c.code = 'P07' AND pc.property_id = $1", [BUCK]);
    // the live owner-item guard refuses the ARHA takeover wording; see the README finding
    await db.exec("ALTER TABLE public.owner_reviews DISABLE TRIGGER owner_opportunity_write_boundary");
    const before = await n("SELECT count(*) n FROM public.owner_notifications");
    const far = (await one("SELECT max(cutoff_at) + interval '1 day' t FROM public.ao_home_plan_cards")).t;
    await db.query("SELECT public.ao_process_clocks($1::timestamptz)", [far]);
    const p07 = await pcOf(BUCK, "P07");
    expect(p07.expired_at).toBeNull(); expect(p07.reminder_sent_at).toBeNull();
    expect((await pcOf(BUCK, "N01")).expired_at).toBeNull();
    // owner-needed cards with a deadline still run their clock
    expect((await pcOf(BUCK, "A24")).expired_at).not.toBeNull();
    expect(await n("SELECT count(*) n FROM public.owner_notifications")).toBe(before);
  });

  it("item 3: team-work cards stay locked on live and onboarding homes; A33 and N10 locked; A14, A35, A51 not added", async () => {
    await db.exec(read(`${DIR}/apply.sql`));
    await switchOnLiveHomes();
    for (const code of ["A52", "N02", "A33", "N10"]) {
      const r = await pcOf(W104, code);
      expect([code, r.join_outcome, r.unlocked_at]).toEqual([code, "locked", null]);
    }
    for (const code of ["A14", "A35", "A51"]) expect(await pcOf(W104, code)).toBeUndefined();
    expect((await pcOf(ONB, "A25")).join_outcome).toBe("locked");
    expect((await pcOf(ONB, "A33")).join_outcome).toBe("locked");
  });

  it("item 3: handoff opens nothing; A33 and N10 stay locked, a missing one is added locked", async () => {
    await db.exec(read(`${DIR}/apply.sql`));
    await switchOnLiveHomes();
    await db.query("DELETE FROM public.ao_home_plan_cards pc USING public.ao_library_cards c WHERE c.id = pc.card_id AND c.code = 'N10' AND pc.property_id = $1", [ONB]);
    await db.query("UPDATE public.onboarding_projects SET handoff_state='accepted' WHERE property_id=$1", [ONB]);
    const r = (await one("SELECT private.ao_on_handoff($1, $2) r", [ONB, ADMIN])).r;
    expect(r.opened + r.added).toBe(0);
    expect((await pcOf(ONB, "A33")).join_outcome).toBe("locked");
    expect((await pcOf(ONB, "N10")).join_outcome).toBe("locked");
    // A14 was already on this home's plan, locked, from plan start; it keeps waiting as today
    expect([(await pcOf(ONB, "A14")).join_outcome, (await pcOf(ONB, "A14")).unlocked_at]).toEqual(["locked", null]);
  });

  it("item 4: clears dates on open non-owner-needed cards, relocks A33 and N10 on the three homes, no notice; undo is exact", async () => {
    await switchOnLiveHomes();
    // an owner who already answered keeps the dates; an owner-needed card keeps its dates
    await db.query("UPDATE public.ao_home_plan_cards pc SET owner_completed_at = now() FROM public.ao_library_cards c WHERE c.id = pc.card_id AND c.code = 'N01' AND pc.property_id = $1", [FITZ]);
    const fn0 = await fnHash(); const data0 = await dataHash();
    const notes0 = await n("SELECT count(*) n FROM public.owner_notifications");
    const staff0 = await n("SELECT count(*) n FROM public.staff_notifications");
    await db.exec(read(`${DIR}/apply.sql`));
    for (const h of [FOXTAIL, W104, FITZ]) {
      for (const code of ["A33", "N10"]) {
        const r = await pcOf(h, code);
        expect([r.join_outcome, r.unlocked_at, r.unlocked_by, r.review_status, r.available_from]).toEqual(["locked", null, null, "prepared", null]);
        expect(dates(r)).toEqual([null, null, null, null]);
      }
    }
    expect(dates(await pcOf(FOXTAIL, "N01"))).toEqual([null, null, null, null]);
    expect((await pcOf(FITZ, "N01")).deadline_at).not.toBeNull();
    expect((await pcOf(BUCK, "A22")).deadline_at).not.toBeNull();
    expect(await n("SELECT count(*) n FROM public.owner_notifications")).toBe(notes0);
    expect(await n("SELECT count(*) n FROM public.staff_notifications")).toBe(staff0);
    const audit = await one("SELECT * FROM public.audit_log WHERE action='ao_owner_needed_applied'");
    expect(audit.actor_id).toBe(ADMIN);
    expect(audit.after_value.cards_relocked).toBe(6);
    expect(audit.after_value.per_home["1399 Foxtail Ln."].cards_relocked).toBe(2);
    expect(audit.after_value.per_home["1464 Buckland Ct."].cards_relocked).toBe(0);
    expect(await n("SELECT count(*) n FROM public.audit_log WHERE action='ao_owner_needed_applied'")).toBe(1);
    await db.exec(read(`${DIR}/apply.undo.sql`));
    expect(await fnHash()).toBe(fn0);
    expect(await dataHash()).toBe(data0);
    expect(await n("SELECT count(*) n FROM public.owner_notifications")).toBe(notes0);
    expect(await n("SELECT count(*) n FROM information_schema.columns WHERE table_name='ao_library_cards' AND column_name='owner_needed'")).toBe(0);
  });
});
