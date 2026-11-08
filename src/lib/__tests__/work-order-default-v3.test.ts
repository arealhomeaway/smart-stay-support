// @ts-nocheck: isolated SQL fixture.
import { expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { MAINTENANCE_POLICY_VERSION } from "../maintenance-policy";

/**
 * Repair policy v3, part 3 (Emily, answer E2): a new Work Order saved without a version is
 * stamped v3 by the database; Work Orders already stamped v2 keep v2. Nothing touches the real database.
 */
const DIR = "docs/pending/repair-policy-v3";
const V2 = "ARHA Maintenance Authority Policy for Resolve — v2";

it("the staged default is the app's v3 text, and the undo restores v2 exactly", () => {
  const staged = readFileSync(`${DIR}/03_work_order_default_v3.sql`, "utf8");
  const undo = readFileSync(`${DIR}/03_work_order_default_v3.undo.sql`, "utf8");
  expect(MAINTENANCE_POLICY_VERSION).toBe("ARHA Maintenance Authority Policy for Resolve v3");
  expect(staged).toContain(`SET DEFAULT '${MAINTENANCE_POLICY_VERSION}';`);
  expect(undo).toContain(`SET DEFAULT '${V2}'::text;`);
  // Only the column default changes.
  const statements = staged.split("\n").filter((l) => l.trim() && !l.startsWith("--"));
  expect(statements).toEqual([`ALTER TABLE public.work_orders ALTER COLUMN policy_version SET DEFAULT '${MAINTENANCE_POLICY_VERSION}';`]);
});

it("new Work Orders default to v3, existing ones keep v2, and undo puts the v2 default back", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE public.work_orders(id serial PRIMARY KEY, title text, policy_version text DEFAULT '${V2}'::text);
      INSERT INTO public.work_orders(title) VALUES ('old one'),('old two');`);
    await db.exec(readFileSync(`${DIR}/03_work_order_default_v3.sql`, "utf8"));
    await db.exec("INSERT INTO public.work_orders(title) VALUES ('new')");
    const rows = (await db.query<{ title: string; policy_version: string }>("SELECT title, policy_version FROM work_orders ORDER BY id")).rows;
    expect(rows).toEqual([
      { title: "old one", policy_version: V2 },
      { title: "old two", policy_version: V2 },
      { title: "new", policy_version: MAINTENANCE_POLICY_VERSION },
    ]);
    await db.exec(readFileSync(`${DIR}/03_work_order_default_v3.undo.sql`, "utf8"));
    await db.exec("INSERT INTO public.work_orders(title) VALUES ('after undo')");
    expect((await db.query<{ policy_version: string }>("SELECT policy_version FROM work_orders WHERE title='after undo'")).rows[0]!.policy_version).toBe(V2);
  } finally {
    await db.close();
  }
});
