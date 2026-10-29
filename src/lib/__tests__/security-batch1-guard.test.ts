import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

// Isolated proof for security batch 1: the two plan functions now refuse
// signed-out callers; leadership is still allowed and non-leaders refused.
const leader = "00000000-0000-4000-8000-0000000000a1";
const staff = "00000000-0000-4000-8000-0000000000a2";
const tpl = "00000000-0000-4000-8000-0000000000b1";
let db: PGlite;
const as = (id: string) => db.query("select set_config('test.actor',$1,false)", [id]);

describe("security batch 1 guard, isolated PostgreSQL", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`CREATE SCHEMA auth; CREATE SCHEMA private;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.actor',true),'')::uuid$$;
      CREATE FUNCTION private.is_onboarding_leader(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT $1='${leader}'::uuid$$;
      CREATE TABLE onboarding_projects(id uuid PRIMARY KEY);
      CREATE TABLE onboarding_template_versions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),template_id uuid,version int,snapshot jsonb,published_by uuid);
      CREATE TABLE onboarding_template_stages(template_id uuid,name text,sort_order int,active boolean);
      CREATE TABLE onboarding_template_tasks(template_id uuid,title text,stage text,sort_order int,is_active boolean,created_at timestamptz,updated_at timestamptz);`);
    await db.exec(readFileSync("docs/pending/security-batch1/apply-functions.sql", "utf8"));
  });
  afterAll(async () => { await db.close(); });

  const publish = () => db.query("select publish_onboarding_template($1) id", [tpl]);
  const start = () => db.query("select instantiate_onboarding_v2(gen_random_uuid(), gen_random_uuid())");

  it("leadership can publish and passes the start guard", async () => {
    await as(leader);
    expect((await publish()).rows).toHaveLength(1);
    await expect(start()).rejects.toThrow("Project or template version not found.");
  });
  it("a non-leader is refused", async () => {
    await as(staff);
    await expect(publish()).rejects.toThrow("Only onboarding leadership can publish a template.");
    await expect(start()).rejects.toThrow("Only onboarding leadership can start a V2 plan.");
  });
  it("a signed-out caller is refused and writes nothing", async () => {
    await as("");
    const before = (await db.query<{ n: number }>("select count(*)::int n from onboarding_template_versions")).rows[0]!.n;
    await expect(publish()).rejects.toThrow("Only onboarding leadership can publish a template.");
    await expect(start()).rejects.toThrow("Only onboarding leadership can start a V2 plan.");
    expect((await db.query<{ n: number }>("select count(*)::int n from onboarding_template_versions")).rows[0]!.n).toBe(before);
  });
});
