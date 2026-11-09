// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Isolated PostgreSQL check of docs/pending/databases/01_databases.sql (applied
 * as the matching drizzle migration). Tables are stubbed; a stand-in guard on
 * claims proves the existing claim guards still run. Nothing touches the real
 * database.
 */
const STEP = readFileSync("docs/pending/databases/01_databases.sql", "utf8");
const PC = "00000000-0000-4000-8000-000000000001";
const SUP = "00000000-0000-4000-8000-000000000002";
const FIN = "00000000-0000-4000-8000-000000000003";
const ONB = "00000000-0000-4000-8000-000000000004";
const DIR = "00000000-0000-4000-8000-000000000005";
const ADMIN = "00000000-0000-4000-8000-000000000006";
const CLAIM = "00000000-0000-4000-8000-0000000000c1";
const REFUND = "00000000-0000-4000-8000-0000000000d1";
const STAMP = "2026-11-08T12:00:00Z";

const STUBS = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private;
CREATE TABLE public.me(id uuid);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.me LIMIT 1 $$;
CREATE TABLE public.user_roles(user_id uuid, role text);
INSERT INTO public.user_roles VALUES ('${PC}','tech'), ('${SUP}','manager'), ('${FIN}','manager'), ('${ONB}','onboarding'), ('${DIR}','manager'), ('${ADMIN}','admin');
CREATE TABLE public.functional_roles(code text PRIMARY KEY, current_seat_holder uuid);
INSERT INTO public.functional_roles VALUES ('ops_supervisor', '${SUP}');
CREATE FUNCTION public.is_director(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT _u = '${DIR}'::uuid $$;
CREATE FUNCTION private.is_accounting(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT _u = '${FIN}'::uuid $$;
CREATE TABLE public.feature_flags(key text PRIMARY KEY, label text, description text, enabled boolean, updated_by uuid,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE public.claims(id uuid PRIMARY KEY, title text NOT NULL, stage text NOT NULL, estimated_amount numeric,
  submitted_amount numeric, recovered_amount numeric, follow_up_on date, approval_status text, is_demo boolean DEFAULT false,
  updated_at timestamptz NOT NULL);
CREATE TABLE public.guest_recovery(id uuid PRIMARY KEY, title text NOT NULL, stage text NOT NULL, proposed_amount numeric,
  approved_amount numeric, follow_up_on date, is_demo boolean DEFAULT false, updated_at timestamptz NOT NULL);
CREATE TABLE public.claim_activity(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), claim_id uuid, author_id uuid, event_type text,
  body text, detail jsonb, is_demo boolean, created_at timestamptz DEFAULT now());
CREATE TABLE public.guest_recovery_activity(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recovery_id uuid, author_id uuid,
  event_type text, body text, detail jsonb, is_demo boolean, created_at timestamptz DEFAULT now());
-- Stand-in for the existing guard: an unapproved claim cannot be sent.
CREATE FUNCTION public.stub_claim_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.stage = 'submitted' AND coalesce(NEW.approval_status, '') <> 'approved' AND coalesce(NEW.submitted_amount, 0) > 500 THEN
    RAISE EXCEPTION 'This claim needs approval before it is sent.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER stub_claim_guard BEFORE UPDATE ON public.claims FOR EACH ROW EXECUTE FUNCTION public.stub_claim_guard();
`;

let db: PGlite;
const as = (id: string) => db.exec(`DELETE FROM public.me; INSERT INTO public.me VALUES ('${id}')`);
const save = (kind: string, id: string, changes: object, expected: string | null = STAMP) =>
  db.query(`SELECT * FROM public.databases_save_claim_or_refund($1, $2, $3::jsonb, $4)`, [kind, id, JSON.stringify(changes), expected]);
const claim = async () => (await db.query(`SELECT * FROM public.claims WHERE id = '${CLAIM}'`)).rows[0];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  await db.exec(STEP);
});

beforeEach(async () => {
  await db.exec(`
    DELETE FROM public.claim_activity; DELETE FROM public.guest_recovery_activity;
    DELETE FROM public.claims; DELETE FROM public.guest_recovery;
    INSERT INTO public.claims(id, title, stage, estimated_amount, updated_at) VALUES ('${CLAIM}', 'Broken TV', 'gathering', 300, '${STAMP}');
    INSERT INTO public.guest_recovery(id, title, stage, proposed_amount, updated_at) VALUES ('${REFUND}', 'Hot tub out', 'reported', 50, '${STAMP}');
  `);
});

describe("Databases: claims and refunds saved from the list", () => {
  it("adds the Guest Claims & Refunds menu switch, off", async () => {
    const r = await db.query(`SELECT enabled FROM public.feature_flags WHERE key = 'claims_menu'`);
    expect(r.rows).toEqual([{ enabled: false }]);
  });

  it("A10: Coordinator, Supervisor, Director of Operations and Admin may change; Finance and Onboarding may not", async () => {
    const r = await db.query(
      `SELECT u, public.can_edit_claims_in_databases(u) AS ok FROM unnest(ARRAY['${PC}','${SUP}','${DIR}','${ADMIN}','${FIN}','${ONB}']::uuid[]) u`,
    );
    expect(r.rows.map((x) => x.ok)).toEqual([true, true, true, true, false, false]);
    expect(await db.query(`SELECT public.can_edit_claims_in_databases(NULL) AS ok`).then((x) => x.rows[0].ok)).toBe(false);
  });

  it("a coordinator's change updates the same claim and writes one history line with the person and the time", async () => {
    await as(PC);
    const out = await save("claim", CLAIM, { stage: "costing", submitted_amount: 420, title: "Broken TV in den" });
    expect(out.rows[0].record_id).toBe(CLAIM);
    expect(out.rows[0].saved_by).toBe(PC);
    const c = await claim();
    expect(c.stage).toBe("costing");
    expect(Number(c.submitted_amount)).toBe(420);
    expect(c.title).toBe("Broken TV in den");
    expect(new Date(c.updated_at).getTime()).toBe(new Date(out.rows[0].saved_at).getTime());
    const h = await db.query(`SELECT author_id, event_type, body FROM public.claim_activity`);
    expect(h.rows).toEqual([{ author_id: PC, event_type: "database_edit", body: "Changed in Databases: Item, Status, Amount sent" }]);
  });

  it("Finance and Onboarding are refused and nothing changes", async () => {
    for (const who of [FIN, ONB]) {
      await as(who);
      await expect(save("claim", CLAIM, { stage: "costing" })).rejects.toThrow("Only Operations can change claims and refunds here.");
    }
    expect((await claim()).stage).toBe("gathering");
    expect((await db.query(`SELECT count(*)::int n FROM public.claim_activity`)).rows[0].n).toBe(0);
  });

  it("a stale copy is refused", async () => {
    await as(PC);
    await expect(save("claim", CLAIM, { stage: "costing" }, "2026-11-01T00:00:00Z")).rejects.toThrow("Someone else changed this.");
  });

  it("the existing claim guard still runs: an unapproved claim over the limit cannot be sent", async () => {
    await as(PC);
    await expect(save("claim", CLAIM, { stage: "submitted", submitted_amount: 900 })).rejects.toThrow("needs approval");
    expect((await claim()).stage).toBe("gathering");
  });

  it("only the listed fields change: approvals and refund status stay on the ticket", async () => {
    await as(SUP);
    await expect(save("claim", CLAIM, { approval_status: "approved" })).rejects.toThrow("This cannot be changed here.");
    await expect(save("refund", REFUND, { stage: "approved" })).rejects.toThrow("This cannot be changed here.");
    await expect(save("claim", CLAIM, { title: "  " })).rejects.toThrow("Item cannot be empty.");
    await expect(save("claim", CLAIM, { estimated_amount: -1 })).rejects.toThrow("below zero");
    await expect(save("claim", CLAIM, {})).rejects.toThrow("Nothing to save.");
  });

  it("a refund change updates the same refund with one history line", async () => {
    await as(ADMIN);
    await save("refund", REFUND, { proposed_amount: 75, follow_up_on: "2026-11-12" });
    const r = (await db.query(`SELECT proposed_amount, follow_up_on::text f, stage FROM public.guest_recovery`)).rows[0];
    expect(Number(r.proposed_amount)).toBe(75);
    expect(r.f).toBe("2026-11-12");
    expect(r.stage).toBe("reported");
    const h = await db.query(`SELECT author_id, body FROM public.guest_recovery_activity`);
    expect(h.rows).toEqual([{ author_id: ADMIN, body: "Changed in Databases: Amount, Follow up on" }]);
  });

  it("nothing is deleted by the save", () => {
    expect(STEP).not.toMatch(/\bDELETE\b/i);
    expect(STEP).not.toMatch(/\bDROP\b/i);
  });
});
