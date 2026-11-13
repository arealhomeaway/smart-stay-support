// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Practice run of docs/pending/owner-plan-email-resend (Nov 13) on an isolated copy: two failed plan
 * ready emails go back to waiting once; nothing else changes. Fake rows with the live ids only.
 */
const DIR = "docs/pending/owner-plan-email-resend";
const A = "161270b0-8c30-4f32-8884-22a90275ad90";
const B = "17890bf3-7335-4345-a746-8633013a2d74";
const OTHER = "00000000-0000-4000-8000-0000000000f9";
const PROG_A = "2d05252c-dd0d-4473-adf8-b979fc5b5216";
const PROG_B = "814b9c32-0910-499b-b4ac-2c7fc026569b";
let db: PGlite;
const one = async (sql: string, args: unknown[] = []) => (await db.query(sql, args)).rows[0];
const status = async (id: string) => (await one("SELECT email_status s FROM public.owner_notifications WHERE id = $1", [id])).s;
const fails = async (p: Promise<unknown>) => {
  try { await p; } catch (e) { return String((e as Error).message); }
  throw new Error("expected a refusal");
};
const file = (f: string) => readFileSync(`${DIR}/${f}`, "utf8");

beforeEach(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE TABLE public.owner_notifications(id uuid PRIMARY KEY, program_id uuid, kind text NOT NULL, email_status text NOT NULL,
      is_demo boolean NOT NULL DEFAULT false, delivery_error text, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE public.audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid, actor_label text, action text NOT NULL,
      entity_type text NOT NULL, entity_id uuid, entity_label text, reason text, before_value jsonb, after_value jsonb, created_at timestamptz NOT NULL DEFAULT now());
    INSERT INTO public.owner_notifications(id, program_id, kind, email_status, delivery_error, created_at) VALUES
      ('${A}', '${PROG_A}', 'ao_plan_ready', 'failed', 'Mail provider [502]', '2026-11-12 23:51:32+00'),
      ('${B}', '${PROG_B}', 'ao_plan_ready', 'failed', 'Mail provider [504]', '2026-11-13 00:21:54+00'),
      ('${OTHER}', '${PROG_A}', 'opportunity_sent', 'failed', 'Mail provider [502]', '2026-11-12 20:00:00+00');
  `);
});

describe("the resend", () => {
  it("sets only the two plan ready emails to waiting, keeps their old errors, logs once", async () => {
    await db.exec(file("00_preflight.sql"));
    await db.exec(file("apply.sql"));
    expect([await status(A), await status(B), await status(OTHER)]).toEqual(["pending", "pending", "failed"]);
    expect((await one("SELECT delivery_error e FROM public.owner_notifications WHERE id = $1", [A])).e).toBe("Mail provider [502]");
    expect(Number((await one("SELECT count(*) n FROM public.audit_log WHERE action = 'owner_email_resend_queued'")).n)).toBe(1);
  });

  it("happens once: a second run is stopped by the preflight and by the apply itself", async () => {
    await db.exec(file("apply.sql"));
    expect(await fails(db.exec(file("00_preflight.sql")))).toContain("found 0");
    expect(await fails(db.exec(file("apply.sql")))).toContain("Changed since the check");
    expect(Number((await one("SELECT count(*) n FROM public.audit_log")).n)).toBe(1);
  });

  it("stops with nothing changed if one email already moved on", async () => {
    await db.exec(`UPDATE public.owner_notifications SET email_status = 'sent' WHERE id = '${B}'`);
    expect(await fails(db.exec(file("apply.sql")))).toContain("1 of 2");
    expect(await status(A)).toBe("failed");
  });

  it("the preflight stops if a later plan ready email already reached the homeowner", async () => {
    await db.exec(`INSERT INTO public.owner_notifications(id, program_id, kind, email_status, created_at)
      VALUES (gen_random_uuid(), '${PROG_A}', 'ao_plan_ready', 'sent', '2026-11-13 10:00:00+00')`);
    expect(await fails(db.exec(file("00_preflight.sql")))).toContain("later plan ready email");
  });

  it("the undo sets any still waiting back to failed and leaves a sent one sent", async () => {
    await db.exec(file("apply.sql"));
    await db.exec(`UPDATE public.owner_notifications SET email_status = 'sent' WHERE id = '${A}'`);
    await db.exec(file("apply.undo.sql"));
    expect([await status(A), await status(B)]).toEqual(["sent", "failed"]);
  });
});
