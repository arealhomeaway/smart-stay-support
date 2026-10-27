import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const template = "00000000-0000-4000-8000-000000000101";
const otherTemplate = "00000000-0000-4000-8000-000000000102";
const actor = "00000000-0000-4000-8000-000000000103";
const ids = {
  a: "00000000-0000-4000-8000-000000000201",
  b: "00000000-0000-4000-8000-000000000202",
  c: "00000000-0000-4000-8000-000000000203",
  d: "00000000-0000-4000-8000-000000000204",
  other: "00000000-0000-4000-8000-000000000205",
};

let db: PGlite;

type Result = {
  changed: number;
  skipped: { stepId: string; title: string; reason: string }[];
  auditRecorded: boolean;
};

async function run(args: string[], values: unknown[]) {
  const result = await db.query<{ result: Result }>(
    `SELECT public.bulk_update_onboarding_template_steps(${args.join(", ")}) AS result`,
    values,
  );
  return result.rows[0]!.result;
}

async function task(id: string) {
  return (await db.query<Record<string, unknown>>(
    "SELECT * FROM public.onboarding_template_tasks WHERE id = $1",
    [id],
  )).rows[0]!;
}

describe("Workflow Template bulk edit database action (isolated PostgreSQL)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(readFileSync("supabase/tests/fixtures/template_bulk_edit_schema.sql", "utf8"));
    await db.exec(readFileSync("docs/pending/bulk-edit/0164_bulk_template_step_edit.sql", "utf8"));
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    await db.exec("TRUNCATE public.audit_log, public.onboarding_tasks, public.onboarding_template_tasks, public.onboarding_template_stages, public.onboarding_templates");
    await db.query("SELECT set_config('test.actor', $1, false), set_config('test.leader', 'true', false)", [actor]);
    await db.query("INSERT INTO public.onboarding_templates(id, name) VALUES ($1, 'Practice template'), ($2, 'Other template')", [template, otherTemplate]);
    await db.query(
      "INSERT INTO public.onboarding_template_stages(template_id, name, sort_order) VALUES ($1, 'Intake', 10), ($1, 'Preparation', 20)",
      [template],
    );
    await db.query(
      `INSERT INTO public.onboarding_template_tasks(id, template_id, title, stage, sort_order, functional_role, is_required, blocks_handoff, offset_days, schedule_anchor, offset_unit, requires_owner_approval, tags)
       VALUES
       ($1, $5, 'First', 'Intake', 10, 'onboarding_project_manager', true, false, 1, 'project_created', 'calendar', false, '{}'),
       ($2, $5, 'Second', 'Intake', 20, 'utilities', true, false, 2, 'project_created', 'calendar', false, '{}'),
       ($3, $5, 'Third', 'Intake', 30, NULL, false, false, NULL, NULL, 'calendar', false, '{}'),
       ($4, $5, 'Already prepared', 'Preparation', 10, NULL, true, false, NULL, NULL, 'calendar', false, '{}')`,
      [ids.a, ids.b, ids.c, ids.d, template],
    );
    await db.query(
      "INSERT INTO public.onboarding_template_tasks(id, template_id, title, stage, sort_order) VALUES ($1, $2, 'Other step', 'Intake', 10)",
      [ids.other, otherTemplate],
    );
  });

  it("changes the due offset on three steps and records who, when, fields and old to new", async () => {
    const result = await run([
      "_template_id := $1",
      "_step_ids := $2",
      "_set_due_rule := true",
      "_offset_days := 5",
      "_schedule_anchor := 'actual_access'",
    ], [template, [ids.a, ids.b, ids.c]]);

    expect(result).toEqual({ changed: 3, skipped: [], auditRecorded: true });
    for (const id of [ids.a, ids.b, ids.c]) {
      expect(await task(id)).toMatchObject({ offset_days: 5, schedule_anchor: "actual_access" });
    }
    const audit = (await db.query<Record<string, unknown>>("SELECT * FROM public.audit_log")).rows[0]!;
    expect(audit).toMatchObject({ actor_id: actor, action: "onboarding_template_steps_bulk_updated", entity_id: template });
    expect((audit["before_value"] as { steps: unknown[] }).steps).toHaveLength(3);
    expect((audit["after_value"] as { steps: unknown[] }).steps).toHaveLength(3);
    expect(audit["created_at"]).toBeTruthy();
  });

  it("switches selected steps to business days", async () => {
    const result = await run([
      "_template_id := $1",
      "_step_ids := $2",
      "_set_offset_unit := true",
      "_offset_unit := 'business'",
    ], [template, [ids.a, ids.b]]);
    expect(result.changed).toBe(2);
    expect((await task(ids.a))["offset_unit"]).toBe("business");
    expect((await task(ids.b))["offset_unit"]).toBe("business");
    expect((await task(ids.c))["offset_unit"]).toBe("calendar");
  });

  it("moves steps to another stage after existing steps while keeping their relative order", async () => {
    const result = await run([
      "_template_id := $1",
      "_step_ids := $2",
      "_set_stage := true",
      "_stage := 'Preparation'",
    ], [template, [ids.c, ids.a]]);
    expect(result.changed).toBe(2);
    expect(await task(ids.a)).toMatchObject({ stage: "Preparation", sort_order: 20 });
    expect(await task(ids.c)).toMatchObject({ stage: "Preparation", sort_order: 30 });
    expect(await task(ids.d)).toMatchObject({ stage: "Preparation", sort_order: 10 });
  });

  it("Blocks handoff Yes skips homeowner and Active Owner steps with the approved message", async () => {
    await db.query("UPDATE public.onboarding_template_tasks SET requires_owner_approval = true WHERE id = $1", [ids.a]);
    await db.query("UPDATE public.onboarding_template_tasks SET tags = ARRAY['active_owner'] WHERE id = $1", [ids.b]);
    const result = await run([
      "_template_id := $1",
      "_step_ids := $2",
      "_set_blocks_handoff := true",
      "_blocks_handoff := true",
    ], [template, [ids.a, ids.b, ids.c]]);
    expect(result.changed).toBe(1);
    expect(result.skipped).toHaveLength(2);
    expect(result.skipped.every((item) => item.reason === "Homeowner or Active Owner steps are left as non-blocking.")).toBe(true);
    expect((await task(ids.a))["blocks_handoff"]).toBe(false);
    expect((await task(ids.b))["blocks_handoff"]).toBe(false);
    expect((await task(ids.c))["blocks_handoff"]).toBe(true);
  });

  it("one step from another template makes the whole save fail with nothing changed", async () => {
    await expect(run([
      "_template_id := $1",
      "_step_ids := $2",
      "_set_due_rule := true",
      "_offset_days := 9",
      "_schedule_anchor := 'planned_closing'",
    ], [template, [ids.a, ids.other]])).rejects.toThrow("Some selected steps are no longer in this template");
    expect((await task(ids.a))["offset_days"]).toBe(1);
    expect((await task(ids.other))["offset_days"]).toBeNull();
    expect((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM public.audit_log")).rows[0]!.n).toBe(0);
  });

  it("a person who cannot edit templates cannot bulk edit", async () => {
    await db.query("SELECT set_config('test.leader', 'false', false)");
    await expect(run([
      "_template_id := $1",
      "_step_ids := $2",
      "_set_is_required := true",
      "_is_required := false",
    ], [template, [ids.a]])).rejects.toThrow("Only the Onboarding Director or a Supervisor can change templates");
    expect((await task(ids.a))["is_required"]).toBe(true);
    expect((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM public.audit_log")).rows[0]!.n).toBe(0);
  });

  it("leaves an existing home's plan unchanged", async () => {
    await db.query("INSERT INTO public.onboarding_tasks(id, template_task_id, title, due_on) VALUES ($1, $2, 'Live home task', '2026-11-01')", [ids.other, ids.a]);
    await run([
      "_template_id := $1",
      "_step_ids := $2",
      "_set_due_rule := true",
      "_offset_days := 7",
      "_schedule_anchor := 'target_handoff'",
    ], [template, [ids.a]]);
    expect((await db.query<Record<string, unknown>>("SELECT * FROM public.onboarding_tasks WHERE id = $1", [ids.other])).rows[0]).toMatchObject({
      title: "Live home task",
      due_on: "2026-11-01",
    });
  });
});
