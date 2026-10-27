import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const homeA = "00000000-0000-4000-8000-0000000005a1";
const homeB = "00000000-0000-4000-8000-0000000005b1";
const project = "00000000-0000-4000-8000-000000000502";
const actor = "00000000-0000-4000-8000-000000000503";
const tpl = "00000000-0000-4000-8000-000000000504";
const stepDesign = "00000000-0000-4000-8000-000000000601";
const stepPm = "00000000-0000-4000-8000-000000000602";
const t = {
  design: "00000000-0000-4000-8000-000000000701",
  pm: "00000000-0000-4000-8000-000000000702",
  gone: "00000000-0000-4000-8000-000000000703",
  other: "00000000-0000-4000-8000-000000000704",
};

let db: PGlite;
const q = (sql: string, v: unknown[] = []) => db.query<Record<string, unknown>>(sql, v);
const activeLinks = async (recv: string) =>
  (await q("SELECT source_task_id FROM public.onboarding_task_file_links WHERE receiving_task_id=$1 AND removed_at IS NULL", [recv])).rows.map((r) => r["source_task_id"]);

describe("Step file links database change 0166 (isolated PostgreSQL)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(readFileSync("supabase/tests/fixtures/step_file_links_schema.sql", "utf8"));
    await db.exec(readFileSync("docs/pending/step-file-links/0166_step_file_links.sql", "utf8"));
  });
  afterAll(async () => { await db.close(); });

  beforeEach(async () => {
    await db.exec("TRUNCATE public.onboarding_task_file_links, public.audit_log, public.onboarding_tasks, public.onboarding_projects, public.onboarding_template_tasks, public.onboarding_template_versions");
    await q("SELECT set_config('test.actor',$1,false), set_config('test.staff','true',false), set_config('test.leader','false',false)", [actor]);
    await q("INSERT INTO public.onboarding_projects(id, property_id, project_manager, possession_on) VALUES ($1,$2,$3,'2026-11-01')", [project, homeA, actor]);
    await q(
      `INSERT INTO public.onboarding_tasks(id, property_id, title, archived_at) VALUES
       ($1,$5,'Create the TV mount instructions',NULL), ($2,$5,'Draft work order: Install TV mounts',NULL),
       ($3,$5,'Old step', now()), ($4,$6,'Other home step',NULL)`,
      [t.design, t.pm, t.gone, t.other, homeA, homeB],
    );
  });

  it("links two Tasks on the same home by hand and records history", async () => {
    await q("SELECT public.set_onboarding_task_file_sources($1,$2)", [t.pm, [t.design]]);
    expect(await activeLinks(t.pm)).toEqual([t.design]);
    const audit = (await q("SELECT action FROM public.audit_log")).rows;
    expect(audit).toEqual([{ action: "onboarding_task.file_sources_changed" }]);
  });

  it("refuses a self-link", async () => {
    await expect(q("SELECT public.set_onboarding_task_file_sources($1,$2)", [t.pm, [t.pm]])).rejects.toThrow("itself");
  });

  it("refuses a link to another home", async () => {
    await expect(q("SELECT public.set_onboarding_task_file_sources($1,$2)", [t.pm, [t.other]])).rejects.toThrow("same home");
    await expect(
      q("INSERT INTO public.onboarding_task_file_links(property_id,receiving_task_id,source_task_id,origin) VALUES ($1,$2,$3,'manual')", [homeA, t.pm, t.other]),
    ).rejects.toThrow("same home");
  });

  it("refuses someone who is not this home's lead or a supervisor", async () => {
    await q("SELECT set_config('test.actor',$1,false)", ["00000000-0000-4000-8000-000000000999"]);
    await expect(q("SELECT public.set_onboarding_task_file_sources($1,$2)", [t.pm, [t.design]])).rejects.toThrow("project lead");
  });

  it("removing a link keeps history instead of deleting it", async () => {
    await q("SELECT public.set_onboarding_task_file_sources($1,$2)", [t.pm, [t.design]]);
    await q("SELECT public.set_onboarding_task_file_sources($1,$2)", [t.pm, []]);
    expect(await activeLinks(t.pm)).toEqual([]);
    expect((await q("SELECT count(*)::int n FROM public.onboarding_task_file_links WHERE removed_by=$1", [actor])).rows[0]!["n"]).toBe(1);
  });

  it("template steps may only point at steps in the same template, never themselves", async () => {
    await q("INSERT INTO public.onboarding_template_tasks(id,template_id,title) VALUES ($1,$3,'A'),($2,$3,'B')", [stepDesign, stepPm, tpl]);
    await q("UPDATE public.onboarding_template_tasks SET show_files_from=$1 WHERE id=$2", [[stepDesign], stepPm]);
    await expect(q("UPDATE public.onboarding_template_tasks SET show_files_from=$1 WHERE id=$1::uuid[]::uuid[] IS NULL OR id=$2", [[stepPm], stepPm])).rejects.toThrow("itself");
    await expect(q("UPDATE public.onboarding_template_tasks SET show_files_from=$1 WHERE id=$2", [[t.other], stepPm])).rejects.toThrow("same template");
  });

  it("a new home started from the template gets the link between its own Tasks", async () => {
    const version = "00000000-0000-4000-8000-000000000801";
    const snap = { steps: [
      { id: stepDesign, title: "Create the TV mount instructions", stage: "Design", sort_order: 1, show_files_from: [] },
      { id: stepPm, title: "Draft work order: Install TV mounts", stage: "Design", sort_order: 2, show_files_from: [stepDesign] },
    ] };
    await q("INSERT INTO public.onboarding_template_versions(id,snapshot) VALUES ($1,$2)", [version, JSON.stringify(snap)]);
    await q("SELECT set_config('test.leader','true',false)");
    await q("SELECT public.instantiate_onboarding_v2($1,$2)", [project, version]);
    const made = (await q("SELECT id, template_task_id FROM public.onboarding_tasks WHERE template_task_id IS NOT NULL")).rows;
    const design = made.find((r) => r["template_task_id"] === stepDesign)!["id"];
    const pm = made.find((r) => r["template_task_id"] === stepPm)!["id"];
    const links = (await q("SELECT property_id, receiving_task_id, source_task_id, origin FROM public.onboarding_task_file_links")).rows;
    expect(links).toEqual([{ property_id: homeA, receiving_task_id: pm, source_task_id: design, origin: "template" }]);
  });
});
