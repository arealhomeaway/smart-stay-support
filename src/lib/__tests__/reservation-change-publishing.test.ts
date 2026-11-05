import { expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { SEED_TEMPLATES } from "../ticket-checklist-seed";

it("staged cleaning publication and compensating undo preserve original content and pinned tickets", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE SCHEMA private;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
      CREATE FUNCTION private.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
      CREATE FUNCTION private.is_director(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
      CREATE TABLE playbooks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),category text,title text,active boolean,
        playbook_key text,version integer,status text,approved_by uuid,approved_at timestamptz,effective_on date,
        applies_to text[],source text,supersedes_id uuid,review_note text,retired_at timestamptz);
      CREATE TABLE tickets(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
      CREATE TABLE ticket_steps(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ticket_id uuid,completed boolean,
        completed_by uuid,completed_at timestamptz);
      CREATE TABLE audit_log(actor_id uuid,action text,entity_type text,entity_id uuid,entity_label text,reason text,before_value jsonb,after_value jsonb);`);
    await db.exec(readFileSync("docs/pending/ticket-checklists/01_ticket_checklists.sql", "utf8"));
    const original = SEED_TEMPLATES.find((t) => t.category === "cleaning");
    if (!original) throw new Error("Missing cleaning seed");
    const body = { priority: original.priority, steps: original.steps };
    await db.query("SELECT set_config('resolve.checklist_publish','on',false)");
    await db.query(`INSERT INTO playbooks(id,category,title,version,status,playbook_key,checklist,checklist_category)
      VALUES('a998f212-8b1c-4905-984b-482c2815cd82','checklist','Cleaning complaint',1,'approved','checklist:cleaning',$1,'cleaning')`, [JSON.stringify(body)]);
    await db.query("INSERT INTO tickets(checklist_playbook_id,checklist_category) VALUES('a998f212-8b1c-4905-984b-482c2815cd82','cleaning')");
    const execute = async (name: string) => {
      await db.exec("BEGIN");
      try { await db.exec(readFileSync(`docs/pending/reservation-change-tile/${name}`, "utf8")); await db.exec("COMMIT"); }
      catch (e) { await db.exec("ROLLBACK"); throw e; }
    };
    await execute("01_publish_cleaning_v2.sql");
    const rows = await db.query<{ version: number; status: string; checklist: { settings?: { value: string }[] }; checksum: string }>("SELECT version,status,checklist,md5(checklist::text) checksum FROM playbooks ORDER BY version");
    expect(rows.rows.map((r) => [r.version,r.status])).toEqual([[1,"retired"],[2,"approved"]]);
    expect(rows.rows[0]?.checksum).toBe("a54db86e7ac93640746fe90e7464d563");
    expect(rows.rows[1]?.checklist.settings?.[0]?.value).toBe("60");
    expect((await db.query<{ checklist_playbook_id: string }>("SELECT checklist_playbook_id FROM tickets")).rows[0]?.checklist_playbook_id).toBe("a998f212-8b1c-4905-984b-482c2815cd82");
    await expect(execute("01_publish_cleaning_v2.sql")).rejects.toThrow("Cleaning checklist changed");
    await execute("01_undo_cleaning_v2.sql");
    expect((await db.query<{ checksum: string; version: number }>("SELECT md5(checklist::text) checksum,version FROM playbooks WHERE status='approved'")).rows[0]).toEqual({ checksum: "a54db86e7ac93640746fe90e7464d563", version: 3 });
    expect((await db.query<{ count: number }>("SELECT count(*)::integer count FROM audit_log WHERE action='ticket_checklist_published'")).rows[0]?.count).toBe(2);
  } finally { await db.close(); }
}, 30000);