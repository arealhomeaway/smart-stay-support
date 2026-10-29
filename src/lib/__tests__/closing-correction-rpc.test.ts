import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

// Isolated PostgreSQL only. The live function is never touched here.
const home = "00000000-0000-4000-8000-0000000000b1";
const program = "00000000-0000-4000-8000-0000000000c1";
const emily = "00000000-0000-4000-8000-0000000000d1";
const kati = "00000000-0000-4000-8000-0000000000d2";

const schema = `
CREATE TABLE properties(id uuid PRIMARY KEY, name text, actual_closing_on date);
CREATE TABLE owner_programs(id uuid PRIMARY KEY, started_on date, ends_on date, completed_at timestamptz);
CREATE TABLE owner_program_properties(id uuid DEFAULT gen_random_uuid() PRIMARY KEY, program_id uuid, property_id uuid, closing_date date, closing_confirmed boolean, inclusion_status text, archived_at timestamptz);
CREATE TABLE owner_program_events(id uuid DEFAULT gen_random_uuid() PRIMARY KEY, program_id uuid, property_id uuid, kind text, summary text, detail jsonb, previous_value text, new_value text, reason text, actor_id uuid);
CREATE TABLE audit_log(id uuid DEFAULT gen_random_uuid() PRIMARY KEY, actor_id uuid, action text, entity_type text, entity_id uuid, entity_label text, reason text, before_value jsonb, after_value jsonb);
CREATE FUNCTION can_correct_actual_closing(uid uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT uid = '${emily}' $$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT current_setting('app.test_uid', true)::uuid $$;
`;

let db: PGlite;
const load = (file: string) =>
  db.exec(readFileSync(file, "utf8").replaceAll("public.", "").replaceAll("private.", ""));

const asUser = (uid: string) => db.query(`SELECT set_config('app.test_uid', '${uid}', false)`);
const correct = (date: string) =>
  db.query(`SELECT correct_actual_closing($1, $2::date, 'Corrected to the confirmed closing date')`, [home, date]);

describe("Closing correction function, isolated only", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(schema);
  });
  afterAll(async () => {
    await db.close();
  });
  beforeEach(async () => {
    await db.exec(
      "TRUNCATE properties, owner_programs, owner_program_properties, owner_program_events, audit_log",
    );
    await db.query("INSERT INTO properties VALUES($1,'Maple Home','2026-09-24')", [home]);
    await db.query("INSERT INTO owner_programs VALUES($1,'2026-09-22',NULL,NULL)", [program]);
    await db.query(
      "INSERT INTO owner_program_properties(program_id,property_id,closing_date,closing_confirmed,inclusion_status,archived_at) VALUES($1,$2,'2026-09-23',true,'included',NULL)",
      [program, home],
    );
    await asUser(emily);
  });

  it("the live definition fails with the jsonb type error (proves the diagnosis)", async () => {
    await load("docs/pending/closing-correction-fix/undo.sql");
    await expect(correct("2026-09-23")).rejects.toThrow(/column "detail" is of type jsonb/);
  });

  it("the fix succeeds and writes its history with the same values", async () => {
    await load("docs/pending/closing-correction-fix/fix.sql");
    const r = await correct("2026-09-23");
    expect(r.rows[0]!).toEqual({
      correct_actual_closing: { previous: "2026-09-24", new: "2026-09-23", enrollments: 1 },
    });
    const ev = await db.query<{
      kind: string;
      detail: string;
      previous_value: string;
      new_value: string;
      reason: string;
      actor_id: string;
    }>("SELECT kind, detail::text, previous_value, new_value, reason, actor_id FROM owner_program_events");
    expect(ev.rows).toEqual([
      {
        kind: "closing_corrected",
        detail: '"Actual closing for Maple Home corrected by staff. Logged activities were kept; counting follows the new date."',
        previous_value: "2026-09-23",
        new_value: "2026-09-23",
        reason: "Corrected to the confirmed closing date",
        actor_id: emily,
      },
    ]);
    const audit = await db.query<{ action: string; actor_id: string }>(
      "SELECT action, actor_id FROM audit_log",
    );
    expect(audit.rows).toEqual([{ action: "actual_closing_corrected", actor_id: emily }]);
    const prop = await db.query<{ actual_closing_on: string }>(
      "SELECT actual_closing_on::text FROM properties",
    );
    expect(prop.rows[0]!.actual_closing_on).toBe("2026-09-23");
  });

  it("a non-authorized caller is still refused and nothing is written", async () => {
    await load("docs/pending/closing-correction-fix/fix.sql");
    await asUser(kati);
    await expect(correct("2026-09-23")).rejects.toThrow(/Only a Director or Manager/);
    expect((await db.query("SELECT count(*)::int n FROM owner_program_events")).rows[0]).toEqual({ n: 0 });
    expect((await db.query("SELECT count(*)::int n FROM audit_log")).rows[0]).toEqual({ n: 0 });
  });
});
