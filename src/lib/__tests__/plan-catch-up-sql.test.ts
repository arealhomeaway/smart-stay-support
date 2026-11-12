// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Practice run of docs/pending/plan-catch-up/apply.sql (and its undo) on an isolated copy
 * (plan catch-up, Admin approval Nov 12). Live column names, fake people and homes only.
 */
const DIR = "docs/pending/plan-catch-up";
const ADMIN = "00000000-0000-4000-8000-0000000000a0";
const DIRECTOR = "00000000-0000-4000-8000-0000000000a1";
const PM = "00000000-0000-4000-8000-0000000000a2";
const UTIL = "00000000-0000-4000-8000-0000000000a3";
const OPS = "00000000-0000-4000-8000-0000000000a4";
const OTHER_PM = "00000000-0000-4000-8000-0000000000a5";
const HOME = "00000000-0000-4000-8000-0000000000b1";
const NEW_HOME = "00000000-0000-4000-8000-0000000000b2";

let db: PGlite;
const as = async (user: string | null) => {
  await db.query("DELETE FROM public.me");
  if (user) await db.query("INSERT INTO public.me VALUES ($1)", [user]);
};
const one = async (sql: string, args: unknown[] = []) => (await db.query(sql, args)).rows[0];
const task = async (fields: Record<string, unknown>) => {
  const f = { property_id: HOME, ...fields };
  const cols = Object.keys(f);
  return (await one(`INSERT INTO public.onboarding_tasks(${cols.join(",")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(",")}) RETURNING id`, Object.values(f))).id as string;
};
const done = (ids: string[], note: string, doneOn: string | null = null, dry = false, home = HOME) =>
  one("SELECT public.bulk_complete_onboarding_tasks($1, $2::uuid[], $3, $4::date, NULL, $5) AS r", [home, ids, note, doneOn, dry]).then((x) => x.r);
const act = (ids: string[], action: string, o: { reason?: string; role?: string; person?: string; due?: string; dry?: boolean } = {}) =>
  one("SELECT public.plan_catch_up_tasks($1, $2::uuid[], $3, $4, $5, $6::uuid, $7::date, $8) AS r",
    [HOME, ids, action, o.reason ?? null, o.role ?? null, o.person ?? null, o.due ?? null, o.dry ?? false]).then((x) => x.r);
const undo = (batch: string) => one("SELECT public.undo_onboarding_task_batch($1) AS r", [batch]).then((x) => x.r);
const fails = async (p: Promise<unknown>) => {
  try { await p; } catch (e) { return String((e as Error).message); }
  throw new Error("expected a refusal");
};
const daysAgo = async (n: number) => (await one(`SELECT ((now() AT TIME ZONE 'America/Chicago')::date - ${n})::text AS d`)).d as string;
const ownerReached = async () => Number((await one("SELECT (SELECT count(*) FROM public.owner_notifications) + (SELECT count(*) FROM public.email_log) AS n")).n);

beforeEach(async () => {
  db = new PGlite();
  await db.exec(readFileSync("src/lib/__tests__/fixtures/plan-catch-up-schema.sql", "utf8"));
  await db.exec(`
    INSERT INTO public.user_roles VALUES ('${ADMIN}','admin'), ('${DIRECTOR}','onboarding'), ('${PM}','onboarding'),
      ('${UTIL}','onboarding'), ('${OPS}','manager'), ('${OTHER_PM}','onboarding');
    INSERT INTO public.directors VALUES ('${DIRECTOR}');
    INSERT INTO public.functional_role_members VALUES ('utilities', '${UTIL}');
    INSERT INTO public.profiles VALUES ('${PM}', 'Project Manager Person', 'pm@example.test'), ('${UTIL}', 'Utilities Person', 'u@example.test');
    INSERT INTO public.properties(id) VALUES ('${HOME}'), ('${NEW_HOME}');
    INSERT INTO public.onboarding_projects(property_id, project_manager) VALUES ('${HOME}', '${PM}'), ('${NEW_HOME}', '${OTHER_PM}');
  `);
  await db.exec(readFileSync(`${DIR}/apply.sql`, "utf8"));
});

describe("plan catch-up: Mark done", () => {
  it("Earlier on an owner approval Task records it approved outside Resolve and reaches no homeowner", async () => {
    const a = await task({ title: "Share the floor plans with the owner", requires_owner_approval: true, owner_approval_status: "not_required", owner_dependency: "business_decision" });
    const b = await task({ title: "Order the welcome book", sort_order: 1 });
    await as(PM);
    const oct22 = await daysAgo(21);
    const preview = await done([a, b], "", oct22, true);
    expect(preview.ready.length).toBe(2);
    expect(preview.approvedOutside.map((x) => x.title)).toEqual(["Share the floor plans with the owner"]);
    const out = await done([a, b], "Owner approved by text on the call", oct22);
    expect(out.completed).toBe(2);
    const row = await one("SELECT status, owner_approval_status, evidence_note, completed_by, (completed_at AT TIME ZONE 'America/Chicago')::date::text d FROM public.onboarding_tasks WHERE id=$1", [a]);
    expect(row.status).toBe("complete");
    expect(row.owner_approval_status).toBe("approved");
    expect(row.completed_by).toBe(PM);
    expect(row.d).toBe(oct22);
    expect(row.evidence_note).toContain("Approved outside Resolve: Owner approved by text on the call");
    const ev = await one("SELECT kind, detail, actor FROM public.onboarding_project_events WHERE kind='owner_decision'");
    expect(ev).toEqual({ kind: "owner_decision", detail: "Approved outside Resolve: Owner approved by text on the call", actor: PM });
    expect(Number((await one("SELECT count(*) n FROM public.approvals")).n)).toBe(0);
    expect(await ownerReached()).toBe(0);
  });

  it("with Today an owner approval Task is listed as not marked and the others save", async () => {
    const a = await task({ title: "Mood boards", requires_owner_approval: true });
    const b = await task({ title: "Order towels", sort_order: 1 });
    await as(PM);
    const out = await done([a, b], "Receipt is in the home folder");
    expect(out.completed).toBe(1);
    expect(out.held).toEqual([{ taskId: a, title: "Mood boards", reason: "Needs the homeowner's approval first." }]);
    expect((await one("SELECT status FROM public.onboarding_tasks WHERE id=$1", [a])).status).toBe("open");
  });

  it("Earlier is refused for an approval the homeowner was already asked about in Resolve", async () => {
    const a = await task({ title: "Mood boards", requires_owner_approval: true, owner_approval_status: "pending" });
    await db.query("INSERT INTO public.approvals(entity_type, entity_id, property_id, status) VALUES ('onboarding_task', $1, $2, 'pending')", [a, HOME]);
    await db.exec("DELETE FROM public.owner_notifications; DELETE FROM public.email_log;");
    await as(PM);
    const out = await done([a], "Owner said yes by phone", await daysAgo(3));
    expect(out.completed).toBe(0);
    expect(out.held[0].reason).toBe("Already sent to the homeowner. Record their answer on the Task.");
  });

  it("proof note is required, at least 5 characters, and Earlier stays within two years", async () => {
    const a = await task({ title: "A" });
    await as(PM);
    expect(await fails(done([a], "ok"))).toContain("at least 5 characters");
    expect(await fails(done([a], "Proof in folder", await daysAgo(731)))).toContain("last two years");
  });

  it("covered owner cards: listed before saving, then marked covered and never sent", async () => {
    const step = "00000000-0000-4000-8000-0000000000c1";
    const a = await task({ title: "Pick the smart lock", template_task_id: step });
    const card = (await one("INSERT INTO public.ao_library_cards(code, title, linked_template_task_ids) VALUES ('C12', 'Choose your smart lock', ARRAY[$1]::uuid[]) RETURNING id", [step])).id;
    const review = (await one("INSERT INTO public.owner_reviews(title, status) VALUES ('Choose your smart lock', 'prepared') RETURNING id")).id;
    await db.query("INSERT INTO public.ao_home_plan_settings VALUES ($1, true)", [HOME]);
    const pc = (await one("INSERT INTO public.ao_home_plan_cards(property_id, card_id, join_outcome, linked_task_id, owner_review_id) VALUES ($1,$2,'locked',$3,$4) RETURNING id", [HOME, card, a, review])).id;
    await as(PM);
    const preview = await done([a], "", null, true);
    expect(preview.covered.map((c) => c.title)).toEqual(["Choose your smart lock"]);
    const out = await done([a], "Lock installed, photo in SharePoint");
    expect(out.covered.map((c) => c.title)).toEqual(["Choose your smart lock"]);
    const row = await one("SELECT join_outcome, unlocked_at, covered_reason, covered_item_id FROM public.ao_home_plan_cards WHERE id=$1", [pc]);
    expect(row).toEqual({ join_outcome: "already_covered", unlocked_at: null, covered_reason: "done_outside_resolve", covered_item_id: a });
    expect((await one("SELECT status FROM public.owner_reviews WHERE id=$1", [review])).status).toBe("prepared");
    expect(await ownerReached()).toBe(0);
  });

  it("covered owner cards: a card on the plan with no linked Task is matched through its template step (as on the live plan)", async () => {
    const step = "00000000-0000-4000-8000-0000000000c3";
    const a = await task({ title: "Order the welcome book", template_task_id: step });
    const card = (await one("INSERT INTO public.ao_library_cards(code, title, linked_template_task_ids) VALUES ('C14', 'Your welcome book', ARRAY[$1]::uuid[]) RETURNING id", [step])).id;
    await db.query("INSERT INTO public.ao_home_plan_settings VALUES ($1, true)", [HOME]);
    const pc = (await one("INSERT INTO public.ao_home_plan_cards(property_id, card_id, join_outcome, linked_task_id) VALUES ($1,$2,'locked',NULL) RETURNING id", [HOME, card])).id;
    await as(PM);
    expect((await done([a], "", null, true)).covered.map((c) => c.title)).toEqual(["Your welcome book"]);
    const out = await done([a], "Book ordered, receipt in folder");
    expect(out.batchId).toBeTruthy();
    expect(await one("SELECT join_outcome, covered_item_id FROM public.ao_home_plan_cards WHERE id=$1", [pc])).toEqual({ join_outcome: "already_covered", covered_item_id: a });
    expect((await db.query("SELECT public.undo_onboarding_task_batch($1)", [out.batchId])).rows.length).toBe(1);
    expect(await one("SELECT join_outcome, covered_item_id FROM public.ao_home_plan_cards WHERE id=$1", [pc])).toEqual({ join_outcome: "locked", covered_item_id: null });
    expect(await ownerReached()).toBe(0);
  });

  it("covered owner cards on a home whose plan has not started are listed and count as covered", async () => {
    const step = "00000000-0000-4000-8000-0000000000c2";
    const a = await task({ title: "Utilities set up", template_task_id: step });
    await db.query("INSERT INTO public.ao_library_cards(code, title, linked_template_task_ids) VALUES ('C30', 'Set up utilities', ARRAY[$1]::uuid[])", [step]);
    await db.query("INSERT INTO public.test_programs(property_id) VALUES ($1)", [HOME]);
    await as(PM);
    expect((await done([a], "", null, true)).covered.map((c) => [c.title, c.onPlan])).toEqual([["Set up utilities", false]]);
    await done([a], "Accounts confirmed by email");
    expect((await one("SELECT outcome FROM private.ao_plan_outcomes($1)", [HOME])).outcome).toBe("already_covered");
  });

  it("skip and save: blocked Tasks are listed, the rest save, and a refused Task keeps nothing", async () => {
    const step = "00000000-0000-4000-8000-0000000000c3";
    const ok = await task({ title: "Fine", sort_order: 1 });
    const blocked = await task({ title: "Blocked one", blocker: "Waiting on HOA", sort_order: 2 });
    const bz = await task({ title: "Work order: Paint", sort_order: 3 });
    const boom = await task({ title: "Explodes", sort_order: 4, template_task_id: step });
    await db.query("INSERT INTO public.breezeway_outbound_tasks(onboarding_task_id, status) VALUES ($1, 'synced')", [bz]);
    const card = (await one("INSERT INTO public.ao_library_cards(code, title, linked_template_task_ids) VALUES ('C40', 'Card', ARRAY[$1]::uuid[]) RETURNING id", [step])).id;
    const pc = (await one("INSERT INTO public.ao_home_plan_cards(property_id, card_id, join_outcome, linked_task_id) VALUES ($1,$2,'locked',$3) RETURNING id", [HOME, card, boom])).id;
    await as(PM);
    const out = await done([ok, blocked, bz, boom], "Proof in SharePoint");
    expect(out.completed).toBe(1);
    expect(out.held.map((h) => [h.title, h.reason])).toEqual([
      ["Blocked one", "Blocked: Waiting on HOA"],
      ["Work order: Paint", "A Breezeway work order was already sent for it."],
      ["Explodes", "This step needs review before it is done."],
    ]);
    expect((await one("SELECT status FROM public.onboarding_tasks WHERE id=$1", [boom])).status).toBe("open");
    expect((await one("SELECT join_outcome FROM public.ao_home_plan_cards WHERE id=$1", [pc])).join_outcome).toBe("locked");
    expect(Number((await one("SELECT count(*) n FROM public.audit_log WHERE action='onboarding_task_bulk_completed'")).n)).toBe(1);
  });
});

describe("plan catch-up: Not needed, Assign, Change due date, Reopen", () => {
  it("Not needed uses the existing Void with the reason, keeps the owner card from being sent, and logs it", async () => {
    const step = "00000000-0000-4000-8000-0000000000c4";
    const a = await task({ title: "HOA approval", template_task_id: step });
    const fin = await task({ title: "Finished", status: "complete", completed_by: PM, completed_at: "2026-10-01T12:00:00Z", sort_order: 1 });
    const card = (await one("INSERT INTO public.ao_library_cards(code, title, linked_template_task_ids) VALUES ('C50', 'HOA card', ARRAY[$1]::uuid[]) RETURNING id", [step])).id;
    const pc = (await one("INSERT INTO public.ao_home_plan_cards(property_id, card_id, join_outcome, linked_task_id) VALUES ($1,$2,'locked',$3) RETURNING id", [HOME, card, a])).id;
    await as(PM);
    expect(await fails(act([a], "not_needed", { reason: "" }))).toContain("reason");
    const out = await act([a, fin], "not_needed", { reason: "No HOA" });
    expect(out.done).toBe(1);
    expect(out.held[0].reason).toBe("Already done. Reopen it first.");
    const row = await one("SELECT archived_at IS NOT NULL a, exception_reason, archived_by FROM public.onboarding_tasks WHERE id=$1", [a]);
    expect(row).toEqual({ a: true, exception_reason: "Voided — not needed: No HOA", archived_by: PM });
    expect((await one("SELECT join_outcome, covered_reason FROM public.ao_home_plan_cards WHERE id=$1", [pc]))).toEqual({ join_outcome: "already_covered", covered_reason: "task_not_needed" });
    expect((await one("SELECT kind, detail, actor FROM public.onboarding_project_events WHERE kind='task_not_needed'"))).toEqual({ kind: "task_not_needed", detail: "No HOA", actor: PM });
    expect((await one("SELECT action, reason FROM public.audit_log WHERE entity_id=$1", [a]))).toEqual({ action: "onboarding_task_archived", reason: "No HOA" });
  });

  it("Assign to a person or a role and Change due date are logged on each Task with who", async () => {
    const a = await task({ title: "A", assigned_seat: "onboarding_project_manager" });
    await as(PM);
    await act([a], "assign", { person: UTIL });
    expect((await one("SELECT assigned_to FROM public.onboarding_tasks WHERE id=$1", [a])).assigned_to).toBe(UTIL);
    await act([a], "assign", { role: "utilities" });
    expect(await one("SELECT assigned_to, assigned_seat FROM public.onboarding_tasks WHERE id=$1", [a])).toEqual({ assigned_to: null, assigned_seat: "utilities" });
    await act([a], "due_date", { due: "2026-12-01" });
    expect(await one("SELECT due_on::text d, due_on_overridden o, due_on_source s FROM public.onboarding_tasks WHERE id=$1", [a])).toEqual({ d: "2026-12-01", o: true, s: "manual" });
    const kinds = (await db.query("SELECT kind, actor, new_value FROM public.onboarding_project_events ORDER BY created_at, kind")).rows.map((r) => [r.kind, r.actor, r.new_value]);
    expect(kinds).toContainEqual(["task_assigned", PM, "Utilities Person"]);
    expect(kinds).toContainEqual(["task_due_changed", PM, "Dec 01, 2026"]);
    expect(await fails(act([a], "assign", { person: OPS }))).toContain("onboarding team");
  });

  it("Reopen keeps the existing rule: Admin, Director of Onboarding or the person who finished it", async () => {
    const a = await task({ title: "Done by PM", status: "complete", completed_by: PM, completed_at: "2026-10-01T12:00:00Z" });
    const b = await task({ title: "Done by director", status: "complete", completed_by: DIRECTOR, completed_at: "2026-10-01T12:00:00Z", sort_order: 1 });
    await as(PM);
    const out = await act([a, b], "reopen", { reason: "Wrong home" });
    expect(out.done).toBe(1);
    expect(out.held[0].reason).toBe("Only an Admin, the Director of Onboarding or the person who finished it can reopen it.");
    await as(DIRECTOR);
    expect((await act([b], "reopen", { reason: "Wrong home" })).done).toBe(1);
  });
});

describe("plan catch-up: Undo", () => {
  it("restores exactly those Tasks, their approval state and covered cards, once, within 10 minutes", async () => {
    const step = "00000000-0000-4000-8000-0000000000c5";
    const a = await task({ title: "Approval", requires_owner_approval: true, owner_approval_status: "not_required", template_task_id: step });
    const b = await task({ title: "Plain", sort_order: 1, evidence_note: "Earlier note" });
    const untouched = await task({ title: "Not selected", sort_order: 2 });
    const card = (await one("INSERT INTO public.ao_library_cards(code, title, linked_template_task_ids) VALUES ('C60', 'Card', ARRAY[$1]::uuid[]) RETURNING id", [step])).id;
    const pc = (await one("INSERT INTO public.ao_home_plan_cards(property_id, card_id, join_outcome, linked_task_id) VALUES ($1,$2,'locked',$3) RETURNING id", [HOME, card, a])).id;
    const before = (await db.query("SELECT id, status, owner_approval_status, evidence_note, completed_at, completed_by FROM public.onboarding_tasks ORDER BY sort_order")).rows;
    await as(PM);
    const out = await done([a, b], "Signed copy in SharePoint", await daysAgo(5));
    expect(out.completed).toBe(2);
    const back = await undo(out.batchId);
    expect(back.restored.length).toBe(2);
    expect(back.cards).toBe(1);
    expect((await db.query("SELECT id, status, owner_approval_status, evidence_note, completed_at, completed_by FROM public.onboarding_tasks ORDER BY sort_order")).rows).toEqual(before);
    expect((await one("SELECT join_outcome, covered_reason FROM public.ao_home_plan_cards WHERE id=$1", [pc]))).toEqual({ join_outcome: "locked", covered_reason: null });
    expect(Number((await one("SELECT count(*) n FROM public.onboarding_project_events WHERE kind='task_change_undone'")).n)).toBe(2);
    expect(Number((await one("SELECT count(*) n FROM public.audit_log WHERE action='onboarding_task_batch_undone'")).n)).toBe(2);
    expect(await fails(undo(out.batchId))).toContain("already undone");
    expect(untouched).toBeTruthy();
  });

  it("refuses after 10 minutes and leaves a Task that changed since", async () => {
    const a = await task({ title: "A" });
    const b = await task({ title: "B", sort_order: 1 });
    await as(PM);
    const out = await act([a, b], "due_date", { due: "2026-12-10" });
    await db.query("UPDATE public.onboarding_tasks SET due_on = '2026-12-20', updated_at = now() + interval '1 second' WHERE id=$1", [b]);
    const back = await undo(out.batchId);
    expect(back.restored.map((r) => r.title)).toEqual(["A"]);
    expect(back.held[0].reason).toBe("Changed since. Left as it is.");
    const later = await act([a], "due_date", { due: "2026-12-11" });
    await db.query("UPDATE public.onboarding_task_batches SET undo_until = now() - interval '1 second' WHERE id=$1", [later.batchId]);
    expect(await fails(undo(later.batchId))).toContain("10 minutes");
  });

  it("someone else cannot undo another person's save", async () => {
    const a = await task({ title: "A", assigned_seat: "utilities" });
    await as(PM);
    const out = await act([a], "due_date", { due: "2026-12-10" });
    await as(UTIL);
    expect(await fails(undo(out.batchId))).toContain("Only the person who saved this");
  });
});

describe("plan catch-up: who may use it (enforced in the database)", () => {
  it("Operations roles cannot use it at all", async () => {
    const a = await task({ title: "A" });
    await as(OPS);
    expect(await fails(done([a], "Proof in folder"))).toContain("Only onboarding staff");
    expect(await fails(act([a], "due_date", { due: "2026-12-01" }))).toContain("Only onboarding staff");
  });

  it("Utilities only on Tasks assigned to them or their role; a Project Manager only on their own homes", async () => {
    const mine = await task({ title: "Utilities step", assigned_seat: "utilities" });
    const theirs = await task({ title: "PM step", assigned_seat: "onboarding_project_manager", sort_order: 1 });
    const direct = await task({ title: "Given to utilities person", assigned_to: UTIL, sort_order: 2 });
    await as(UTIL);
    const out = await done([mine, theirs, direct], "Accounts open, confirmation in email");
    expect(out.ready.map((r) => r.title)).toEqual(["Utilities step", "Given to utilities person"]);
    expect(out.held).toEqual([{ taskId: theirs, title: "PM step", reason: "Not assigned to you or your role." }]);
    await as(OTHER_PM);
    expect((await act([theirs], "due_date", { due: "2026-12-01" })).held[0].reason).toBe("Not assigned to you or your role.");
    await as(PM);
    expect((await act([theirs], "due_date", { due: "2026-12-01" })).done).toBe(1);
  });

  it("Director of Onboarding and Admin act on every home", async () => {
    const a = await task({ title: "A", property_id: NEW_HOME });
    for (const who of [DIRECTOR, ADMIN]) {
      await as(who);
      expect((await one("SELECT public.plan_catch_up_tasks($1, $2::uuid[], 'due_date', NULL, NULL, NULL, '2026-12-01') AS r", [NEW_HOME, [a]])).r.done).toBe(1);
    }
  });
});

describe("plan catch-up: undo file", () => {
  it("puts the Nov 12 bulk complete back and removes the new functions, keeping the receipts", async () => {
    await db.exec(readFileSync(`${DIR}/apply.undo.sql`, "utf8"));
    const fns = (await db.query("SELECT proname FROM pg_proc WHERE proname LIKE 'plan_catch_up%' OR proname = 'undo_onboarding_task_batch'")).rows;
    expect(fns).toEqual([]);
    expect((await one("SELECT to_regclass('public.onboarding_task_batches')::text t")).t).toBe("onboarding_task_batches");
    const def = (await one("SELECT prosrc FROM pg_proc WHERE proname='bulk_complete_onboarding_tasks'")).prosrc;
    expect(def).toContain("Nothing was completed. Untick these tasks first");
    await db.exec(readFileSync(`${DIR}/apply.sql`, "utf8"));
  });
});
