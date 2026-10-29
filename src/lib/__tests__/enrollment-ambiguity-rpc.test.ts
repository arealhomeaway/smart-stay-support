import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { runEnrollment } from "../active-owner-enrollment";

const home = "00000000-0000-4000-8000-000000000002";
const owner = "00000000-0000-4000-8000-000000000003";
const account = "00000000-0000-4000-8000-000000000004";
const request = "00000000-0000-4000-8000-000000000005";
const input = { propertyId: home, ownerRecordId: owner, name: "Test Owner", email: "owner@resolve-test.invalid", closingDate: "2026-11-20" };
async function fixture(existing: boolean) {
  const db = new PGlite();
  await db.exec(readFileSync("supabase/tests/fixtures/enrollment_ambiguity_schema.sql", "utf8"));
  await db.query("INSERT INTO properties(id,owner_record_id) VALUES($1,$2)", [home,owner]);
  await db.query("INSERT INTO property_owners(id,name,email) VALUES($1,$2,$3)", [owner,input.name,input.email]);
  await db.exec("INSERT INTO owner_task_templates VALUES(gen_random_uuid(),'onboarding'),(gen_random_uuid(),'ongoing')");
  if (existing) {
    await db.query("INSERT INTO profiles VALUES($1,$2);",[account,input.email]);
    await db.query("INSERT INTO auth.users(id) VALUES($1)",[account]);
    await db.query("INSERT INTO owner_programs(owner_record_id,owner_user_id,status) VALUES($1,$2,'active')",[owner,account]);
  }
  return db;
}
async function checkpoint(db: PGlite, step: string, id: string | null = null) {
  const result = await db.query<{receipt: {programId: string}}>("SELECT active_owner_enrollment_step($1,$2,$3::jsonb,$4) receipt",[request,step,JSON.stringify(input),id]);
  const receipt = result.rows[0]?.receipt;
  if (!receipt) throw new Error("Missing receipt");
  return receipt;
}
function workflow(db: PGlite, failClosing = false) {
  return runEnrollment({
    prepare: async () => { await checkpoint(db,"prepare"); },
    account: async () => {
      await db.query("INSERT INTO profiles VALUES($1,$2) ON CONFLICT DO NOTHING",[account,input.email]);
      await db.query("INSERT INTO auth.users(id) VALUES($1) ON CONFLICT DO NOTHING",[account]);
      await checkpoint(db,"account",account);
      return {id:account,created:false};
    },
    step: async (step,id) => {
      if (failClosing && step === "closing") throw new Error("Injected interruption");
      return checkpoint(db,step,id);
    },
  });
}
describe("enrollment alias ambiguity in isolated PostgreSQL", () => {
  it("live-before definition reproduces p.owner_user_id ambiguity before any checkpoint or account",async () => {
    const db=await fixture(false);
    try {
      await db.exec(readFileSync("docs/pending/enroll-ambiguous-fix/undo.sql","utf8"));
      await expect(checkpoint(db,"prepare")).rejects.toThrow('column reference "p.owner_user_id" is ambiguous');
      expect((await db.query("SELECT * FROM active_owner_enrollment_runs")).rows).toHaveLength(0);
      expect((await db.query("SELECT * FROM auth.users")).rows).toHaveLength(0);
    } finally { await db.close(); }
  });
  for (const existing of [false,true]) {
    it(`${existing ? "existing" : "new"} owner completes all real checkpoint branches; interrupted Retry does not duplicate`,async () => {
      const db=await fixture(existing);
      try {
        await db.exec(readFileSync("docs/pending/enroll-ambiguous-fix/fix.sql","utf8"));
        const interrupted=await workflow(db,true);
        expect(interrupted.complete).toBe(false);
        expect(interrupted.steps.find(s=>s.key==='closing')?.status).toBe('failed');
        expect((await workflow(db)).complete).toBe(true);
        const before=(await db.query("SELECT checkpoints FROM active_owner_enrollment_runs")).rows;
        expect((await workflow(db)).complete).toBe(true);
        expect((await db.query("SELECT checkpoints FROM active_owner_enrollment_runs")).rows).toEqual(before);
        for (const table of ['auth.users','owner_programs','owner_program_properties','active_owner_enrollment_runs','test_summaries','test_welcomes']) {
          expect((await db.query(`SELECT * FROM ${table}`)).rows).toHaveLength(1);
        }
        expect((await db.query("SELECT * FROM owner_reviews WHERE status='awaiting_owner'")).rows).toHaveLength(2);
      } finally { await db.close(); }
    });
  }
  it("existing different login remains blocked without creating an enrollment run",async () => {
    const db=await fixture(true);
    try {
      await db.exec(readFileSync("docs/pending/enroll-ambiguous-fix/fix.sql","utf8"));
      await db.exec("UPDATE profiles SET email='different@resolve-test.invalid'");
      await expect(checkpoint(db,"prepare")).rejects.toThrow('different linked login');
      expect((await db.query("SELECT * FROM active_owner_enrollment_runs")).rows).toHaveLength(0);
    } finally { await db.close(); }
  });
});