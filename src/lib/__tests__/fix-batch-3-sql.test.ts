// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PROPOSED_HANDOFF_STANDARD } from "../handoff-standard-seed";

/**
 * Isolated PostgreSQL checks of docs/pending/fix-batch-3/. Tables are stubbed with the live
 * columns each step reads. Nothing touches the real database.
 */
const DIR = "docs/pending/fix-batch-3";
const sql = (f: string) => readFileSync(`${DIR}/${f}`, "utf8");
const LIVE_UPDATED_AT = "2026-10-27 23:33:03.478207+00";
const OLD_NOTE = "Proposed. Micah and Kati have not signed off.";
const OLD_TEXT: Record<string, Partial<Record<"name" | "done_when" | "proof_needed", string>>> = {
  "SYS-01": {
    name: "Systems setup confirmed by Kati",
    done_when: "Kati confirms every platform is complete and accurate, with no missing or placeholder data.",
    proof_needed: "Kati's sign-off with date; PID % Complete at 100%.",
  },
  "LIN-02": {
    done_when:
      "Guest and backup supply minimums meet approved per-occupancy standard; each toilet has a usable plunger under proposed ARHA standard.",
  },
};

/** The live rows before batch 3, rebuilt from the corrected seed plus the captured old text. */
function liveBefore() {
  return PROPOSED_HANDOFF_STANDARD.map((r) => ({
    ...r,
    ...OLD_TEXT[r.code],
    notes: r.code === "GST-01" ? "Proposed removal" : OLD_NOTE,
  }));
}

const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
const SCHEMA = `
CREATE TABLE public.handoff_requirements(
  id uuid PRIMARY KEY, code text UNIQUE NOT NULL, name text NOT NULL, category text NOT NULL,
  tier text NOT NULL CHECK (tier IN ('essential','micah','nonessential')),
  done_when text NOT NULL DEFAULT '', proof_needed text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('proposed','adopted','retired')),
  notes text NOT NULL DEFAULT '', sort_order int NOT NULL DEFAULT 0,
  template_step_ids uuid[] NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.handoff_standard_history(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), requirement_id uuid REFERENCES public.handoff_requirements(id),
  actor_id uuid NOT NULL, actor_name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  old_value jsonb, new_value jsonb, action text NOT NULL);
CREATE FUNCTION public.preserve_handoff_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'History is permanent.'; END $$;
CREATE TRIGGER handoff_standard_history_permanent BEFORE DELETE OR UPDATE ON public.handoff_standard_history FOR EACH ROW EXECUTE FUNCTION public.preserve_handoff_history();
CREATE TABLE public.owner_task_templates(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE NOT NULL, title text NOT NULL,
  owner_action text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER owner_task_templates_updated BEFORE UPDATE ON public.owner_task_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.owner_task_templates(code,title,owner_action) VALUES
 ('onb_initial_review','Complete the initial onboarding review','Walk the onboarding checklist with Kati, ask questions and set priorities.'),
 ('ops_improvements','Review proposed improvements','Evaluate the proposal and give business direction.'),
 ('other','Something else','Unchanged line.');
`;

let db: PGlite;
const rows = async () =>
  (await db.query("SELECT id::text,code,name,category,tier,done_when,proof_needed,status,notes,sort_order,updated_at::text FROM public.handoff_requirements ORDER BY sort_order")).rows;
const historyCount = async () => Number((await db.query("SELECT count(*)::int n FROM public.handoff_standard_history")).rows[0].n);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SCHEMA);
  const values = liveBefore()
    .map((r) => `(${q(r.id)},${q(r.code)},${q(r.name)},${q(r.category)},${q(r.tier)},${q(r.done_when)},${q(r.proof_needed)},${q(r.status)},${q(r.notes)},${r.sort_order},${q(LIVE_UPDATED_AT)})`)
    .join(",\n");
  await db.exec(`INSERT INTO public.handoff_requirements(id,code,name,category,tier,done_when,proof_needed,status,notes,sort_order,updated_at) VALUES ${values};`);
});

describe("fix batch 3 staged files", () => {
  it("match their recorded checksums", () => {
    const lines = readFileSync(`${DIR}/sha256.txt`, "utf8").trim().split("\n");
    expect(lines.length).toBe(5);
    for (const line of lines) {
      const [hash, file] = line.split(/\s+/);
      expect(createHash("sha256").update(readFileSync(`${DIR}/${file}`)).digest("hex")).toBe(hash);
    }
  });
});

describe("part 1: handoff standard wording", () => {
  it("starts from the live text: 49 review notes and GST-01 'Proposed removal'", async () => {
    const r = await rows();
    expect(r.length).toBe(50);
    expect(r.filter((x) => x.notes === OLD_NOTE).length).toBe(49);
    expect(r.find((x) => x.code === "GST-01").notes).toBe("Proposed removal");
  });

  it("removes every name and review note, matching the screen copy exactly", async () => {
    const before = await rows();
    await db.exec(sql("01_handoff_standard_wording.sql"));
    const after = await rows();
    const text = JSON.stringify(after.map(({ updated_at, ...x }) => x));
    expect(text).not.toMatch(/\b(Micah|Kati)\b/);
    expect(text).not.toMatch(/signed off|Proposed|proposed ARHA/);
    for (const seed of PROPOSED_HANDOFF_STANDARD) {
      const row = after.find((x) => x.id === seed.id);
      expect([row.code, row.name, row.done_when, row.proof_needed, row.notes]).toEqual([seed.code, seed.name, seed.done_when, seed.proof_needed, seed.notes]);
    }
    // Codes, tiers, statuses and order are unchanged.
    expect(after.map((x) => [x.id, x.code, x.tier, x.status, x.sort_order])).toEqual(before.map((x) => [x.id, x.code, x.tier, x.status, x.sort_order]));
    expect(await historyCount()).toBe(50);
    const h = (await db.query("SELECT DISTINCT action, actor_name FROM public.handoff_standard_history")).rows;
    expect(h).toEqual([{ action: "edited", actor_name: "Wording update" }]);
  });

  it("running it again changes nothing", async () => {
    const before = await rows();
    await db.exec(sql("01_handoff_standard_wording.sql"));
    expect(await rows()).toEqual(before);
    expect(await historyCount()).toBe(50);
  });

  it("undo puts back the exact live text and time, adding history instead of deleting it", async () => {
    await db.exec(`INSERT INTO public.handoff_requirements(id,code,name,category,tier,status,notes) VALUES ('11111111-1111-4111-8111-111111111111','NEW-01','Added later','Safety','essential','proposed','')`);
    await db.exec(sql("01_undo_handoff_standard_wording.sql"));
    const r = (await rows()).filter((x) => x.code !== "NEW-01");
    const live = liveBefore();
    for (const old of live) {
      const row = r.find((x) => x.id === old.id);
      expect([row.name, row.done_when, row.proof_needed, row.notes]).toEqual([old.name, old.done_when, old.proof_needed, old.notes]);
      expect(row.updated_at).toBe(LIVE_UPDATED_AT);
    }
    expect((await rows()).find((x) => x.code === "NEW-01").notes).toBe("");
    expect(await historyCount()).toBe(100);
  });
});

describe("part 2: homeowner task template lines", () => {
  const actions = async () => Object.fromEntries((await db.query("SELECT code, owner_action FROM public.owner_task_templates")).rows.map((r) => [r.code, r.owner_action]));

  it("replaces the name and the proposal wording, nothing else", async () => {
    await db.exec(sql("02_owner_task_wording.sql"));
    expect(await actions()).toEqual({
      onb_initial_review: "Walk the onboarding checklist with the Director of Onboarding, ask questions and set priorities.",
      ops_improvements: "Look over the improvement and give business direction.",
      other: "Unchanged line.",
    });
  });

  it("undo restores the exact live text", async () => {
    await db.exec(sql("02_undo_owner_task_wording.sql"));
    expect(await actions()).toEqual({
      onb_initial_review: "Walk the onboarding checklist with Kati, ask questions and set priorities.",
      ops_improvements: "Evaluate the proposal and give business direction.",
      other: "Unchanged line.",
    });
  });
});
