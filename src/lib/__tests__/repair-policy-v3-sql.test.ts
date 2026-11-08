// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * docs/pending/repair-policy-v3/ (Emily, Nov 7, 2026, punch list H1). The one database
 * function that reads the Maintenance Authority Policy numbers, run against a minimal
 * fixture. Nothing touches the real database.
 */
const DIR = "docs/pending/repair-policy-v3";
const read = (f: string) => readFileSync(`${DIR}/${f}`, "utf8");
const SUP = "00000000-0000-0000-0000-00000000000a";
const V2 = "ARHA Maintenance Authority Policy for Resolve — v2";
const V3 = "ARHA Maintenance Authority Policy for Resolve v3";

let db: PGlite;
let n = 0;
const id = () => `10000000-0000-0000-0000-${String(++n).padStart(12, "0")}`;

async function setPolicy(file: "v2" | "v3") {
  await db.exec(`DELETE FROM public.app_settings;
    INSERT INTO public.app_settings(key, value) VALUES ('maintenance_authority_policy',
    '{"version": "${V2}", "ownerApprovalThreshold": 350, "supervisorApprovalThreshold": 200}');`);
  if (file === "v3") await db.exec(read("02_policy_v3_value.sql"));
}

/** One vendor expense, optionally linked to a Work Order with the given approvals. */
async function decide(amount: number, wo?: { version?: string; owner?: boolean; supervisor?: boolean }) {
  const e = id();
  let approvalId = null;
  await db.query(`INSERT INTO public.expenses(id, expense_type, amount) VALUES ($1, 'vendor_service', $2)`, [e, amount]);
  if (wo) {
    const w = id();
    if (wo.owner) {
      approvalId = id();
      await db.query(`INSERT INTO public.approvals(id, status, approver_role, decided_at, entity_type, entity_id, amount)
        VALUES ($1, 'approved', 'owner', now(), 'work_order', $2, $3)`, [approvalId, w, amount]);
    }
    await db.query(
      `INSERT INTO public.work_orders(id, phase, policy_version, approval_status, approval_id, supervisor_approval_status, supervisor_approval_decided_by, authorized_amount)
       VALUES ($1, 'permanent', $2, $3, $4, $5, $6, $7)`,
      [w, wo.version ?? V3, wo.owner ? "approved" : "not_required", approvalId, wo.supervisor ? "approved" : "not_required", wo.supervisor ? SUP : null, amount],
    );
    await db.query(`INSERT INTO public.expense_links(expense_id, target_id, link_type) VALUES ($1, $2, 'work_order')`, [e, w]);
  }
  const r = await db.query(`SELECT private.expense_authorization_detail(x) AS d FROM public.expenses x WHERE id = $1`, [e]);
  return r.rows[0].d;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE SCHEMA private;
    CREATE TABLE public.app_settings(key text PRIMARY KEY, value jsonb, updated_at timestamptz DEFAULT now());
    CREATE TABLE public.expenses(id uuid PRIMARY KEY, expense_type text, amount numeric, approval_id uuid);
    CREATE TABLE public.work_orders(id uuid PRIMARY KEY, phase text, emergency_reason text, contractual_exception boolean DEFAULT false,
      policy_version text, approval_status text, approval_id uuid, supervisor_approval_status text, supervisor_approval_decided_by uuid,
      authorized_amount numeric, authorization_stale boolean DEFAULT false);
    CREATE TABLE public.expense_links(expense_id uuid, target_id uuid, link_type text, created_at timestamptz DEFAULT now());
    CREATE TABLE public.approvals(id uuid PRIMARY KEY, status text, approver_role text, approver_id uuid, decided_at timestamptz,
      entity_type text, entity_id uuid, amount numeric);
    CREATE FUNCTION private.can_approve_spending(_uid uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT _uid = '${SUP}'::uuid $$;
  `);
});
afterAll(async () => db?.close());

describe("staged files", () => {
  it("the undo restores the live definition exactly", () => {
    const live = read("live-capture/expense_authorization_detail.sql").trim();
    expect(read("01_expense_authorization_v3.undo.sql")).toContain(live);
  });
  it("replaces only the one function that reads the numbers", () => {
    const staged = read("01_expense_authorization_v3.sql");
    expect(staged.match(/CREATE OR REPLACE FUNCTION/g)?.length).toBe(1);
    expect(staged).toContain("CREATE OR REPLACE FUNCTION private.expense_authorization_detail(e public.expenses)");
    expect(staged).not.toMatch(/\b(GRANT|REVOKE|DROP|ALTER|INSERT|UPDATE|DELETE)\b/);
  });
});

describe("before the policy value changes, v2 decides exactly as today", () => {
  beforeAll(async () => {
    await db.exec(read("live-capture/expense_authorization_detail.sql"));
    await setPolicy("v2");
  });
  const results: Record<string, unknown> = {};
  it("live copy under v2", async () => {
    for (const a of [199, 200, 350, 351]) results[a] = await decide(a);
    results["350-sup"] = await decide(350, { version: V2, supervisor: true });
    results["351-owner"] = await decide(351, { version: V2, owner: true });
  });
  it("staged copy under v2 gives the same answers", async () => {
    await db.exec(read("01_expense_authorization_v3.sql"));
    for (const a of [199, 200, 350, 351]) expect(await decide(a)).toEqual(results[a]);
    expect(await decide(350, { version: V2, supervisor: true })).toEqual(results["350-sup"]);
    expect(await decide(351, { version: V2, owner: true })).toEqual(results["351-owner"]);
    expect(results["350-sup"]).toMatchObject({ who: "supervisor", ok: true });
  });
});

describe("policy v3", () => {
  beforeAll(async () => {
    await db.exec(read("01_expense_authorization_v3.sql"));
    await setPolicy("v3");
  });
  it("$249.99 proceeds, cost recorded", async () => {
    expect(await decide(249.99)).toEqual({ required: false, ok: true, reason: "Under $250: it proceeds and the cost is recorded." });
  });
  it("$250 and $349.99 need the Operations Supervisor", async () => {
    expect(await decide(250)).toMatchObject({ required: true, ok: false, who: "supervisor" });
    expect(await decide(349.99)).toMatchObject({ required: true, ok: false, who: "supervisor" });
    expect(await decide(250, { supervisor: true })).toMatchObject({ ok: true, who: "supervisor" });
  });
  it("exactly $350 and $351 need the Operations Supervisor and the owner", async () => {
    for (const a of [350, 351]) {
      expect(await decide(a)).toMatchObject({ ok: false, who: "owner" });
      expect((await decide(a, {})).reason).toContain("must both approve");
      const ownerOnly = await decide(a, { owner: true });
      expect(ownerOnly).toMatchObject({ ok: false, who: "owner" });
      expect(ownerOnly.reason).toContain("Operations Supervisor");
      expect(await decide(a, { supervisor: true })).toMatchObject({ ok: false, who: "owner" });
      expect(await decide(a, { owner: true, supervisor: true })).toMatchObject({ ok: true, who: "owner" });
    }
  });
  it("a Work Order decided under v2 keeps its v2 result", async () => {
    expect(await decide(350, { version: V2, supervisor: true })).toMatchObject({ ok: true, who: "supervisor" });
    expect(await decide(351, { version: V2, owner: true })).toMatchObject({ ok: true, who: "owner" });
    expect(await decide(200, { version: V2 })).toMatchObject({ ok: false, who: "supervisor" });
  });
  it("the undo puts the v2 value back", async () => {
    await db.exec(read("02_policy_v3_value.undo.sql"));
    const r = await db.query(`SELECT value FROM public.app_settings`);
    expect(r.rows[0].value).toEqual({ version: V2, ownerApprovalThreshold: 350, supervisorApprovalThreshold: 200 });
  });
});
