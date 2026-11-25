import { PGlite } from '@electric-sql/pglite';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite();
const results=[];
let phase='real schema and dependencies';
const q=async(s,p=[]) => (await db.query(s,p)).rows;
const test=async(name,fn)=>{phase=name;await fn();results.push({name,result:'pass'});};
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
try {
 await db.exec(await readFile(new URL('./practice-setup.sql', import.meta.url),'utf8'));
 phase='isolated fixtures with real routing rules';
 await db.exec(`INSERT INTO public.coverage_config(id,timezone,after_hours_start_minute,after_hours_end_minute) VALUES(true,'America/Chicago',1320,480);
 INSERT INTO public.user_roles(user_id,role) VALUES('${id(1)}','tech'),('${id(2)}','tech'),('${id(3)}','manager');
 INSERT INTO public.functional_roles(code,name,team,current_seat_holder,active,available) VALUES ('po_day','Property Coordinator','property_operations','${id(1)}',true,true),('po_evening','Property Coordinator','property_operations','${id(2)}',true,true),('ops_supervisor','Operations Supervisor',null,'${id(3)}',true,true);
 INSERT INTO public.coverage_shifts(role_code,weekday,start_minute,end_minute,active) SELECT r,d,0,1440,true FROM unnest(ARRAY['po_day','po_evening']) r CROSS JOIN generate_series(0,6) d;
 SELECT set_config('resolve.import_quiet','on',false);`);
 for (const [n,source,status,created] of [[10,'email','open','2026-11-15T12:00Z'],[11,'notion','open','2026-11-25T12:00Z'],[12,'notion','open','2026-11-25T12:00Z'],[13,'notion','closed','2026-11-14T12:00Z'],[14,'email','resolved','2026-11-14T12:00Z'],[15,'email','open','2026-11-16T06:00Z'],[16,'email','open','2026-11-25T12:00Z'],[17,'notion','open','2026-11-09T12:00Z']]) {
  await db.query(`INSERT INTO public.tickets(id,title,status,priority,functional_role_code,external_source,created_at,reported_at,is_demo,external_status,unowned_since) VALUES($1,'Fixture',$2,'p1','po_day',$3,$4,$6,false,$5,now()-interval '60 minutes')`,[id(n),status,source,created,n===12?'reopened_in_resolve':null,n===17?'2026-09-15T12:00Z':created]);
 }
 for (const [n,status] of [[20,'due'],[21,'in_progress'],[22,'completed']]) await db.query(`INSERT INTO public.routine_controls(id,title,kind,status,created_at,is_demo) VALUES($1,'Maintenance','maintenance_review',$2,'2026-11-15T12:00Z',false)`,[id(n),status]);
 for (const [n,stage,outcome] of [[30,'new',null],[31,'lost','not_booked'],[32,'converted','booked']]) await db.query(`INSERT INTO public.leads(id,kind,stage,outcome,created_at,is_demo) VALUES($1,'direct_booking',$2,$3,'2026-11-15T12:00Z',false)`,[id(n),stage,outcome]);
 await db.exec(`SELECT set_config('resolve.import_quiet','',false);`);
 const closedBefore=await q(`SELECT to_jsonb(t) AS row FROM public.tickets t WHERE id IN ('${id(13)}','${id(14)}') ORDER BY id`);
 const completedBefore=await q(`SELECT to_jsonb(r) AS row FROM public.routine_controls r WHERE id='${id(22)}'`);
 const routedBefore=await q(`SELECT * FROM public.ticket_route_at('po_day',NULL,'2026-11-26T14:00Z')`);
 phase='apply revised package to isolated schema';
 await db.exec('BEGIN;'+await readFile(new URL('./apply.sql',import.meta.url),'utf8')+'COMMIT;');
 await test('only qualifying OPEN tickets marked',async()=>{
  assert.deepEqual((await q(`SELECT id FROM public.tickets WHERE ops_backlog_at IS NOT NULL ORDER BY id`)).map(r=>r.id),[id(10),id(17)]);
 });
 await test('closed and resolved tickets unchanged in all original fields',async()=>{
  const after=await q(`SELECT to_jsonb(t)-'ops_backlog_at'-'ops_live_at'-'ops_assigned_at' AS row FROM public.tickets t WHERE id IN ('${id(13)}','${id(14)}') ORDER BY id`);assert.deepEqual(after,closedBefore);
 });
 await test('completed routine review unchanged',async()=>{
  assert.deepEqual(await q(`SELECT to_jsonb(r)-'ops_backlog_at'-'ops_live_at'-'ops_archived_at'-'ops_assigned_at' AS row FROM public.routine_controls r WHERE id='${id(22)}'`),completedBefore);
 });
 await test('open-only routine and Direct Booking marking',async()=>{
  assert.equal((await q(`SELECT count(*)::int n FROM public.routine_controls WHERE ops_backlog_at IS NOT NULL`))[0]?.n,2);
  assert.equal((await q(`SELECT count(*)::int n FROM public.leads WHERE ops_backlog_at IS NOT NULL`))[0]?.n,1);
 });
 await test('no restrictive policies hide any history records',async()=>{
  assert.equal((await q(`SELECT count(*)::int n FROM pg_policy WHERE NOT polpermissive`))[0]?.n,0);
  assert.equal((await q(`SELECT count(*)::int n FROM public.tickets`))[0]?.n,8);
 });
 await test('live routing result remains unchanged',async()=>{
  assert.deepEqual(await q(`SELECT * FROM public.ticket_route_at('po_day',NULL,'2026-11-26T14:00Z')`),routedBefore);
 });
 await test('staff notifications for backlog suppressed',async()=>{
  const rows=await q(`SELECT public.notify_staff('${id(1)}','test','Test','Test','ticket','${id(10)}','/tickets/${id(10)}','normal',NULL,false,false) AS id`);assert.equal(rows[0]?.id,null);
  assert.equal((await q(`SELECT count(*)::int n FROM public.staff_notifications WHERE entity_id='${id(10)}'`))[0]?.n,0);
 });
 await test('backlog cannot create escalation',async()=>{
  await assert.rejects(()=>db.query(`INSERT INTO public.escalations(ticket_id,escalated_to_role,status,urgency) VALUES('${id(10)}','supervisor','open','high')`),/Move this item to live work first/);
 });
 await test('timed alerts exclude backlog',async()=>{
  await q(`SELECT public.run_ticket_timed_alerts()`);
  assert.equal((await q(`SELECT count(*)::int n FROM public.ticket_timed_alerts WHERE ticket_id IN ('${id(10)}','${id(11)}','${id(17)}')`))[0]?.n,0);
 });
 await test('all new live sources auto-assign through real routing',async()=>{
  for (const [i,source] of ['manual','email','breezeway','ownerrez'].entries()){
   await db.query(`INSERT INTO public.tickets(id,title,status,priority,functional_role_code,external_source,created_at,is_demo) VALUES($1,'New live work','open','p3','po_day',$2,now(),false)`,[id(100+i),source]);
   const r=(await q(`SELECT assigned_to,current_action_owner FROM public.tickets WHERE id='${id(100+i)}'`))[0];assert.ok([id(1),id(2)].includes(r?.assigned_to));assert.equal(r?.current_action_owner,r?.assigned_to);
  }
 });
 await test('existing unassigned live work not assigned tonight',async()=>{
  assert.equal((await q(`SELECT assigned_to FROM public.tickets WHERE id='${id(15)}'`))[0]?.assigned_to,null);
  assert.equal((await q(`SELECT public.ops_assign_pending_once() AS result`))[0]?.result.assigned,0);
  assert.equal(new Date((await q(`SELECT run_at FROM public.ops_assignment_batch WHERE id='ops-simplification'`))[0]?.run_at).toISOString(),'2026-11-26T14:00:00.000Z');
 });
 await test('one-time assignment is bounded and idempotent',async()=>{
  await db.exec(`UPDATE public.ops_assignment_batch SET run_at=now()-interval '1 minute';`);
  await q(`SELECT public.ops_assign_pending_once()`);
  for (const n of [15,16])assert.ok([id(1),id(2)].includes((await q(`SELECT assigned_to FROM public.tickets WHERE id='${id(n)}'`))[0]?.assigned_to));
  assert.equal((await q(`SELECT public.ops_assign_pending_once() AS result`))[0]?.result.assigned,0);
  assert.equal((await q(`SELECT assigned_to FROM public.tickets WHERE id='${id(10)}'`))[0]?.assigned_to,null);
 });
 await test('undo clears separation and restores original routing function',async()=>{
  await db.exec('BEGIN;'+await readFile(new URL('./undo.sql',import.meta.url),'utf8')+'COMMIT;');
  assert.equal((await q(`SELECT count(*)::int n FROM public.tickets WHERE ops_backlog_at IS NOT NULL`))[0]?.n,0);
  const definition=(await q(`SELECT pg_get_functiondef('public.auto_assign_ticket()'::regprocedure) AS def`))[0]?.def;assert.match(definition,/Automated sources stay unowned/);
 });
 console.log(JSON.stringify({result:'pass',checks:results},null,2));
} catch(error) {
 const message=error instanceof Error?error.message:String(error);
 console.error(JSON.stringify({result:'FAIL',failed:phase,error:message,checks:results},null,2));process.exitCode=1;
} finally {await db.close();}
