// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * ao-catch-up-opens (Admin, Nov 15): Plan catch-up Mark done opens linked homeowner cards the same way the
 * Task drawer does, instead of marking them "already covered". Practice copy: the plan catch-up fixture with
 * docs/pending/plan-catch-up/apply.sql, then step 1 of docs/pending/ao-catch-up-opens/apply.sql.
 */
const DIR = "docs/pending/ao-catch-up-opens";
const PM = "00000000-0000-4000-8000-0000000000a2";
const HOME = "00000000-0000-4000-8000-0000000000b1";
const STEP = "00000000-0000-4000-8000-0000000000c1";

const stepOne = (file: string) => {
  const sql = readFileSync(`${DIR}/${file}`, "utf8");
  const start = sql.indexOf("CREATE OR REPLACE FUNCTION private.plan_catch_up_cards");
  const end = sql.indexOf("$function$;", start) + "$function$;".length;
  return sql.slice(start, end);
};

let db: PGlite;
const one = async (sql: string, args: unknown[] = []) => (await db.query(sql, args)).rows[0];
const task = async (title: string, extra: Record<string, unknown> = {}) => {
  const f = { property_id: HOME, title, template_task_id: STEP, ...extra };
  const cols = Object.keys(f);
  return (await one(`INSERT INTO public.onboarding_tasks(${cols.join(",")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(",")}) RETURNING id`, Object.values(f))).id;
};
const card = async (taskId: string | null, extra = "") => {
  const c = (await one("INSERT INTO public.ao_library_cards(code, title, linked_template_task_ids) VALUES ('C12', 'Choose your smart lock', ARRAY[$1]::uuid[]) RETURNING id", [STEP])).id;
  const review = (await one("INSERT INTO public.owner_reviews(title, status) VALUES ('Choose your smart lock', 'prepared') RETURNING id")).id;
  const pc = (await one(`INSERT INTO public.ao_home_plan_cards(property_id, card_id, join_outcome, linked_task_id, owner_review_id${extra ? ", owner_completed_at" : ""}) VALUES ($1,$2,'locked',$3,$4${extra ? ", now()" : ""}) RETURNING id`, [HOME, c, taskId, review])).id;
  return { pc, review };
};
const done = (ids: string[], note: string, dry = false) =>
  one("SELECT public.bulk_complete_onboarding_tasks($1, $2::uuid[], $3, NULL, NULL, $4) AS r", [HOME, ids, note, dry]).then((x) => x.r);
const cardRow = (pc: string) => one("SELECT join_outcome, unlocked_at IS NOT NULL AS opened, unlocked_by, covered_reason FROM public.ao_home_plan_cards WHERE id=$1", [pc]);
const reviewStatus = async (id: string) => (await one("SELECT status FROM public.owner_reviews WHERE id=$1", [id])).status;

beforeEach(async () => {
  db = new PGlite();
  await db.exec(readFileSync("src/lib/__tests__/fixtures/plan-catch-up-schema.sql", "utf8"));
  await db.exec(`
    INSERT INTO public.user_roles VALUES ('${PM}','onboarding');
    INSERT INTO public.properties(id) VALUES ('${HOME}');
    INSERT INTO public.onboarding_projects(property_id, project_manager) VALUES ('${HOME}', '${PM}');
    INSERT INTO public.ao_home_plan_settings VALUES ('${HOME}', true);
  `);
  await db.exec(readFileSync("docs/pending/plan-catch-up/apply.sql", "utf8"));
  await db.exec(stepOne("apply.sql"));
  await db.query("DELETE FROM public.me");
  await db.query("INSERT INTO public.me VALUES ($1)", [PM]);
});

describe("Plan catch-up Mark done opens linked homeowner cards", () => {
  it("the Task completes and its linked card opens, never marked already covered", async () => {
    const a = await task("Pick the smart lock");
    const { pc, review } = await card(a);
    expect((await done([a], "", true)).covered).toEqual([]);
    const out = await done([a], "Lock installed, photo in SharePoint");
    expect(out.completed).toBe(1);
    expect(out.covered).toEqual([]);
    expect((await one("SELECT status FROM public.onboarding_tasks WHERE id=$1", [a])).status).toBe("complete");
    expect(await cardRow(pc)).toEqual({ join_outcome: "locked", opened: true, unlocked_by: PM, covered_reason: null });
    expect(await reviewStatus(review)).toBe("awaiting_owner");
  });

  it("matches the Task drawer: the same card opened by a single Task update ends in the same state", async () => {
    const a = await task("Pick the smart lock");
    const { pc } = await card(a);
    await db.query("UPDATE public.onboarding_tasks SET status='complete', completed_by=$2 WHERE id=$1", [a, PM]);
    expect(await cardRow(pc)).toEqual({ join_outcome: "locked", opened: true, unlocked_by: PM, covered_reason: null });
  });

  it("a held back Task leaves its card locked", async () => {
    const a = await task("Blocked one", { blocker: "Waiting on HOA" });
    const { pc, review } = await card(a);
    const out = await done([a], "Proof in SharePoint");
    expect(out.completed).toBe(0);
    expect(await cardRow(pc)).toEqual({ join_outcome: "locked", opened: false, unlocked_by: null, covered_reason: null });
    expect(await reviewStatus(review)).toBe("prepared");
  });

  it("a card the owner already completed is left alone", async () => {
    const a = await task("Pick the smart lock");
    const b = await task("Other step", { template_task_id: null });
    const { pc } = await card(b, "owner_done");
    await done([a], "Proof in SharePoint");
    expect((await cardRow(pc)).covered_reason).toBeNull();
  });

  it("Not needed still marks the card already covered", async () => {
    const a = await task("HOA approval");
    const { pc } = await card(a);
    const out = await one("SELECT public.plan_catch_up_tasks($1, $2::uuid[], 'not_needed', 'No HOA', NULL, NULL, NULL, false) AS r", [HOME, [a]]).then((x) => x.r);
    expect(out.done).toBe(1);
    expect((await cardRow(pc)).join_outcome).toBe("already_covered");
    expect((await cardRow(pc)).covered_reason).toBe("task_not_needed");
  });

  it("the undo file puts back the old step exactly", async () => {
    await db.exec(stepOne("apply.undo.sql"));
    const a = await task("Pick the smart lock");
    const { pc } = await card(a);
    await done([a], "Lock installed, photo in SharePoint");
    expect(await cardRow(pc)).toEqual({ join_outcome: "already_covered", opened: false, unlocked_by: null, covered_reason: "done_outside_resolve" });
  });
});
