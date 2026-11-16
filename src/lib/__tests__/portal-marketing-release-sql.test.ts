// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
// Practice copy of docs/pending/portal-marketing-release/apply.sql (Admin, Nov 16, allowed change B). Nothing here touches the real database.
import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const DIR = "docs/pending/portal-marketing-release";
const APPLY = readFileSync(`${DIR}/apply.sql`, "utf8");
const UNDO = readFileSync(`${DIR}/apply.undo.sql`, "utf8");
const UNLOCK = readFileSync(`${DIR}/live-capture/ao_unlock.sql`, "utf8").trim() + ";";
const OPS = readFileSync(`${DIR}/live-capture/ao_ops_card_rule.sql`, "utf8").trim() + ";";
const FOXTAIL = "bacd3693-5a52-4ec0-a560-1281aadac37e";
const W104 = "9de75678-9e34-4219-a186-ed0da15f0092";
const FITZ = "79319968-80c9-4f00-b6c9-608c0b1881dc";
const OTHER = "61d75516-d1ea-43b4-a8f9-f2476393c516";
const EIGHT = ["P07", "P08", "P12", "P13", "P14", "P15", "P19", "P20"];

const SCHEMA = `
CREATE SCHEMA private;
CREATE TABLE public.ao_library_cards(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text, title text, version int DEFAULT 1,
  stage_window text, status text DEFAULT 'released', lock_rule text DEFAULT 'none', linked_template_task_ids uuid[] DEFAULT '{}',
  lane text DEFAULT 'launch', cutoff_rule text DEFAULT 'next_business_day_9am', cutoff_business_days int DEFAULT 1, owner_needed boolean DEFAULT false,
  deadline_business_days int DEFAULT 5, deadline_calendar_days int, why_text text DEFAULT 'Why', opens_text text DEFAULT '');
CREATE TABLE public.properties(id uuid PRIMARY KEY, name text, is_demo boolean DEFAULT false);
CREATE TABLE public.owner_programs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), is_demo boolean DEFAULT false);
CREATE TABLE public.owner_reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), program_id uuid, property_id uuid, phase text, stage text, title text,
  recommendation text, status text, source_type text, owner_action_type text, onboarding_task_id uuid, is_demo boolean, created_by uuid, task_type text,
  available_from timestamptz, respond_by date, responded_at timestamptz, updated_at timestamptz, archived_at timestamptz);
CREATE TABLE public.ao_home_plan_cards(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, program_id uuid, card_id uuid, card_version int,
  join_outcome text, owner_review_id uuid, linked_task_id uuid, unlocked_at timestamptz, unlocked_by uuid, deadline_at timestamptz, reminder_at timestamptz,
  cutoff_at timestamptz, expired_at timestamptz, owner_completed_at timestamptz, covered_reason text, covered_source text, covered_item_id uuid);
CREATE TABLE public.onboarding_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, template_task_id uuid, status text, archived_at timestamptz, created_at timestamptz DEFAULT now());
CREATE TABLE public.ao_home_plan_settings(property_id uuid PRIMARY KEY, automated boolean);
CREATE TABLE public.audit_log(actor_id uuid, actor_label text, action text, entity_type text, entity_label text, reason text, before_value jsonb, after_value jsonb);
CREATE TABLE public.notices(id serial);
CREATE ROLE anon; CREATE ROLE authenticated;
CREATE FUNCTION private.ao_home_stage(uuid) RETURNS text LANGUAGE sql AS $$ SELECT 'operations' $$;
CREATE FUNCTION private.ao_card_coverage(uuid, text, uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT NULL::jsonb $$;
CREATE FUNCTION private.ao_add_business_days(d date, n int) RETURNS date LANGUAGE sql AS $$ SELECT d + n $$;
CREATE FUNCTION private.ao_central(d date, h int) RETURNS timestamptz LANGUAGE sql AS $$ SELECT d::timestamptz $$;
CREATE FUNCTION private.ao_home_program(uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('program_id', (SELECT id FROM public.owner_programs LIMIT 1)) $$;
CREATE FUNCTION private.ao_add_plan_card(uuid, uuid, uuid, text, uuid, jsonb, uuid) RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
CREATE FUNCTION private.ao_owner_email_now(uuid, text, text, text) RETURNS void LANGUAGE sql AS $$ INSERT INTO public.notices DEFAULT VALUES $$;
`;

let db: PGlite;
const one = async (sql: string, args: unknown[] = []) => (await db.query(sql, args)).rows[0];
const all = async (sql: string, args: unknown[] = []) => (await db.query(sql, args)).rows;
const migration = APPLY.slice(0, APPLY.indexOf("DO $repair$"));
const repair = APPLY.slice(APPLY.indexOf("DO $repair$"));

beforeEach(async () => {
  db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(UNLOCK);
  await db.exec(OPS);
  await db.exec(migration);
});

const seedHomes = async () => {
  const prog = (await one("INSERT INTO public.owner_programs DEFAULT VALUES RETURNING id")).id;
  for (const [id, name] of [[FOXTAIL, "1399 Foxtail Ln."], [W104, "3915 W 104th St. S."], [FITZ, "9211 Fitzgerald Dr."], [OTHER, "1464 Buckland Ct."]]) {
    await db.query("INSERT INTO public.properties(id, name) VALUES ($1, $2)", [id, name]);
  }
  const cards: Record<string, string> = {};
  for (const code of [...EIGHT, "A24", "P09"]) {
    cards[code] = (await one("INSERT INTO public.ao_library_cards(code, title, stage_window) VALUES ($1, $1, $2) RETURNING id",
      [code, code === "P09" ? "anytime" : code === "A24" ? "onboarding_early" : "onboarding_launch"])).id;
  }
  for (const home of [FOXTAIL, W104, FITZ]) {
    for (const code of [...EIGHT, "A24"]) {
      await db.query("INSERT INTO public.ao_home_plan_cards(property_id, program_id, card_id, join_outcome) VALUES ($1, $2, $3, 'skipped_passed')", [home, prog, cards[code]]);
    }
  }
  await db.query("INSERT INTO public.ao_home_plan_cards(property_id, program_id, card_id, join_outcome) VALUES ($1, $2, $3, 'skipped_passed')", [OTHER, prog, cards.P07]);
  return cards;
};

describe("Rule: the 8 marketing and social cards open at handoff", () => {
  it("names exactly P07 P08 P12 P13 P14 P15 P19 P20", async () => {
    for (const code of EIGHT) expect((await one("SELECT private.ao_opens_at_handoff($1) v", [code])).v).toBe(true);
    for (const code of ["P09", "A24", "A33", "N10", "P21"]) expect((await one("SELECT private.ao_opens_at_handoff($1) v", [code])).v).toBe(false);
  });

  it("a home already handed off: P07 opens, an onboarding card is still skipped, A33 still stays locked", async () => {
    for (const [code, win] of [["P07", "onboarding_launch"], ["A24", "onboarding_early"], ["A33", "operations"], ["P09", "anytime"]]) {
      await db.query("INSERT INTO public.ao_library_cards(code, title, stage_window) VALUES ($1, $1, $2)", [code, win]);
    }
    const rows = await all("SELECT code, outcome FROM private.ao_plan_outcomes($1) ORDER BY code", [OTHER]);
    expect(rows).toEqual([
      { code: "A24", outcome: "skipped_passed" },
      { code: "A33", outcome: "locked" },
      { code: "P07", outcome: "open" },
      { code: "P09", outcome: "open" },
    ]);
  });
});

describe("Release on the three live homes", () => {
  it("opens 8 cards on each of the three homes, with no deadline, and touches nothing else", async () => {
    await seedHomes();
    await db.exec(repair);
    const open = await all(`SELECT pr.name, count(*)::int n FROM public.ao_home_plan_cards pc JOIN public.properties pr ON pr.id = pc.property_id
      WHERE pc.join_outcome = 'open' GROUP BY 1 ORDER BY 1`);
    expect(open).toEqual([{ name: "1399 Foxtail Ln.", n: 8 }, { name: "3915 W 104th St. S.", n: 8 }, { name: "9211 Fitzgerald Dr.", n: 8 }]);
    expect(Number((await one("SELECT count(*) n FROM public.ao_home_plan_cards WHERE join_outcome='open' AND (deadline_at IS NOT NULL OR reminder_at IS NOT NULL OR cutoff_at IS NOT NULL OR unlocked_at IS NULL)")).n)).toBe(0);
    expect(Number((await one("SELECT count(*) n FROM public.owner_reviews WHERE status='awaiting_owner' AND respond_by IS NULL")).n)).toBe(24);
    // A24 (not one of the 8) and the fourth home are unchanged.
    expect(Number((await one("SELECT count(*) n FROM public.ao_home_plan_cards WHERE join_outcome='skipped_passed'")).n)).toBe(4);
    expect(Number((await one("SELECT count(*) n FROM public.notices")).n)).toBe(0);
    const audit = (await one("SELECT after_value FROM public.audit_log WHERE action='portal_marketing_release_applied'")).after_value;
    expect(audit.opened).toBe(24);
    expect(audit.per_home).toEqual({ "1399 Foxtail Ln.": 8, "3915 W 104th St. S.": 8, "9211 Fitzgerald Dr.": 8 });
  });

  it("running it twice opens nothing more", async () => {
    await seedHomes();
    await db.exec(repair);
    await db.exec(repair);
    const audits = await all("SELECT after_value FROM public.audit_log WHERE action='portal_marketing_release_applied'");
    expect(audits[1].after_value.opened).toBe(0);
  });

  it("undo returns the 24 cards to skipped and restores the old rule", async () => {
    await seedHomes();
    await db.exec(repair);
    await db.exec(UNDO);
    expect(Number((await one("SELECT count(*) n FROM public.ao_home_plan_cards WHERE join_outcome='skipped_passed' AND owner_review_id IS NULL AND unlocked_at IS NULL")).n)).toBe(28);
    await db.query("INSERT INTO public.ao_library_cards(code, title, stage_window) VALUES ('P20', 'P20', 'onboarding_launch')");
    await db.query("DELETE FROM public.ao_home_plan_cards");
    const rows = await all("SELECT code, outcome FROM private.ao_plan_outcomes($1) WHERE code = 'P20'", [OTHER]);
    expect(rows.every((r) => r.outcome === "skipped_passed")).toBe(true);
  });
});
