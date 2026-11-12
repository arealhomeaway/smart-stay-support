// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

/**
 * The onboarding Send to Breezeway path with internal_work_orders OFF (register B1, Nov 12).
 * Runs the saved live guard private.refuse_internal_work_orders (docs/applied/breezeway-guard-onboarding-untied)
 * in an isolated PostgreSQL and inserts the outbound row as createOutboundTask does for an onboarding
 * Task. The earlier definition refuses that send: the fault this test would have caught.
 * Nothing touches the real database or Breezeway.
 */
const DIR = "docs/applied/breezeway-guard-onboarding-untied";
const LIVE = readFileSync(`${DIR}/live_refuse_internal_work_orders.sql`, "utf8");
const BEFORE = readFileSync(`${DIR}/before_refuse_internal_work_orders.sql`, "utf8");
const FIX = readFileSync("docs/pending/breezeway-guard-fix/01_refuse_internal_work_orders.sql", "utf8");
const FIX_UNDO = readFileSync("docs/pending/breezeway-guard-fix/undo/01_refuse_internal_work_orders.sql", "utf8");

const STUBS = `
CREATE SCHEMA private;
CREATE TABLE public.feature_flags(key text PRIMARY KEY, enabled boolean NOT NULL DEFAULT false);
INSERT INTO public.feature_flags VALUES ('internal_work_orders', false), ('onboarding_breezeway_send', true),
  ('breezeway_outbound', false);
CREATE TABLE public.breezeway_outbound_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_type text NOT NULL,
  ticket_id uuid, onboarding_task_id uuid, request_key text, title text, status text DEFAULT 'pending');
CREATE TABLE public.work_orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, is_demo boolean DEFAULT false);
`;
const TRIGGERS = `
CREATE TRIGGER work_orders_internal_switch BEFORE INSERT ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION private.refuse_internal_work_orders();
CREATE TRIGGER breezeway_outbound_internal_switch BEFORE INSERT ON public.breezeway_outbound_tasks
  FOR EACH ROW EXECUTE FUNCTION private.refuse_internal_work_orders();
`;
const TASK = "00000000-0000-4000-8000-0000000000f1";
const TICKET = "00000000-0000-4000-8000-0000000000e1";

async function db(def: string) {
  const pg = new PGlite();
  await pg.exec(STUBS + def + TRIGGERS);
  return pg;
}
const sendOnboarding = (pg) =>
  pg.query(
    `INSERT INTO public.breezeway_outbound_tasks(source_type, ticket_id, onboarding_task_id, request_key, title)
     VALUES ('onboarding_task', NULL, $1, $2, 'New House Setup - Final Inspection') RETURNING id`,
    [TASK, `onboarding-task-${TASK}`],
  );
const sendTicket = (pg) =>
  pg.query(`INSERT INTO public.breezeway_outbound_tasks(source_type, ticket_id, title) VALUES ('ticket', $1, 'Leak') RETURNING id`, [TICKET]);
const flag = (pg, key, on) => pg.query(`UPDATE public.feature_flags SET enabled = $2 WHERE key = $1`, [key, on]);

for (const [name, def] of [["live guard", LIVE], ["staged fix", FIX]] as const) {
  describe(`${name}: onboarding sends follow onboarding_breezeway_send only`, () => {
    let pg;
    beforeEach(async () => { pg = await db(def); });

    it("passes the onboarding send while internal_work_orders is off and the onboarding switch is on", async () => {
      expect((await sendOnboarding(pg)).rows).toHaveLength(1);
    });

    it("refuses the onboarding send when the onboarding switch is off", async () => {
      await flag(pg, "onboarding_breezeway_send", false);
      await expect(sendOnboarding(pg)).rejects.toThrow("Nothing is sent to Breezeway from Resolve for now");
    });

    it("still refuses a ticket send while internal_work_orders is off, even with the onboarding switch on", async () => {
      await expect(sendTicket(pg)).rejects.toThrow("Nothing is sent to Breezeway from Resolve for now");
    });

    it("lets ticket sends through only when internal_work_orders is on", async () => {
      await flag(pg, "internal_work_orders", true);
      expect((await sendTicket(pg)).rows).toHaveLength(1);
    });
  });
}

describe("the earlier guard is the fault this test catches", () => {
  it("refused the onboarding send with internal_work_orders off", async () => {
    const pg = await db(BEFORE);
    await expect(sendOnboarding(pg)).rejects.toThrow("Nothing is sent to Breezeway from Resolve for now");
  });
});

describe("Resolve work orders with internal_work_orders off", () => {
  it("staged fix: refuses a non-demo work order and allows a demo one, as before Nov 12", async () => {
    const pg = await db(FIX);
    await expect(pg.query(`INSERT INTO public.work_orders(title) VALUES ('x')`)).rejects.toThrow("Work orders are made in Breezeway");
    expect((await pg.query(`INSERT INTO public.work_orders(title, is_demo) VALUES ('x', true) RETURNING id`)).rows).toHaveLength(1);
  });

  it("live guard (reported, not changed): a demo work order now fails on the missing source_type field", async () => {
    const pg = await db(LIVE);
    await expect(pg.query(`INSERT INTO public.work_orders(title, is_demo) VALUES ('x', true)`)).rejects.toThrow(
      'record "new" has no field "source_type"',
    );
  });

  it("the staged undo restores exactly the live definition", () => {
    const body = (t: string) => t.slice(t.indexOf("CREATE OR REPLACE FUNCTION"));
    expect(body(FIX_UNDO)).toBe(body(LIVE));
  });
});

describe("repository copies", () => {
  it("saved files match their checksums", () => {
    for (const dir of [DIR, "docs/pending/breezeway-guard-fix"]) {
      for (const line of readFileSync(`${dir}/checksums.sha256`, "utf8").trim().split("\n")) {
        const [sum, file] = line.split(/\s+/);
        expect(createHash("sha256").update(readFileSync(`${dir}/${file}`)).digest("hex")).toBe(sum);
      }
    }
  });

  it("the app writes onboarding sends with source_type onboarding_task, the value the guard passes", () => {
    const outbound = readFileSync("src/lib/breezeway-outbound.server.ts", "utf8");
    const send = readFileSync("src/lib/onboarding-kati.functions.ts", "utf8");
    expect(outbound).toContain("source_type: input.sourceType,");
    const fn = send.slice(send.indexOf("export const sendOnboardingWorkOrderFn"));
    expect(fn.slice(0, fn.indexOf("export const", 10))).toContain('sourceType: "onboarding_task"');
  });
});
