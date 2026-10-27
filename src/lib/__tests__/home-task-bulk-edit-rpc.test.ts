import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const home = "00000000-0000-4000-8000-000000000301";
const project = "00000000-0000-4000-8000-000000000302";
const actor = "00000000-0000-4000-8000-000000000303";
const ids = {
  a: "00000000-0000-4000-8000-000000000401",
  b: "00000000-0000-4000-8000-000000000402",
  c: "00000000-0000-4000-8000-000000000403",
  done: "00000000-0000-4000-8000-000000000404",
  owner: "00000000-0000-4000-8000-000000000405",
  prep: "00000000-0000-4000-8000-000000000406",
};

let db: PGlite;
type Result = { changed: number; skipped: { taskId: string; reason: string }[]; auditRecorded: boolean; blockingBefore: number; blockingAfter: number };

async function run(args: string[], values: unknown[]) {
  const r = await db.query<{ result: Result }>(
    `SELECT public.bulk_update_onboarding_home_tasks(_property_id := $1, _task_ids := $2, ${args.join(", ")}) AS result`,
    [home, ...values],
  );
  return r.rows[0]!.result;
}
const task = async (id: string) =>
  (await db.query<Record<string, unknown>>("SELECT *, due_on::text AS due_on FROM public.onboarding_tasks WHERE id = $1", [id])).rows[0]!;
const auditCount = async () => (await db.query<{ n: number }>("SELECT count(*)::int AS n FROM public.audit_log")).rows[0]!.n;

describe("Home plan bulk edit database action (isolated PostgreSQL)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(readFileSync("supabase/tests/fixtures/home_task_bulk_edit_schema.sql", "utf8"));
    await db.exec(readFileSync("docs/pending/home-plan-bulk-edit/0165_bulk_home_task_edit.sql", "utf8"));
  });
  afterAll(async () => { await db.close(); });

  beforeEach(async () => {
    await db.exec("TRUNCATE public.audit_log, public.onboarding_tasks, public.work_items, public.onboarding_projects, public.properties, public.onboarding_project_events");
    await db.query("SELECT set_config('test.actor', $1, false), set_config('test.staff', 'true', false), set_config('test.leader', 'false', false)", [actor]);
    await db.query("INSERT INTO public.properties(id) VALUES ($1)", [home]);
    await db.query("INSERT INTO public.onboarding_projects(id, property_id, project_manager, possession_on) VALUES ($1, $2, $3, '2026-11-01')", [project, home, actor]);
    await db.query(
      `INSERT INTO public.onboarding_tasks(id, property_id, title, stage, sort_order, status, due_on, due_on_source, schedule_anchor, schedule_offset_days, assigned_seat, is_required, blocks_handoff, tags, requires_owner_approval)
       VALUES
       ($1, $7, 'First', 'Intake', 10, 'open', '2026-11-02', 'template_v2', 'actual_access', 1, 'utilities', true, false, '{}', false),
       ($2, $7, 'Second', 'Intake', 20, 'in_progress', '2026-11-03', 'template_v2', 'actual_access', 2, 'utilities', true, false, '{}', false),
       ($3, $7, 'Third', 'Intake', 30, 'blocked', NULL, NULL, NULL, NULL, NULL, false, false, '{}', false),
       ($4, $7, 'Finished', 'Intake', 40, 'complete', '2026-10-01', 'template_v2', 'actual_access', 0, 'utilities', true, true, '{}', false),
       ($5, $7, 'Owner review', 'Intake', 50, 'open', NULL, NULL, NULL, NULL, NULL, true, false, ARRAY['active_owner'], false),
       ($6, $7, 'Prep', 'Preparation', 10, 'open', NULL, NULL, NULL, NULL, NULL, true, false, '{}', false)`,
      [ids.a, ids.b, ids.c, ids.done, ids.owner, ids.prep, home],
    );
  });

  it("refuses a completed Task and changes nothing", async () => {
    await expect(run(["_set_is_required := true", "_is_required := false"], [[ids.a, ids.done]])).rejects.toThrow("Finished (completed)");
    expect((await task(ids.a))["is_required"]).toBe(true);
    expect(await task(ids.done)).toMatchObject({ status: "complete", is_required: true });
    expect(await auditCount()).toBe(0);
  });

  it("never changes any Task's status", async () => {
    await run(["_set_is_required := true", "_is_required := false", "_set_offset_unit := true", "_offset_unit := 'business'"], [[ids.a, ids.b, ids.c]]);
    expect((await task(ids.a))["status"]).toBe("open");
    expect((await task(ids.b))["status"]).toBe("in_progress");
    expect((await task(ids.c))["status"]).toBe("blocked");
  });

  it("a hand-set due date is marked overridden and survives a closing/access date change", async () => {
    await run(["_set_due_on := true", "_due_on := '2026-12-15'"], [[ids.a]]);
    expect(await task(ids.a)).toMatchObject({ due_on: "2026-12-15", due_on_overridden: true, due_on_source: "manual" });
    await db.query("UPDATE public.onboarding_projects SET possession_on = '2026-11-20' WHERE id = $1", [project]);
    expect((await task(ids.a))["due_on"]).toBe("2026-12-15");
    expect((await task(ids.b))["due_on"]).toBe("2026-11-22");
  });

  it("Blocks handoff Yes skips Active Owner Tasks with the approved message and reports readiness", async () => {
    const r = await run(["_set_blocks_handoff := true", "_blocks_handoff := true"], [[ids.a, ids.owner]]);
    expect(r.changed).toBe(1);
    expect(r.skipped).toHaveLength(1);
    expect(r.skipped[0]!.reason).toBe("Homeowner or Active Owner Tasks are left as non-blocking.");
    expect((await task(ids.owner))["blocks_handoff"]).toBe(false);
    expect(r.blockingBefore).toBe(0);
    expect(r.blockingAfter).toBe(1);
  });

  it("one invalid Task fails the whole save with nothing changed", async () => {
    await db.query("UPDATE public.onboarding_tasks SET exception_at = now() WHERE id = $1", [ids.c]);
    await expect(run(["_set_due_on := true", "_due_on := '2026-12-01'"], [[ids.a, ids.b, ids.c]])).rejects.toThrow("Third (has an exception)");
    expect((await task(ids.a))["due_on"]).toBe("2026-11-02");
    expect((await task(ids.b))["due_on"]).toBe("2026-11-03");
    expect(await auditCount()).toBe(0);
  });

  it("records history per Task and per field, old to new", async () => {
    await run(["_set_role := true", "_role := 'lead_designer'", "_set_is_required := true", "_is_required := false"], [[ids.a, ids.b]]);
    const rows = (await db.query<Record<string, unknown>>("SELECT * FROM public.audit_log ORDER BY entity_label")).rows;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ actor_id: actor, action: "onboarding_task_bulk_updated", entity_type: "onboarding_task", entity_id: ids.a });
    expect(rows[0]!["before_value"]).toEqual({ assigned_seat: "utilities", is_required: true });
    expect(rows[0]!["after_value"]).toEqual({ assigned_seat: "lead_designer", is_required: false });
  });

  it("keeps the work_items mirror in step", async () => {
    await db.query("UPDATE public.onboarding_tasks SET title = title");
    await run(["_set_due_on := true", "_due_on := '2026-12-05'", "_set_role := true", "_role := 'designer'"], [[ids.a]]);
    const wi = (await db.query<Record<string, unknown>>("SELECT functional_role, due_on::text AS due_on, status FROM public.work_items WHERE source_id = $1", [ids.a])).rows[0];
    expect(wi).toEqual({ functional_role: "designer", due_on: "2026-12-05", status: "open" });
  });

  it("moves Tasks to another stage after its existing Tasks, keeping their order", async () => {
    await run(["_set_stage := true", "_stage := 'Preparation'"], [[ids.b, ids.a]]);
    expect(await task(ids.a)).toMatchObject({ stage: "Preparation", sort_order: 20 });
    expect(await task(ids.b)).toMatchObject({ stage: "Preparation", sort_order: 30 });
    expect((await task(ids.prep))["sort_order"]).toBe(10);
  });

  it("refuses a person who cannot edit this home's Tasks", async () => {
    await db.query("UPDATE public.onboarding_projects SET project_manager = NULL");
    await expect(run(["_set_is_required := true", "_is_required := false"], [[ids.a]])).rejects.toThrow("Only this project lead or a supervisor");
    await db.query("SELECT set_config('test.staff', 'false', false)");
    await expect(run(["_set_is_required := true", "_is_required := false"], [[ids.a]])).rejects.toThrow("Onboarding staff access is required");
    expect((await task(ids.a))["is_required"]).toBe(true);
    expect(await auditCount()).toBe(0);
  });

  it("refuses Tasks in a stage that is under review", async () => {
    await db.query("INSERT INTO public.onboarding_project_events(project_id, kind, new_value) VALUES ($1, 'stage_capture:Intake', '{\"revision\":1,\"status\":\"awaiting_review\"}')", [project]);
    await expect(run(["_set_is_required := true", "_is_required := false"], [[ids.a]])).rejects.toThrow("Return or reopen these stages first");
  });
});
