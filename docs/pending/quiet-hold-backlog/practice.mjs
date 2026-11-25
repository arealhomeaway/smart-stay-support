import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { withoutQuietNotion, visibleClocks } from '../../../src/lib/notion-ticket-display.ts';
import { slaState } from '../../../src/lib/tickets.ts';

const input = process.env['QUIET_HOLD_CAPTURE'];
if (!input) throw new Error('QUIET_HOLD_CAPTURE must point to the temporary real-row capture');
const captured = JSON.parse(readFileSync(input, 'utf8'));
const db = new PGlite();
let checks = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
await db.exec(`CREATE TABLE tickets (id uuid PRIMARY KEY, row_value jsonb NOT NULL);
  CREATE TABLE undo_receipt (ticket_id uuid PRIMARY KEY, previous_import_hold text);`);
for (const t of captured.tickets) await db.query(
  'INSERT INTO tickets VALUES ($1,$2)', [t.id, JSON.stringify(t)]);
const open = `row_value->>'status' IN ('open','dispatched','in_progress','waiting','awaiting_guest')
  AND row_value->>'archived_at' IS NULL AND (row_value->>'is_demo')::boolean = false`;
const c = `${open} AND row_value->>'external_source' = 'notion'
  AND (row_value->>'reported_at')::timestamptz < (row_value->>'created_at')::timestamptz - interval '30 days'
  AND row_value->>'import_hold' IS NULL`;
const d = `${open} AND row_value->>'external_source' IS DISTINCT FROM 'notion'
  AND (row_value->>'created_at')::timestamptz < '2026-11-16 06:00:00+00'::timestamptz`;
const count = async (where) => (await db.query(`SELECT count(*)::int AS n FROM tickets WHERE ${where}`)).rows[0]?.n;
check(await count(open), 882);
check(await count(c), 0);
check(await count(d), 0);
const original = (await db.query('SELECT * FROM tickets ORDER BY id')).rows;
await db.exec('BEGIN');
const changed = await db.query(`UPDATE tickets SET row_value=jsonb_set(row_value,'{import_hold}','"backlog_review"')
  WHERE ${c} RETURNING id`);
check(changed.rows.length, 0);
// D is deliberately never updated: existing rules cannot quiet non-Notion tickets.
await db.exec('COMMIT');
check((await db.query('SELECT * FROM tickets ORDER BY id')).rows, original);
check((await db.query('SELECT * FROM undo_receipt')).rows.length, 0);
// With an empty changed-ID receipt, exact undo must not issue a broad update.
check((await db.query('SELECT 0 AS tickets_to_restore')).rows[0]?.tickets_to_restore, 0);
check((await db.query('SELECT * FROM tickets ORDER BY id')).rows, original);
const ordinary = { id: 'ordinary', external_source: 'email', external_status: null,
  status: 'open', priority: 'p2', import_hold: 'backlog_review',
  response_due_at: '2026-11-15T06:00:00Z', acknowledged_at: null };
check(withoutQuietNotion([ordinary]).length, 1);
const clocks = slaState(ordinary);
check(visibleClocks(ordinary, clocks), clocks);
check(clocks.breached, true);
const quiet = { ...ordinary, external_source: 'notion', external_status: 'In progress' };
check(withoutQuietNotion([quiet]).length, 0);
check(visibleClocks(quiet, slaState(quiet)).breached, false);
await db.close();
console.log(`${checks} isolated no-op and unchanged-behavior checks passed; no live writes.`);