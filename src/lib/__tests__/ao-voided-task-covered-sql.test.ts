// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
// Practice copy of docs/pending/ao-voided-task-covered/apply.sql (Admin, Nov 16, option A). Nothing here touches the real database.
import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const APPLY = readFileSync("docs/pending/ao-voided-task-covered/apply.sql", "utf8");
const UNDO = readFileSync("docs/pending/ao-voided-task-covered/apply.undo.sql", "utf8");
const fnPart = (sql: string) => sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION"), sql.indexOf("$function$;") + "$function$;".length);
const repairPart = APPLY.slice(APPLY.indexOf("DO $repair$"));
const HOME = "00000000-0000-4000-8000-0000000000b1";
const STEP = "00000000-0000-4000-8000-0000000000c1";

const SCHEMA = `
CREATE SCHEMA private;
CREATE TABLE public.ao_library_cards(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text, title text, stage_window text DEFAULT 'onboarding_early',
  status text DEFAULT 'released', lock_rule text DEFAULT 'until_linked_step_done', linked_template_task_ids uuid[] DEFAULT '{}');
CREATE TABLE public.ao_home_plan_cards(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, card_id uuid, join_outcome text,
  linked_task_id uuid, unlocked_at timestamptz, owner_completed_at timestamptz, expired_at timestamptz,
  covered_reason text, covered_source text, covered_item_id uuid, created_at timestamptz DEFAULT now());
CREATE TABLE public.onboarding_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, template_task_id uuid,
  status text DEFAULT 'open', archived_at timestamptz, created_at timestamptz DEFAULT now());
CREATE TABLE public.audit_log(actor_id uuid, actor_label text, action text, entity_type text, entity_label text, reason text, before_value jsonb, after_value jsonb);
CREATE FUNCTION private.ao_home_stage(uuid) RETURNS text LANGUAGE sql AS $$ SELECT 'onboarding' $$;
CREATE FUNCTION private.ao_card_coverage(uuid, text, uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT NULL::jsonb $$;
CREATE FUNCTION private.ao_ops_card_rule(text) RETURNS text LANGUAGE sql AS $$ SELECT NULL::text $$;
`;

let db: PGlite;
const one = async (sql: string, args: unknown[] = []) => (await db.query(sql, args)).rows[0];
const card = async (code: string) => (await one("INSERT INTO public.ao_library_cards(code, title, linked_template_task_ids) VALUES ($1, $1, ARRAY[$2]::uuid[]) RETURNING id", [code, STEP])).id;
const task = async (archived: string | null, status = "open") =>
  (await one("INSERT INTO public.onboarding_tasks(property_id, template_task_id, status, archived_at) VALUES ($1, $2, $3, $4) RETURNING id", [HOME, STEP, status, archived])).id;
const outcome = async () => one("SELECT outcome, task_id, coverage FROM private.ao_plan_outcomes($1)", [HOME]);

beforeEach(async () => {
  db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(fnPart(APPLY));
});

describe("Plan start: a card whose only matching Task was voided or archived before the plan started", () => {
  it("is marked already covered with the Not needed reason and that Task", async () => {
    await card("A25");
    const voided = await task("2026-11-12T23:39:00Z");
    expect(await outcome()).toEqual({ outcome: "already_covered", task_id: null,
      coverage: { reason: "task_not_needed", source: "onboarding_task", item_id: voided } });
  });

  it("uses the most recently voided Task when there are two", async () => {
    await card("A25");
    await task("2026-11-12T06:17:00Z");
    const later = await task("2026-11-13T00:16:00Z");
    expect((await outcome()).coverage.item_id).toBe(later);
  });

  it("stays locked and linked when a live matching Task exists, even beside a voided one", async () => {
    await card("A25");
    await task("2026-11-12T06:15:00Z");
    const live = await task(null);
    expect(await outcome()).toMatchObject({ outcome: "locked", task_id: live, coverage: null });
  });

  it("stays locked when there is no matching Task at all", async () => {
    await card("A52");
    expect(await outcome()).toMatchObject({ outcome: "locked", task_id: null, coverage: null });
  });
});

const FIX = [...repairPart.matchAll(/\('([0-9a-f-]{36})'::uuid, '([0-9a-f-]{36})'::uuid, '([^']+)'\)/g)].map((m) => ({ pc: m[1], task: m[2], label: m[3] }));

describe("Repair of the 10 named cards", () => {
  const seed = async () => {
    const c = await card("A25");
    for (const f of FIX) {
      await db.query("INSERT INTO public.onboarding_tasks(id, property_id, template_task_id, archived_at) VALUES ($1, $2, $3, '2026-11-12T00:00:00Z')", [f.task, HOME, STEP]);
      await db.query("INSERT INTO public.ao_home_plan_cards(id, property_id, card_id, join_outcome, created_at) VALUES ($1, $2, $3, 'locked', '2026-11-13T00:00:00Z')", [f.pc, HOME, c]);
    }
  };

  it("names exactly 10 cards and marks each already covered with its voided Task", async () => {
    expect(FIX.length).toBe(10);
    await seed();
    await db.exec(repairPart);
    for (const f of FIX) {
      expect(await one("SELECT join_outcome, covered_reason, covered_source, covered_item_id, unlocked_at FROM public.ao_home_plan_cards WHERE id=$1", [f.pc]))
        .toEqual({ join_outcome: "already_covered", covered_reason: "task_not_needed", covered_source: "onboarding_task", covered_item_id: f.task, unlocked_at: null });
    }
    expect((await one("SELECT after_value FROM public.audit_log WHERE action='ao_voided_task_covered_applied'")).after_value).toEqual({ cards_marked: 10 });
  });

  it("changes nothing if any card was opened since the check", async () => {
    await seed();
    await db.query("UPDATE public.ao_home_plan_cards SET unlocked_at = now() WHERE id=$1", [FIX[0].pc]);
    await expect(db.exec(repairPart)).rejects.toThrow("Expected 10 cards, matched 9");
    expect(Number((await one("SELECT count(*) n FROM public.ao_home_plan_cards WHERE join_outcome='already_covered'")).n)).toBe(0);
  });

  it("undo returns the cards to locked and restores the old plan start rule", async () => {
    await seed();
    await db.exec(repairPart);
    await db.exec(UNDO);
    expect(Number((await one("SELECT count(*) n FROM public.ao_home_plan_cards WHERE join_outcome='locked' AND covered_reason IS NULL")).n)).toBe(10);
    await db.query("DELETE FROM public.ao_home_plan_cards");
    expect((await outcome()).outcome).toBe("locked");
  });
});
