import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const path = 'docs/pending/auto-assign-by-seat/';
const apply = readFileSync(path + 'apply.sql', 'utf8');
const undo = readFileSync(path + 'undo.sql', 'utf8');

// Function-only harness, not a copy of application schema or routing dependencies.
async function fixture() {
  const db = new PGlite();
  await db.exec(`CREATE TABLE tickets (
    id uuid DEFAULT gen_random_uuid(), status text DEFAULT 'open', external_source text,
    functional_role_code text, work_type_id uuid, current_action_owner uuid, assigned_to uuid,
    assignment_source text, assignment_note text);
    CREATE FUNCTION ticket_route_at(text,uuid,timestamptz)
    RETURNS TABLE(user_id uuid,role_code text,source text,note text) LANGUAGE sql STABLE AS $$
      SELECT CASE WHEN $1='nobody' THEN NULL::uuid
        WHEN $1='po_day' THEN '00000000-0000-0000-0000-000000000002'::uuid
        ELSE '00000000-0000-0000-0000-000000000001'::uuid END,
        $1,'automatic'::text,'Existing route'::text $$;`);
  await db.exec(apply);
  await db.exec('CREATE TRIGGER assign BEFORE INSERT ON tickets FOR EACH ROW EXECUTE FUNCTION auto_assign_ticket();');
  return db;
}

for (const source of ['email', 'ownerrez', 'breezeway', 'arrival_check']) {
  it(`new ${source} uses the existing route`, async () => {
    const db = await fixture();
    try {
      const r = await db.query<{ assigned_to: string; current_action_owner: string }>(
        'INSERT INTO tickets(external_source,functional_role_code) VALUES ($1,$2) RETURNING assigned_to,current_action_owner',
        [source, 'ge_day']);
      expect(r.rows[0]?.assigned_to).toBe('00000000-0000-0000-0000-000000000001');
      expect(r.rows[0]?.current_action_owner).toBe(r.rows[0]?.assigned_to);
    } finally { await db.close(); }
  });
}

describe('assignment scope', () => {
  it('untyped Breezeway uses its existing Team B mapping', async () => {
    const db = await fixture();
    try {
      const r = await db.query<{ assigned_to: string }>("INSERT INTO tickets(external_source) VALUES ('breezeway') RETURNING assigned_to");
      expect(r.rows[0]?.assigned_to).toBe('00000000-0000-0000-0000-000000000002');
    } finally { await db.close(); }
  });
  it('Notion preserves both mapped owners and empty owners', async () => {
    const db = await fixture();
    try {
      const r = await db.query<{ assigned_to: string | null }>(`INSERT INTO tickets(external_source,assigned_to)
        VALUES ('notion','00000000-0000-0000-0000-000000000099'),('notion',NULL) RETURNING assigned_to`);
      expect(r.rows.map(x => x.assigned_to)).toEqual(['00000000-0000-0000-0000-000000000099',null]);
    } finally { await db.close(); }
  });
  it('closed and resolved automated records remain untouched', async () => {
    const db = await fixture();
    try {
      const r = await db.query<{ assigned_to: string | null }>("INSERT INTO tickets(status,external_source) VALUES ('closed','email'),('resolved','breezeway') RETURNING assigned_to");
      expect(r.rows.map(x => x.assigned_to)).toEqual([null,null]);
    } finally { await db.close(); }
  });
  it('no eligible recipient stays unowned', async () => {
    const db = await fixture();
    try {
      const r = await db.query<{ assigned_to: string | null }>("INSERT INTO tickets(external_source,functional_role_code) VALUES ('email','nobody') RETURNING assigned_to");
      expect(r.rows[0]?.assigned_to).toBeNull();
    } finally { await db.close(); }
  });
  it('undo restores the previous automated bypass and hand-made routing', async () => {
    const db = await fixture();
    try {
      await db.exec(undo);
      const r = await db.query<{ assigned_to: string | null }>("INSERT INTO tickets(external_source) VALUES ('email'),('ownerrez'),('breezeway'),(NULL) RETURNING assigned_to");
      expect(r.rows.map(x => x.assigned_to)).toEqual([null,null,null,'00000000-0000-0000-0000-000000000001']);
    } finally { await db.close(); }
  });
});

it('one-time spread uses updated load, skips Notion/held/finished/demo/old/owned, audits and removes its job', async () => {
  const db = await fixture();
  try {
    await db.exec(`ALTER TABLE tickets ADD created_at timestamptz DEFAULT '2026-11-20',
      ADD archived_at timestamptz, ADD is_demo boolean DEFAULT false, ADD import_hold text;
      CREATE TABLE audit_log(actor_label text,action text,entity_type text,entity_label text,reason text,after_value jsonb);
      CREATE SCHEMA cron;
      CREATE TABLE cron.calls(name text);
      CREATE FUNCTION cron.unschedule(text) RETURNS boolean LANGUAGE plpgsql AS $$
        BEGIN INSERT INTO cron.calls VALUES ($1); RETURN true; END $$;
      DROP TRIGGER assign ON tickets;
      CREATE OR REPLACE FUNCTION ticket_route_at(text,uuid,timestamptz)
      RETURNS TABLE(user_id uuid,role_code text,source text,note text) LANGUAGE sql STABLE AS $$
        SELECT candidate.uid, $1, 'automatic'::text, 'Existing route'::text
        FROM (VALUES ('00000000-0000-0000-0000-000000000001'::uuid),
          ('00000000-0000-0000-0000-000000000002'::uuid)) candidate(uid)
        ORDER BY (SELECT count(*) FROM tickets t WHERE t.current_action_owner=candidate.uid),candidate.uid LIMIT 1 $$;
      INSERT INTO tickets(external_source) VALUES ('email'),('breezeway'),('ownerrez'),('arrival_check');
      INSERT INTO tickets(external_source) VALUES ('notion');
      INSERT INTO tickets(import_hold) VALUES ('backlog_review');
      INSERT INTO tickets(status) VALUES ('closed');
      INSERT INTO tickets(is_demo) VALUES (true);
      INSERT INTO tickets(created_at) VALUES ('2026-11-15');
      INSERT INTO tickets(archived_at) VALUES (now());
      INSERT INTO tickets(assigned_to,current_action_owner)
        VALUES ('00000000-0000-0000-0000-000000000099','00000000-0000-0000-0000-000000000099');`);
    const schedule = readFileSync(path + 'schedule.sql', 'utf8');
    const body = schedule.slice(schedule.indexOf('DO $spread$'), schedule.indexOf('$job$);'));
    // Freeze only the job clock. No real application schema or routing helper is copied.
    const frozen = body.replaceAll('now()', "'2026-11-26 14:00:00+00'::timestamptz");
    expect(schedule.match(/'0 14 26 11 \*'/)?.[0]).toBe("'0 14 26 11 *'");
    await db.exec(frozen);
    const load = await db.query<{ current_action_owner: string; n: number }>(
      `SELECT current_action_owner,count(*)::int n FROM tickets
       WHERE current_action_owner IS NOT NULL AND current_action_owner <> '00000000-0000-0000-0000-000000000099'
       GROUP BY 1 ORDER BY 1`);
    expect(load.rows.map(x => x.n)).toEqual([2,2]);
    const receipt = await db.query<{ n: number }>("SELECT jsonb_array_length(after_value->'assigned')::int n FROM audit_log");
    expect(receipt.rows[0]?.n).toBe(4);
    const untouched = await db.query<{ n: number }>("SELECT count(*)::int n FROM tickets WHERE assigned_to IS NULL");
    expect(untouched.rows[0]?.n).toBe(6);
    await db.exec(frozen);
    const audits = await db.query<{ n: number }>('SELECT count(*)::int n FROM audit_log');
    expect(audits.rows[0]?.n).toBe(1);
    const removed = await db.query<{ name: string }>('SELECT name FROM cron.calls');
    expect(removed.rows.map(x => x.name)).toEqual(['auto-assign-by-seat-20261126','auto-assign-by-seat-20261126']);
  } finally { await db.close(); }
});
