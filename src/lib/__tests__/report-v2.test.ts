import { beforeAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import {
  EARLIER_ACTIVITY,
  FALLBACK_WORDING,
  FIXED_REPORT_SENTENCES,
  WORDING_SEED_V1,
  buildEntryLabels,
  isMissingReportObject,
  labelFor,
  wordingProblem,
} from "../report-v2";
import { loadEntryLabels, loadReportWording, recordWordingUse } from "../report-v2.server";
import { ownerEntryIds, strReportCsv, withReportV2, type StrReport } from "../str-report";

const read = (p: string) => readFileSync(p, "utf8");
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const admin = U(1), director = U(2), owner = U(3), coOwner = U(4), stranger = U(5);
const prog = U(20), otherProg = U(21), review = U(30), libCard = U(40), planCard = U(41), report = U(50);
const eOwner = U(60), eCo = U(61), eMapped = U(62), eOther = U(63), eRemoved = U(64);

const STUBS = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true),'')::uuid $$;
CREATE TABLE public.roles(id uuid, r text);
CREATE FUNCTION public.has_role(uuid, text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.roles WHERE id=$1 AND r=$2) $$;
CREATE FUNCTION public.is_director(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.roles WHERE id=$1 AND r='director') $$;
CREATE FUNCTION public.is_onboarding_director(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE TABLE private.members(program_id uuid, user_id uuid, removed_at timestamptz);
CREATE FUNCTION private.owner_program_readable(_actor uuid, _program uuid, _preview boolean DEFAULT false) RETURNS boolean LANGUAGE sql STABLE AS
 $$ SELECT EXISTS(SELECT 1 FROM private.members WHERE program_id=_program AND user_id=_actor AND removed_at IS NULL) $$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY, first_name text, full_name text);
CREATE TABLE public.owner_programs(id uuid PRIMARY KEY);
CREATE TABLE public.owner_reviews(id uuid PRIMARY KEY, program_id uuid, title text, template_id uuid);
CREATE TABLE public.ao_library_cards(id uuid PRIMARY KEY, code text UNIQUE, title text);
CREATE TABLE public.ao_home_plan_cards(id uuid PRIMARY KEY, card_id uuid, owner_review_id uuid);
CREATE TABLE public.owner_time_entries(id uuid PRIMARY KEY, program_id uuid, owner_user_id uuid, review_id uuid, entry_date date, minutes numeric, activity text, review_status text);
CREATE TABLE public.str_participation_reports(id uuid PRIMARY KEY, program_id uuid);
CREATE TABLE public.audit_log(id uuid DEFAULT gen_random_uuid(), actor_id uuid, action text, entity_type text, entity_id uuid, entity_label text, before_value jsonb, after_value jsonb, reason text, created_at timestamptz DEFAULT now());
`;

let db: PGlite;
const as = (uid: string | null) => db.query(`SELECT set_config('test.uid', $1, false)`, [uid ?? ""]);
const one = async <T>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0]!;
const hourPrint = async () =>
  (await one<{ h: string }>(`SELECT md5(string_agg(t::text,'|' ORDER BY id)) h FROM public.owner_time_entries t`)).h;
const anonDefiners = async () =>
  (await one<{ s: string }>(`SELECT coalesce(string_agg(p.oid::regprocedure::text, ',' ORDER BY 1),'') s FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prosecdef AND n.nspname IN ('public','private')
    AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR p.proacl IS NULL)`)).s;

const fail = async (fn: () => Promise<unknown>) => {
  try { await fn(); } catch (e) { return (e as Error).message; }
  return "";
};

describe("report v2, isolated PostgreSQL", () => {
  let hoursBefore = "", anonBefore = "";
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(STUBS);
    await db.exec(`
      INSERT INTO public.roles VALUES ('${admin}','admin'),('${director}','director');
      INSERT INTO public.owner_programs VALUES ('${prog}'),('${otherProg}');
      INSERT INTO private.members VALUES ('${prog}','${owner}',null),('${prog}','${coOwner}',null),('${prog}','${stranger}',now());
      INSERT INTO public.profiles VALUES ('${owner}','Ryan','Ryan Lee'),('${coOwner}','Rachel','Rachel Lee'),('${stranger}','Sam','Sam Gone');
      INSERT INTO public.ao_library_cards VALUES ('${libCard}','P01','Set up utility accounts for your home'),(gen_random_uuid(),'A12','Review HOA rules');
      INSERT INTO public.owner_reviews VALUES ('${review}','${prog}','Set up utility accounts for your home',null);
      INSERT INTO public.ao_home_plan_cards VALUES ('${planCard}','${libCard}','${review}');
      INSERT INTO public.owner_time_entries VALUES
        ('${eOwner}','${prog}','${owner}','${review}','2026-10-01',90,'Utilities','approved'),
        ('${eCo}','${prog}','${coOwner}',null,'2026-10-02',30,'Something earlier','pending'),
        ('${eMapped}','${prog}','${coOwner}',null,'2026-10-03',45,'Review HOA rules and documents','approved'),
        ('${eRemoved}','${prog}','${stranger}',null,'2026-09-03',60,'Old work','approved'),
        ('${eOther}','${otherProg}','${stranger}',null,'2026-10-04',15,'Other program','approved');
      INSERT INTO public.str_participation_reports VALUES ('${report}','${prog}');`);
    hoursBefore = await hourPrint();
    anonBefore = await anonDefiners();
    await db.exec(read("docs/pending/report-v2/01_report_v2.sql"));
    await db.exec(read("docs/pending/report-v2/02_wording_seed.data.sql"));
    // Emily-approved map row (the staged map proposes none; this proves the mapped path).
    await db.exec(`INSERT INTO public.report_legacy_card_map(match_kind, match_value, card_code) VALUES ('exact_title','Review HOA rules and documents','A12')`);
  });

  it("current wording read returns version 1 to report builders", async () => {
    await as(owner);
    const r = await one<{ w: { version: number; sentences: string[] } }>("SELECT public.report_wording_current() w");
    expect(r.w.version).toBe(1);
  });

  it("seeds version 1 with the six approved sentences", async () => {
    const r = await one<{ version: number; sentences: string[] }>("SELECT version, sentences FROM public.report_wording_versions");
    expect(r.version).toBe(1);
    expect(r.sentences).toEqual([...WORDING_SEED_V1]);
  });

  it("labels engine-linked, mapped and unmatched entries, with who logged each", async () => {
    await as(owner);
    const rows = (await db.query<{ entry_id: string; logged_by: string; card_code: string | null; card_title: string | null; label_source: string }>(
      `SELECT * FROM public.report_entry_labels($1::uuid[]) ORDER BY entry_id`, [`{${eOwner},${eCo},${eMapped},${eRemoved}}`])).rows;
    const by = Object.fromEntries(rows.map((r) => [r.entry_id, r]));
    expect(by[eOwner]).toMatchObject({ logged_by: "Ryan Lee", card_code: "P01", label_source: "engine" });
    expect(by[eMapped]).toMatchObject({ logged_by: "Rachel Lee", card_code: "A12", label_source: "legacy_map" });
    expect(by[eCo]).toMatchObject({ logged_by: "Rachel Lee", card_code: null, label_source: "none" });
    expect(by[eRemoved]).toMatchObject({ logged_by: "Sam Gone" });
    const labels = buildEntryLabels(rows);
    expect(labelFor(labels, eCo, "x").card).toBe(EARLIER_ACTIVITY);
    expect(labelFor(labels, eOwner, "x").card).toBe("P01 Set up utility accounts for your home");
  });

  it("never labels entries from a program the caller cannot read; signed-out is refused", async () => {
    await as(owner);
    const r = await db.query(`SELECT * FROM public.report_entry_labels($1::uuid[])`, [`{${eOther}}`]);
    expect(r.rows.length).toBe(0);
    await as(null);
    expect(await fail(() => db.query(`SELECT * FROM public.report_entry_labels($1::uuid[])`, [`{${eOwner}}`]))).toContain("Sign in");
  });

  it("only an Admin can save a new wording version; bad wording is refused", async () => {
    const six = JSON.stringify([...WORDING_SEED_V1]);
    for (const uid of [director, owner, null]) {
      await as(uid);
      expect(await fail(() => db.query(`SELECT public.report_wording_save($1::jsonb,'x')`, [six]))).toContain("Only an Admin");
    }
    await as(admin);
    const bad = JSON.stringify([...WORDING_SEED_V1.slice(0, 5), "A great investment."]);
    expect(await fail(() => db.query(`SELECT public.report_wording_save($1::jsonb,'x')`, [bad]))).toContain("cannot use");
    const v = await one<{ v: number }>(`SELECT public.report_wording_save($1::jsonb,'Test edit') v`, [six]);
    expect(v.v).toBe(2);
    expect((await one<{ n: number }>(`SELECT count(*)::int n FROM public.audit_log WHERE action='report_wording_saved'`)).n).toBe(1);
  });

  it("stores which wording version each report used, for members and staff only", async () => {
    await as(coOwner);
    await db.query(`SELECT public.record_report_wording_use($1,'owner_participation',null,'pdf',1)`, [prog]);
    await db.query(`SELECT public.record_report_wording_use(null,'str_report',$1,'csv',1)`, [report]);
    await as(stranger);
    expect(await fail(() => db.query(`SELECT public.record_report_wording_use($1,'owner_participation',null,'pdf',1)`, [prog]))).toContain("not available");
    const rows = (await db.query<{ program_id: string; wording_version: number }>(`SELECT program_id, wording_version FROM public.report_wording_uses`)).rows;
    expect(rows).toEqual([{ program_id: prog, wording_version: 1 }, { program_id: prog, wording_version: 1 }]);
  });

  it("hour records unchanged and no new anon or PUBLIC executable definer function", async () => {
    expect(await hourPrint()).toBe(hoursBefore);
    expect(await anonDefiners()).toBe(anonBefore);
  });

  it("undo removes exactly what 01 and 02 added", async () => {
    await db.exec(`DELETE FROM public.report_wording_uses; DELETE FROM public.report_wording_versions WHERE version > 1;`);
    await db.exec(read("docs/pending/report-v2/undo/02_wording_seed.data.sql"));
    await db.exec(read("docs/pending/report-v2/undo/01_report_v2.sql"));
    const left = await one<{ n: number }>(`SELECT count(*)::int n FROM pg_class WHERE relname LIKE 'report_%'`);
    const fns = await one<{ n: number }>(`SELECT count(*)::int n FROM pg_proc WHERE proname IN ('report_entry_labels','record_report_wording_use','report_wording_save','report_wording_current')`);
    expect(left.n + fns.n).toBe(0);
    expect(await hourPrint()).toBe(hoursBefore);
  });
});

describe("report v2 app rules", () => {
  it("seed keeps five sentences unchanged and removes long dashes from sentence 4", () => {
    expect(WORDING_SEED_V1.filter((s, i) => s === FIXED_REPORT_SENTENCES[i]).length).toBe(5);
    expect(wordingProblem(WORDING_SEED_V1)).toBeNull();
    // Emily, Nov 10: the first approved sentence 4 now uses commas, so it passes the no long dash rule too.
    expect(FIXED_REPORT_SENTENCES[3]).toContain("dated that year, tagged to any home, General, or before a closing, counted once.");
    expect(FIXED_REPORT_SENTENCES.some((s) => s.includes("\u2014"))).toBe(false);
    expect(wordingProblem(FIXED_REPORT_SENTENCES)).toBeNull();
  });

  const missing = { code: "PGRST202", message: "Could not find the function public.report_entry_labels" };
  const fakeSb = (err: unknown) => ({
    rpc: async (fn: string) => ({ data: null, error: err === missing ? { code: "PGRST202", message: `Could not find the function public.${fn}` } : err }),
  });

  it("reports keep working before the database change", async () => {
    expect(await loadReportWording(fakeSb(missing))).toEqual(FALLBACK_WORDING);
    expect((await loadEntryLabels(fakeSb(missing), ["a"])).size).toBe(0);
    expect(await recordWordingUse(fakeSb(missing), { programId: null, kind: "str_report", ref: null, format: "pdf", wording: FALLBACK_WORDING })).toEqual({ recorded: false });
  });

  it("other errors are not hidden as 'not set up'", async () => {
    expect(isMissingReportObject({ code: "42883", message: "function private.helper does not exist" }, "report_entry_labels")).toBe(false);
    await expect(loadEntryLabels(fakeSb({ code: "42501", message: "denied" }), ["a"])).rejects.toThrow("denied");
  });

  it("staff report: Logged by and card on owner rows, totals and minutes unchanged", () => {
    const r: StrReport = {
      property: { name: "1399 Foxtail Ln", address: null }, owner: { name: "Ryan Lee" },
      program: { startedOn: "2026-01-01", endsOn: "2026-12-31", status: "active" }, period: { from: "2026-01-01", to: "2026-12-31" },
      include: { owner: true, nonOwner: true },
      rows: [
        { date: "2026-10-01", person: "Ryan Lee", personKind: "owner", workType: "Program-Level / Shared Participation", description: "x", source: "Resolve", reference: "r", timeClass: "recorded", minutes: 30, status: "final", correction: false, internal: { kind: "owner_time_entry", id: "e1" } },
        { date: "2026-10-02", person: "Clean Co", personKind: "company", workType: "Cleaning", description: "y", source: "B", reference: "q", timeClass: "attributed", minutes: 60, status: "final", correction: false },
      ],
      summary: [], totals: { ownerMinutes: 30, ownerEntries: 1, nonOwnerSupportedMinutes: 60, underReview: 0 }, disclaimer: "D",
    };
    expect(ownerEntryIds(r)).toEqual(["e1"]);
    const out = withReportV2(r, buildEntryLabels([{ entry_id: "e1", logged_by: "Rachel Lee", card_code: null, card_title: null }]), { version: 1, sentences: WORDING_SEED_V1 });
    expect(out.rows[0]).toMatchObject({ loggedBy: "Rachel Lee", card: EARLIER_ACTIVITY, minutes: 30 });
    expect(out.rows[1]!.loggedBy === undefined).toBe(true);
    expect(out.totals).toEqual(r.totals);
    const csv = strReportCsv(out);
    expect(csv).toContain("logged_by,library_card");
    expect(csv).toContain('"Rachel Lee","Earlier activity"');
    expect(csv).toContain("# Report wording,Wording version 1");
  });
});
