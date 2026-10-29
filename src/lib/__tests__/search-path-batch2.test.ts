import { beforeAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

// Isolated only: the four short-name functions return identical results before and after pinning search_path.
const dir = "docs/pending/security-batch2";
const names = ["expense_evidence_changed", "expense_split_ok", "str_report_owner_safe", "str_report_refs"];
const built = `'{"blockers":[1],"totals":{"underReview":1},"rows":[{"a":1,"internal":"x"},{"a":2,"internal":"y"}]}'::jsonb`;
const probes = [
  `SELECT private.expense_split_ok('[{"party":"owner","amount":5},{"party":"arha","amount":5}]', 10) v`,
  `SELECT private.expense_split_ok('[{"party":"owner","amount":5},{"party":"bad","amount":5}]', 10) v`,
  `SELECT private.expense_split_ok('[{"party":"owner","amount":10}]', 10) v`,
  `SELECT private.str_report_owner_safe(${built}, false) v`,
  `SELECT private.str_report_owner_safe('{"totals":{"underReview":0},"rows":[]}', false) v`,
  `SELECT private.str_report_refs(${built}) v`,
  `SELECT private.expense_evidence_changed(ROW('{a,b}','{}',false)::public.expenses, ROW('{b,a}','{}',false)::public.expenses) v`,
  `SELECT private.expense_evidence_changed(ROW('{a}','{p}',true)::public.expenses, ROW('{a}','{q}',true)::public.expenses) v`,
];
let db: PGlite;
const run = async () => {
  const out: unknown[] = [];
  for (const q of probes) out.push((await db.query<{ v: unknown }>(q)).rows[0]?.v);
  return out;
};

describe("Security batch 2 search_path pin, isolated", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`CREATE SCHEMA private; CREATE TABLE public.expenses(invoice_document_ids text[], photo_document_ids text[], photos_required boolean);`);
    for (const n of names) await db.exec(readFileSync(`${dir}/def_${n}.sql`, "utf8"));
  });
  it("returns the same results after SET search_path = public, pg_temp", async () => {
    const before = await run();
    expect(before).toEqual([true, false, false, before[3], before[4], ["x", "y"], false, true]);
    const apply = readFileSync(`${dir}/apply.sql`, "utf8").split("\n").filter((l) => names.some((n) => l.includes(`private.${n}(`)));
    expect(apply.length).toBe(4);
    for (const l of apply) await db.exec(l);
    const cfg = await db.query<{ c: string[] }>(`SELECT proconfig c FROM pg_proc WHERE proname = ANY($1)`, [names]);
    expect(cfg.rows.every((r) => r.c?.includes("search_path=public, pg_temp"))).toBe(true);
    expect(await run()).toEqual(before);
  });
});
