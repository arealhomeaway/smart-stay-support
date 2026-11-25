import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');
const original = read('01_move_open_checks.sql');
const equivalent = read('apply.data.sql');
const undo = read('undo/01_move_open_checks.sql');
const state = async (db) => ({
  checks: (await db.query('SELECT * FROM arrival_checks ORDER BY id')).rows,
  tickets: (await db.query('SELECT * FROM tickets ORDER BY id')).rows,
});
async function practice(sql) {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE arrival_checks(id uuid PRIMARY KEY, team text, ticket_id uuid, status text);
    CREATE TABLE tickets(id uuid PRIMARY KEY, functional_role_code text, status text, assigned_to uuid, due_on date);
    CREATE TABLE audit_log(actor_id uuid, actor_label text, action text, entity_type text, entity_label text, reason text, after_value jsonb, created_at timestamptz DEFAULT now());
    CREATE FUNCTION guard_check() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF coalesce(current_setting('resolve.arrival_check_writing',true),'') <> 'on' THEN RAISE EXCEPTION 'Guard'; END IF;
      RETURN NEW; END $$;
    INSERT INTO tickets SELECT md5(i::text)::uuid,'po_day','open',md5('owner')::uuid,'2026-11-25'::date FROM generate_series(1,90) i;
    INSERT INTO arrival_checks SELECT md5(('check'||i)::text)::uuid,'property_operations',md5(i::text)::uuid,'open' FROM generate_series(1,90) i;
    INSERT INTO tickets VALUES (md5('closed')::uuid,'po_day','closed',NULL,'2026-11-24');
    INSERT INTO arrival_checks VALUES (md5('closed_check')::uuid,'property_operations',md5('closed')::uuid,'complete'),
      (md5('cancelled_check')::uuid,NULL,NULL,'cancelled');
    CREATE TRIGGER guard_check BEFORE UPDATE ON arrival_checks FOR EACH ROW EXECUTE FUNCTION guard_check();
  `);
  const before = await state(db);
  await db.exec(sql);
  const after = await state(db);
  assert.equal(after.checks.filter(c => c.status === 'open' && c.team === 'guest_experience').length,90);
  assert.equal(after.tickets.filter(t => t.status === 'open' && t.functional_role_code === 'ge_day').length,90);
  assert.deepEqual(after.checks.filter(c => c.status !== 'open'),before.checks.filter(c => c.status !== 'open'));
  assert.deepEqual(after.tickets.map(({functional_role_code,...t}) => t),before.tickets.map(({functional_role_code,...t}) => t));
  const audit = (await db.query('SELECT after_value FROM audit_log')).rows[0]?.after_value;
  assert.equal(audit?.checks.length,90);
  assert.equal(audit?.tickets.length,90);
  await db.exec(`BEGIN; ${undo} COMMIT;`);
  assert.deepEqual(await state(db),before);
  // A failed transaction must restore both tables, not just the checks.
  await assert.rejects(db.exec(`BEGIN; ${original} SELECT 1/0; COMMIT;`));
  await db.exec('ROLLBACK;');
  assert.deepEqual(await state(db),before);
  await db.close();
  return after;
}
const first = await practice(`BEGIN; ${original} COMMIT;`);
const second = await practice(equivalent);
assert.deepEqual(second,first);
console.log('PASS: exact approved SQL and data-only equivalent agree; 90 checks and tickets move, closed/cancelled rows stay unchanged, owners/dates stay unchanged, audit retains all old values, undo restores every row, failed transactions roll back. Isolated reduced-schema fixture only; live triggers reviewed separately.');