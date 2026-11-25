import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
const checks=[];
const sql=await readFile(new URL('./apply.sql',import.meta.url),'utf8');
function definition(name){
 const start=sql.indexOf(`CREATE OR REPLACE FUNCTION ${name}(`);
 if(start<0)throw new Error(`Missing ${name}`);
 const next=sql.indexOf('CREATE OR REPLACE FUNCTION ',start+1);
 const section=sql.slice(start,next<0?sql.length:next);
 const match=section.match(/\bAS (\$[a-z_]*\$)/i);
 if(!match)throw new Error(`No function body for ${name}`);
 const delimiter=match[1];
 if(!delimiter)throw new Error(`Missing body delimiter for ${name}`);
 const end=section.indexOf(delimiter,section.indexOf(delimiter)+delimiter.length);
 return section.slice(0,end+delimiter.length)+';';
}
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const query=async(s,p=[]) => (await db.query(s,p)).rows;
const check=async(name,fn)=>{await fn();checks.push(name);};
try {
 await db.exec(`CREATE SCHEMA private;
 CREATE TABLE public.tickets(id uuid PRIMARY KEY,status text,title text,external_source text,external_status text,created_at timestamptz,reported_at timestamptz,ops_backlog_at timestamptz,ops_live_at timestamptz,archived_at timestamptz,assigned_to uuid,current_action_owner uuid,due_on date,response_due_at timestamptz,action_due_at timestamptz,is_demo boolean DEFAULT false);
 CREATE TABLE public.ops_backlog_history(entity_type text,entity_id uuid,action text,reason text,before_value jsonb,after_value jsonb);
 CREATE TABLE public.ops_assignment_batch_items(batch_id text,entity_type text,entity_id uuid);
 CREATE TABLE public.staff_notifications(entity_type text,entity_id uuid);
 CREATE TABLE public.escalations(ticket_id uuid);`);
 for(const name of ['private.ops_notion_recent','public.ops_is_backlog_entity','public.ops_is_quiet_notion_entity','private.ops_notification_guard','private.ops_escalation_guard','public.auto_assign_ticket'])await db.exec(definition(name));
 const imported='2026-11-09T12:00:00Z';
 for(const [n,source,status,reported,marker,started,owner] of [[1,'notion','open','2026-10-10T12:00:00Z',true,false,id(99)],[2,'notion','open','2026-10-10T11:59:59Z',false,false,null],[3,'notion','closed','2025-01-01T12:00:00Z',false,false,id(99)],[4,'notion','resolved','2025-01-01T12:00:00Z',false,false,id(99)],[5,'notion','open','2026-10-28T12:00:00Z',false,true,null],[6,'email','open','2026-11-09T12:00:00Z',false,false,null]]){
  await db.query(`INSERT INTO public.tickets VALUES($1,$2,'Fixture',$3,$4,$5,$6,$7,NULL,NULL,$8,$8,'2026-10-20','2026-10-20T12:00Z','2026-10-20T13:00Z',false)`,[id(n),status,source,started?'reopened_in_resolve':null,imported,reported,marker?imported:null,owner]);
 }
 const before=await query(`SELECT id,to_jsonb(t)-'ops_backlog_at' AS value FROM public.tickets t ORDER BY id`);
 await check('exactly 30 days is recent; one second older is backlog',async()=>{
  assert.equal((await query(`SELECT private.ops_notion_recent('2026-10-10T12:00Z','2026-11-09T12:00Z') AS v`))[0]?.v,true);
  assert.equal((await query(`SELECT private.ops_notion_recent('2026-10-10T11:59:59Z','2026-11-09T12:00Z') AS v`))[0]?.v,false);
 });
 await check('restoration and marking preserve owner, status, dates and existing row content',async()=>{
  const restore=sql.split('\n').find(l=>l.startsWith('UPDATE public.tickets SET ops_backlog_at=NULL WHERE'));
  const mark=sql.split('\n').find(l=>l.startsWith('WITH moved AS (UPDATE public.tickets'));
  if(!restore||!mark)throw new Error('Missing real restoration or marking statement');
  await db.exec(restore+mark);
  assert.deepEqual(await query(`SELECT id,to_jsonb(t)-'ops_backlog_at' AS value FROM public.tickets t ORDER BY id`),before);
  assert.equal((await query(`SELECT ops_backlog_at FROM public.tickets WHERE id='${id(1)}'`))[0]?.ops_backlog_at,null);
  assert.deepEqual((await query(`SELECT id FROM public.tickets WHERE ops_backlog_at IS NOT NULL ORDER BY id`)).map(r=>r.id),[id(2),id(6)]);
 });
 await check('closed and resolved Notion records have no backlog marker',async()=>{
  assert.equal((await query(`SELECT count(*)::int n FROM public.tickets WHERE status IN ('closed','resolved') AND ops_backlog_at IS NOT NULL`))[0]?.n,0);
 });
 await check('8 AM capture skips every Notion import, including started imports',async()=>{
  const capture=sql.split('\n').find(l=>l.startsWith('INSERT INTO public.ops_assignment_batch_items SELECT')&&l.includes("'ticket'"));
  if(!capture)throw new Error('Missing capture statement');
  await db.exec(`INSERT INTO public.tickets(id,status,external_source,created_at,is_demo) VALUES('${id(7)}','open','email','2026-11-25T12:00Z',false);`+capture);
  assert.deepEqual((await query(`SELECT entity_id FROM public.ops_assignment_batch_items`)).map(r=>r.entity_id),[id(7)]);
  assert.ok(sql.includes("IF t.external_source='notion' OR t.ops_backlog_at"));
 });
 await check('new Notion inserts preserve mapped assignees',async()=>{
  await db.exec(`CREATE TRIGGER tickets_auto_assign BEFORE INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.auto_assign_ticket();
   INSERT INTO public.tickets(id,status,external_source,assigned_to,current_action_owner,created_at,reported_at) VALUES('${id(8)}','open','notion','${id(99)}','${id(99)}','2026-11-09T12:00Z','2026-10-28T12:00Z');`);
  assert.equal((await query(`SELECT assigned_to FROM public.tickets WHERE id='${id(8)}'`))[0]?.assigned_to,id(99));
 });
 await check('quiet recent imports cannot create staff notices',async()=>{
  await db.exec(`CREATE TRIGGER a_ops_notification_guard BEFORE INSERT ON public.staff_notifications FOR EACH ROW EXECUTE FUNCTION private.ops_notification_guard();
  INSERT INTO public.staff_notifications VALUES('ticket','${id(1)}');`);
  assert.equal((await query(`SELECT count(*)::int n FROM public.staff_notifications`))[0]?.n,0);
 });
 await check('quiet recent imports cannot create escalations',async()=>{
  await db.exec(`CREATE TRIGGER a_ops_escalation_guard BEFORE INSERT ON public.escalations FOR EACH ROW EXECUTE FUNCTION private.ops_escalation_guard();`);
  await assert.rejects(()=>db.query(`INSERT INTO public.escalations VALUES('${id(1)}')`),/Take this Notion ticket before escalating it/);
 });
 console.log(JSON.stringify({result:'pass',scope:'isolated Notion correction only; NOT full ops-simplification validation',checks},null,2));
} catch(error){console.error(JSON.stringify({result:'FAIL',error:error instanceof Error?error.message:String(error),checks},null,2));process.exitCode=1;}
finally{await db.close();}
