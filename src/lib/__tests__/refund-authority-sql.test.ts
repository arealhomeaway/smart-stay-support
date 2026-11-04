import { beforeAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { RECOVERY_POLICY, ESCALATION_FLAGS } from "@/lib/recovery-policy";
import { MONETARY_ACTIONS, MULTI_NIGHT_ACTIONS, evaluateAuthority } from "@/lib/guest-recovery";

/**
 * Isolated PostgreSQL check of docs/pending/refund-authority. The live
 * guest_recovery checks are reproduced from the captured definitions; nothing
 * touches the real database.
 */
const DIR = "docs/pending/refund-authority";
const read = (f: string) => readFileSync(`${DIR}/${f}`, "utf8");
const guard = read("01_refund_authority_guard.sql");
let db: PGlite;

const TABLE = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE TABLE public.guest_recovery(
  id serial PRIMARY KEY,
  stage text NOT NULL DEFAULT 'reported',
  recovery_action text, proposed_amount numeric, approved_amount numeric, delivered_amount numeric,
  within_airbnb_policy boolean, escalation_flags text[] NOT NULL DEFAULT '{}',
  authority_level text, approval_authority text, approval_status text NOT NULL DEFAULT 'not_required',
  decision_reason text, outcome text, approved_by uuid, approved_at timestamptz, note text,
  CONSTRAINT guest_recovery_authority_level_check CHECK (authority_level IS NULL OR authority_level = ANY (ARRAY['self','supervisor','director','owner','emergency'])),
  CONSTRAINT guest_recovery_recovery_action_check CHECK (recovery_action IS NULL OR recovery_action = ANY (ARRAY['none','apology','mitigation','credit','partial_refund','full_refund','fee_waiver','shorten_stay','relocation']))
);`;

type Row = Record<string, unknown>;
async function insert(row: Row) {
  const keys = Object.keys(row);
  const res = await db.query<{ id: number }>(
    `INSERT INTO public.guest_recovery(${keys.join(",")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")}) RETURNING id`,
    keys.map((k) => row[k]),
  );
  return res.rows[0]!.id;
}
async function rejects(fn: () => Promise<unknown>, text: string) {
  let msg = "";
  try {
    await fn();
  } catch (e) {
    msg = (e as Error).message;
  }
  expect(msg).toContain(text);
}
const required = async (action: string, amount: number | null, within: boolean | null, flags: string[] = []) =>
  (
    await db.query<{ r: string }>("SELECT public.recovery_required_authority($1,$2,$3,$4) r", [
      action,
      amount,
      within,
      flags,
    ])
  ).rows[0]!.r;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(TABLE);
  await db.exec(read("02_allow_app_recovery_values.sql"));
  await db.exec(guard);
});

describe("pending SQL matches the app rule (one source)", () => {
  it("limits equal recovery-policy.ts", () => {
    expect(guard).toContain(`_pc_ceiling CONSTANT numeric := ${RECOVERY_POLICY.pcApprovalCeiling};`);
    expect(guard).toContain(
      `_supervisor_ceiling CONSTANT numeric := ${RECOVERY_POLICY.supervisorApprovalCeiling};`,
    );
  });
  const list = (name: string) =>
    [...guard.slice(guard.indexOf(name)).split("];")[0]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
  it("Director flags equal the app flag list", () => {
    expect(list("_director_flags")).toEqual([...ESCALATION_FLAGS].sort());
  });
  it("remedy lists equal the app lists", () => {
    expect(list("_monetary_actions")).toEqual([...MONETARY_ACTIONS].sort());
    expect(list("_multi_night_actions")).toEqual([...MULTI_NIGHT_ACTIONS].sort());
  });
  it("database and screen agree at every boundary and flag", async () => {
    const cases: [string, number | null, boolean | null, string[]][] = [
      ["partial_refund", 500, true, []],
      ["partial_refund", 500.01, true, []],
      ["partial_refund", 1500, true, []],
      ["partial_refund", 1500.01, true, []],
      ["credit", 20, null, []],
      ["full_refund", 20, true, []],
      ["shorten_stay", null, true, []],
      ["relocation", 20, true, []],
      ["credit", 20, false, []],
      ...ESCALATION_FLAGS.map((f) => ["credit", 20, true, [f]] as [string, number, boolean, string[]]),
    ];
    for (const [a, amt, w, f] of cases) {
      const ui = evaluateAuthority({
        recovery_action: a,
        proposed_amount: amt,
        within_airbnb_policy: w,
        escalation_flags: f,
      }).level;
      expect(await required(a, amt, w, f)).toBe(ui);
    }
  });
});

describe("database guard", () => {
  it("rejects a refund saved without a reason", async () => {
    await rejects(
      () => insert({ recovery_action: "partial_refund", proposed_amount: 40 }),
      "short written reason",
    );
    await rejects(
      () => insert({ recovery_action: "credit", proposed_amount: 40, decision_reason: "   " }),
      "short written reason",
    );
  });

  it("allows a coordinator refund of exactly $500 with a reason", async () => {
    const id = await insert({
      recovery_action: "partial_refund",
      proposed_amount: 500,
      within_airbnb_policy: true,
      authority_level: "pc",
      decision_reason: "Pool heater out two days",
    });
    expect(id).toBeGreaterThan(0);
  });

  it("$500.01 cannot be approved at coordinator level", async () => {
    await rejects(
      () =>
        insert({
          recovery_action: "partial_refund",
          proposed_amount: 500.01,
          within_airbnb_policy: true,
          approval_status: "approved",
          approval_authority: "pc",
          decision_reason: "x",
        }),
      "needs Supervisor approval",
    );
    expect(
      await insert({
        recovery_action: "partial_refund",
        proposed_amount: 500.01,
        within_airbnb_policy: true,
        approval_status: "approved",
        approval_authority: "supervisor",
        decision_reason: "x",
      }),
    ).toBeGreaterThan(0);
  });

  it("$1,500 is Supervisor, $1,500.01 needs the Director", async () => {
    expect(
      await insert({
        recovery_action: "partial_refund",
        proposed_amount: 1500,
        within_airbnb_policy: true,
        approval_status: "pending",
        approval_authority: "supervisor",
        decision_reason: "x",
      }),
    ).toBeGreaterThan(0);
    await rejects(
      () =>
        insert({
          recovery_action: "partial_refund",
          proposed_amount: 1500.01,
          within_airbnb_policy: true,
          approval_status: "pending",
          approval_authority: "supervisor",
          decision_reason: "x",
        }),
      "needs Director approval",
    );
  });

  it("every Director flag blocks a Supervisor approval on a small amount", async () => {
    for (const flag of ESCALATION_FLAGS) {
      await rejects(
        () =>
          insert({
            recovery_action: "credit",
            proposed_amount: 20,
            within_airbnb_policy: true,
            escalation_flags: [flag],
            approval_status: "approved",
            approval_authority: "supervisor",
            decision_reason: "x",
          }),
        "needs Director approval",
      );
    }
  });

  it("an unapproved Director case cannot be delivered or move on", async () => {
    const id = await insert({
      recovery_action: "full_refund",
      proposed_amount: 300,
      within_airbnb_policy: true,
      authority_level: "director",
      decision_reason: "x",
    });
    await rejects(
      () => db.query("UPDATE public.guest_recovery SET delivered_amount = 300 WHERE id = $1", [id]),
      "Request approval first",
    );
    await rejects(
      () => db.query("UPDATE public.guest_recovery SET stage = 'guest_offered' WHERE id = $1", [id]),
      "Request approval first",
    );
    await db.query("UPDATE public.guest_recovery SET outcome='withdrawn', stage='closed' WHERE id=$1", [id]);
  });

  it("raising an approved amount past the approver's level is rejected", async () => {
    const id = await insert({
      recovery_action: "credit",
      proposed_amount: 600,
      within_airbnb_policy: true,
      approval_status: "approved",
      approval_authority: "supervisor",
      decision_reason: "x",
    });
    await rejects(
      () => db.query("UPDATE public.guest_recovery SET proposed_amount = 1600 WHERE id = $1", [id]),
      "needs Director approval",
    );
  });

  it("non-monetary recovery and unrelated edits pass", async () => {
    const id = await insert({ recovery_action: "apology", authority_level: "pc" });
    await db.query("UPDATE public.guest_recovery SET note = 'called guest' WHERE id = $1", [id]);
  });

  it("existing rows that break the rule are not touched by unrelated edits", async () => {
    await db.exec("ALTER TABLE public.guest_recovery DISABLE TRIGGER guard_recovery_authority_trg");
    const id = await insert({ recovery_action: "credit", proposed_amount: 900 });
    await db.exec("ALTER TABLE public.guest_recovery ENABLE TRIGGER guard_recovery_authority_trg");
    await db.query("UPDATE public.guest_recovery SET note = 'n' WHERE id = $1", [id]);
  });

  it("anon and signed-in users cannot call the functions directly", async () => {
    for (const role of ["anon", "authenticated"]) {
      const r = await db.query<{ a: boolean; b: boolean }>(
        `SELECT has_function_privilege($1,'public.recovery_required_authority(text,numeric,boolean,text[])','EXECUTE') a,
                has_function_privilege($1,'public.guard_recovery_authority()','EXECUTE') b`,
        [role],
      );
      expect(r.rows[0]).toEqual({ a: false, b: false });
    }
  });

  it("undo files remove everything and restore the checks", async () => {
    await db.exec("DELETE FROM public.guest_recovery");
    await db.exec(read("01_undo_refund_authority_guard.sql"));
    await db.exec(read("02_undo_allow_app_recovery_values.sql"));
    const fns = await db.query(
      "SELECT 1 FROM pg_proc WHERE proname IN ('recovery_required_authority','guard_recovery_authority')",
    );
    expect(fns.rows.length).toBe(0);
    await rejects(() => insert({ authority_level: "pc" }), "authority_level_check");
    // reapply cleanly after undo
    await db.exec(read("02_allow_app_recovery_values.sql").replace(/DO \$chk\$[\s\S]*?\$chk\$;/, ""));
    await db.exec(guard);
  });
});
