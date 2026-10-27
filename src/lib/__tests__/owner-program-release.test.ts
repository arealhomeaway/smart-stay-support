import { beforeAll, afterAll, beforeEach, describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { programActivityRelease } from "../owner-program-release.server";

const program = "00000000-0000-4000-8000-000000000001";
const version = "00000000-0000-4000-8000-000000000002";
const owner = "00000000-0000-4000-8000-000000000003";
const home = "00000000-0000-4000-8000-000000000004";
const secondHome = "00000000-0000-4000-8000-000000000005";
const onboarding = "00000000-0000-4000-8000-000000000006";
const operating = "00000000-0000-4000-8000-000000000007";
let db: PGlite;
async function preview() {
  const result = await db.query<{ receipt: { count: number; reportVersion: string } }>(
    "SELECT release_owner_program_activities($1,$2,true,NULL) AS receipt", [program, version]);
  return result.rows[0]?.receipt;
}
async function execute(count: number, currentVersion = version) {
  return (await db.query<{ receipt: { programId: string; added: number; opened: number; summaryId: string | null } }>(
    "SELECT release_owner_program_activities($1,$2,false,$3) AS receipt", [program, currentVersion, count])).rows[0]?.receipt;
}
async function count(table: string) {
  return (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`)).rows[0]?.n;
}
describe("permanent program activity release (isolated PostgreSQL)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(readFileSync("supabase/tests/fixtures/owner_program_release_schema.sql", "utf8"));
    await db.exec(readFileSync("docs/pending/active-owner-enrollment/0163_program_activity_release.sql", "utf8"));
  });
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await db.exec("TRUNCATE owner_programs,properties,owner_program_properties,owner_task_templates,owner_reviews,test_actions,owner_notifications");
    await db.query("SELECT set_config('test.actor',$1,false),set_config('test.role','admin',false)", [owner]);
    await db.query("INSERT INTO owner_programs VALUES($1,'draft',$2,$3,false)", [program, version, owner]);
    await db.query("INSERT INTO properties VALUES($1,'Test home',NULL)", [home]);
    await db.query("INSERT INTO owner_program_properties VALUES($1,$2,'included',NULL,'2026-11-01')", [program, home]);
    await db.query("INSERT INTO owner_task_templates VALUES($1,'onboarding',true),($2,'ongoing',true)", [onboarding, operating]);
  });
  it("preview writes nothing and counts both missing phases", async () => {
    expect((await preview())?.count).toBe(2);
    expect(await count("owner_reviews")).toBe(0);
    expect(await count("test_actions")).toBe(0);
    expect(await count("owner_notifications")).toBe(0);
  });
  it("draft activates then releases and queues exactly one summary", async () => {
    expect(await execute(2)).toMatchObject({ added: 2, opened: 2 });
    expect((await db.query<{ status: string }>("SELECT status FROM owner_programs")).rows[0]?.status).toBe("active");
    expect((await db.query<{ action: string }>("SELECT action FROM test_actions")).rows.map(r => r.action)).toEqual(["activate", "batch_begin", "seed_onboarding", "seed_ongoing", "summary"]);
    expect(await count("owner_notifications")).toBe(1);
    expect((await db.query<{ n: number }>("SELECT n FROM owner_notifications")).rows[0]?.n).toBe(2);
    expect((await db.query<{ status: string }>("SELECT status FROM owner_reviews")).rows.map(r => r.status)).toEqual(["awaiting_owner", "awaiting_owner"]);
  });
  it("repeats and completed records are skipped but prepared templates open", async () => {
    await db.query("INSERT INTO owner_reviews(program_id,template_id,property_id,status) VALUES($1,$2,$3,'answered'),($1,$4,NULL,'prepared')", [program, onboarding, home, operating]);
    expect((await preview())?.count).toBe(1);
    expect(await execute(1)).toMatchObject({ added: 0, opened: 1 });
    expect(await count("owner_reviews")).toBe(2);
    expect(await count("owner_notifications")).toBe(1);
  });
  it("onboarding is per home and operating is once per program", async () => {
    await db.query("INSERT INTO properties VALUES($1,'Second test home',NULL)", [secondHome]);
    await db.query("INSERT INTO owner_program_properties VALUES($1,$2,'included',NULL,'2027-01-01')", [program, secondHome]);
    expect((await preview())?.count).toBe(3);
    expect(await execute(3)).toMatchObject({ added: 3, opened: 3 });
    expect(await count("owner_notifications")).toBe(1);
  });
  it("second click releases nothing and sends nothing", async () => {
    await execute(2);
    const current = (await db.query<{ report_version: string }>("SELECT report_version FROM owner_programs")).rows[0]?.report_version;
    if (!current) throw new Error("No saved version");
    expect(await execute(0, current)).toEqual({ programId: program, added: 0, opened: 0, summaryId: null });
    expect(await count("owner_notifications")).toBe(1);
    expect(await count("test_actions")).toBe(5);
  });
  it("non-Admin non-Director cannot preview or execute", async () => {
    for (const role of ["manager", "onboarding", "owner", "tech", "director_ops"]) {
      await db.query("SELECT set_config('test.role',$1,false)", [role]);
      await expect(preview()).rejects.toThrow("Only an Admin or Onboarding Director");
      await expect(execute(2)).rejects.toThrow("Only an Admin or Onboarding Director");
    }
    expect(await count("test_actions")).toBe(0);
  });
  it("Onboarding Director can execute", async () => {
    await db.query("SELECT set_config('test.role','onboarding_director',false)");
    expect(await execute(2)).toMatchObject({ opened: 2 });
  });
  it("synthetic callers cannot release real programs even as Admin", async () => {
    await db.query("SELECT set_config('test.synthetic','true',false)");
    try {
      await expect(execute(2)).rejects.toThrow("Test accounts can only release demo activities");
      expect(await count("test_actions")).toBe(0);
    } finally { await db.query("SELECT set_config('test.synthetic','false',false)"); }
  });
  it("missing closing refuses activation; stale counts refuse all writes", async () => {
    await db.exec("UPDATE owner_program_properties SET closing_date=NULL");
    await expect(execute(2)).rejects.toThrow("Record a closing date");
    await db.exec("UPDATE owner_program_properties SET closing_date='2026-11-01'");
    await expect(execute(3)).rejects.toThrow("activities changed");
    expect(await count("test_actions")).toBe(0);
  });
  it("summary failure rolls back activation, creation and opening", async () => {
    await db.exec("CREATE FUNCTION test_fail_summary() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'summary failure'; END $$; CREATE TRIGGER test_summary_failure BEFORE INSERT ON owner_notifications FOR EACH ROW EXECUTE FUNCTION test_fail_summary()");
    try {
      await expect(execute(2)).rejects.toThrow("summary failure");
      expect(await count("owner_reviews")).toBe(0);
      expect(await count("test_actions")).toBe(0);
      expect((await db.query<{ status: string }>("SELECT status FROM owner_programs")).rows[0]?.status).toBe("draft");
    } finally { await db.exec("DROP TRIGGER test_summary_failure ON owner_notifications; DROP FUNCTION test_fail_summary()"); }
  });
});
describe("caller-authenticated release adapter", () => {
  it("refuses Supervisor alone before the write RPC", async () => {
    const calls: string[] = [];
    const client = { rpc: async (name: string) => { calls.push(name); return { data: false, error: null }; } };
    await expect(programActivityRelease(client as never, owner, { programId: program, expectedVersion: version, preview: false, expectedCount: 2 })).rejects.toThrow("Only the Onboarding Director or an Admin");
    expect(calls).toEqual(["has_role", "is_onboarding_director"]);
  });
  it("uses one RPC with the reviewed count/version after caller checks", async () => {
    const calls: { name: string; args: unknown }[] = [];
    const client = { rpc: async (name: string, args: unknown) => { calls.push({ name, args }); return { data: name === "release_owner_program_activities" ? { programId: program, added: 2, opened: 2, summaryId: owner } : true, error: null }; } };
    expect((await programActivityRelease(client as never, owner, { programId: program, expectedVersion: version, preview: false, expectedCount: 2 })).receipt?.opened).toBe(2);
    expect(calls.at(-1)).toEqual({ name: "release_owner_program_activities", args: { _program_id: program, _expected_version: version, _preview: false, _expected_count: 2 } });
  });
});