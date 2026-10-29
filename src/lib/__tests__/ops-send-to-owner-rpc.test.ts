import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const home='00000000-0000-4000-8000-000000000010',program='00000000-0000-4000-8000-000000000020',ticket='00000000-0000-4000-8000-000000000030',mirror='00000000-0000-4000-8000-000000000040';
let db:PGlite;
const save=async(kind='owner_task',ticketId:string|null=null,id:string|null=null,department='operations')=>{
  const r=await db.query<{id:string}>('SELECT save_arha_opportunity($1,$2,NULL,$3,$4,$5,\'[]\',true) AS id',[id,home,'Review the kitchen photos',{source_department:department,send_kind:kind,ticket_id:ticketId,due_on:'2026-11-01'},['acknowledge']]);
  const row=r.rows[0];if(!row)throw new Error('No receipt');return row.id;
};
describe('Pending Operations Opportunity change, isolated only',()=>{
  beforeAll(async()=>{db=new PGlite();await db.exec(readFileSync('supabase/tests/fixtures/ops_send_owner_schema.sql','utf8'));await db.exec(readFileSync('docs/pending/ops-send-to-owner/operations-opportunity.sql','utf8'));});
  afterAll(async()=>{await db.close();});
  beforeEach(async()=>{await db.exec('TRUNCATE properties,owner_programs,owner_program_properties,tickets,work_items,owner_notifications');await db.exec("SELECT set_config('test.staff','true',false)");await db.query("INSERT INTO properties VALUES($1,false,'Test home','Test home',NULL);",[home]);await db.query("INSERT INTO owner_programs VALUES($1,'00000000-0000-4000-8000-000000000001','active',NULL)",[program]);await db.query("INSERT INTO owner_program_properties VALUES($1,$2,'included',NULL)",[home,program]);await db.query('INSERT INTO tickets VALUES($1,$2,false)',[ticket,home]);await db.query("INSERT INTO work_items(id,kind,property_id,source_table,source_id) VALUES($1,'task',$2,'tickets',$3)",[mirror,home,ticket]);});
  it('records standalone Operations provenance, due date and one notification',async()=>{const id=await save();const r=await db.query('SELECT department,source_department,linked_task_id,due_on::text FROM work_items WHERE id=$1',[id]);expect(r.rows[0]).toEqual({department:'operations',source_department:'operations',linked_task_id:null,due_on:'2026-11-01'});expect((await db.query('SELECT count(*)::int n FROM owner_notifications')).rows[0]).toEqual({n:1});});
  it('review links to the Ticket mirror without changing the Ticket',async()=>{const id=await save('review',ticket);expect((await db.query('SELECT linked_task_id FROM work_items WHERE id=$1',[id])).rows[0]).toEqual({linked_task_id:mirror});expect((await db.query('SELECT count(*)::int n FROM tickets')).rows[0]).toEqual({n:1});});
  it('rejects a cross-property Ticket and sends nothing',async()=>{await db.query('UPDATE tickets SET property_id=$1 WHERE id=$2',['00000000-0000-4000-8000-000000000099',ticket]);await expect(save('review',ticket)).rejects.toThrow('must belong');expect((await db.query('SELECT count(*)::int n FROM owner_notifications')).rows[0]).toEqual({n:0});});
  it('rejects a missing Ticket and sends nothing',async()=>{await expect(save('review','00000000-0000-4000-8000-000000000099')).rejects.toThrow('must belong');expect((await db.query('SELECT count(*)::int n FROM owner_notifications')).rows[0]).toEqual({n:0});});
  it('preserves existing staff permissions',async()=>{await db.exec("SELECT set_config('test.staff','false',false)");await expect(save()).rejects.toThrow('Only ARHA staff');});
  it('keeps Onboarding provenance for the existing path',async()=>{const id=await save('owner_task',null,null,'onboarding');expect((await db.query('SELECT department FROM work_items WHERE id=$1',[id])).rows[0]).toEqual({department:'onboarding'});});
  it('does not send twice when updating a saved item',async()=>{const id=await save();await save('owner_task',null,id);expect((await db.query('SELECT count(*)::int n FROM owner_notifications')).rows[0]).toEqual({n:1});});
  it('undo is byte-exact to the live function SHA256',()=>{expect(createHash('sha256').update(readFileSync('docs/pending/ops-send-to-owner/undo.sql')).digest('hex')).toBe('71bd9e783d03e37dd36e83453b8689984c506f114165edef5fc62dde74bd2abb');});
});