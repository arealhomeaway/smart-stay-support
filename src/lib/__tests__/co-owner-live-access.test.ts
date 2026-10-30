import { beforeAll, afterAll, describe, it, expect } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

type Fn = { schema: string; name: string; signature: string; definition_base64: string; sha256: string; grants: string | null; acl: {grantee: string; grantable: boolean}[] };
type Policy = { schemaname: string; tablename: string; policyname: string; cmd: string; qual: string | null; with_check: string | null; permissive: string; roles: string[] };
const root = 'docs/pending/co-owners/';
const live = JSON.parse(readFileSync(root+'pass2-live-reference.json','utf8')) as {functions: Fn[]; policies: Policy[]};
const proof = JSON.parse(readFileSync(root+'pass2-undo-proof.json','utf8')) as {functions: (Fn & {replacement_base64: string; changes: [string,string][]})[]};
const uid = (n:number) => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const primary=uid(1),coOwner=uid(2),other=uid(3),staff=uid(4),a=uid(10),b=uid(20),ha=uid(30),hb=uid(40),oa=uid(50),ob=uid(60),wa=uid(70),wb=uid(80);
let db:PGlite;
let beforeExposure:unknown[];
let staffBefore:unknown[];
let aclBefore:unknown[];
const decode = (s:string) => Buffer.from(s,'base64').toString('utf8');
const sha = (s:string) => createHash('sha256').update(s).digest('hex');
const ident = (s:string) => '"'+s.replaceAll('"','""')+'"';
async function actor(user:string|null) { await db.query("SELECT set_config('request.test_uid',$1,false)",[user??'']); }
async function exposure() { return (await db.query(`SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private') AND p.prosecdef AND has_function_privilege('anon',p.oid,'EXECUTE') ORDER BY 1,2,3`)).rows; }
async function acls() { return (await db.query(`SELECT n.nspname,p.proname,p.proacl::text acl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private') AND p.proname IN ('owns_program','owner_sees_property','owner_can_see_property','owner_owns_program','owner_program_readable','owns_owner_request') ORDER BY 1,2`)).rows; }
async function gates(user:string|null,program:string,home:string,work:string) {
 await actor(user);
 return (await db.query<{owns:boolean;sees:boolean;included:boolean;portal:boolean;readable:boolean;conversation:boolean}>(`SELECT private.owns_program($1,$2) owns,private.owner_sees_property($1,$3) sees,private.owner_can_see_property($1,$3) included,public.owner_owns_program($2) portal,private.owner_program_readable($1,$2,false) readable,private.owns_owner_request($4,$1) conversation`,[user,program,home,work])).rows[0];
}
async function rows(user:string|null) {
 await actor(user); await db.exec('SET ROLE authenticated');
 try { return (await db.query(`SELECT 'work' kind,id FROM work_items UNION ALL SELECT 'file',id FROM work_item_resources UNION ALL SELECT 'message',id FROM owner_request_messages ORDER BY 1,2`)).rows; }
 finally {await db.exec('RESET ROLE');}
}
async function restore() { await db.exec(readFileSync(root+'undo/03_access_conversion.sql','utf8')); }
async function convert() { await db.exec(readFileSync(root+'03_access_conversion.sql','utf8')); }

describe('pending co-owner shared gates from captured LIVE definitions',()=>{
 beforeAll(async()=>{
  db=new PGlite(); await db.exec(readFileSync('supabase/tests/fixtures/co_owner_live_access_schema.sql','utf8'));
  // Dependency creation order, with the exact live bodies and captured ACLs.
  const order=['private.has_role','public.has_role','public.is_onboarding_director','private.demo_owner_link_ok','private.owns_program','private.owner_sees_property','private.owner_can_see_property','public.owner_owns_program','private.owns_owner_request','private.owner_program_readable','private.owner_current_property_for_actor','private.owner_approval_program'];
  for(const name of order){
   const f=live.functions.find(f=>f.schema+'.'+f.name===name); if(!f) throw new Error('Missing live dependency '+name);
   expect(sha(decode(f.definition_base64))).toBe(f.sha256);
   await db.exec(decode(f.definition_base64));
   const signature=f.schema+'.'+f.name+'('+f.signature+')';
   await db.exec(`REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC,anon,authenticated,service_role;`);
   for(const grant of f.acl??[]) await db.exec(`GRANT EXECUTE ON FUNCTION ${signature} TO ${grant.grantee==='PUBLIC'?'PUBLIC':ident(grant.grantee)}${grant.grantable?' WITH GRANT OPTION':''};`);
  }
  for(const p of live.policies.filter(p=>p.schemaname==='public')){
   await db.exec(`CREATE POLICY ${ident(p.policyname)} ON ${p.schemaname}.${p.tablename} AS ${p.permissive} FOR ${p.cmd} TO ${p.roles.map(ident).join(',')}${p.qual?' USING ('+p.qual+')':''}${p.with_check?' WITH CHECK ('+p.with_check+')':''};`);
  }
  await db.exec(`INSERT INTO property_owners VALUES('${oa}',true),('${ob}',true);
   INSERT INTO auth.users(id,email) VALUES('${primary}','primary@example.invalid'),('${coOwner}','co@example.invalid'),('${other}','other@example.invalid'),('${staff}','staff@example.invalid');
   INSERT INTO user_roles VALUES('${primary}','owner'),('${coOwner}','owner'),('${other}','owner'),('${staff}','admin');
   INSERT INTO owner_programs VALUES('${a}','${primary}','${ha}','${oa}',false,NULL),('${b}','${other}','${hb}','${ob}',false,NULL);
   INSERT INTO properties VALUES('${ha}','${oa}',false,NULL),('${hb}','${ob}',false,NULL);
   INSERT INTO owner_program_properties VALUES('${a}','${ha}','included',NULL,false),('${b}','${hb}','included',NULL,false);
   INSERT INTO work_items VALUES('${wa}','${a}','opportunity','open',NULL),('${wb}','${b}','opportunity','open',NULL);
   INSERT INTO work_item_resources VALUES('${uid(90)}','${wa}',NULL),('${uid(91)}','${wb}',NULL);
   INSERT INTO owner_reviews VALUES('${uid(100)}','${a}',NULL,'released'),('${uid(101)}','${b}',NULL,'released');
   INSERT INTO owner_request_messages VALUES('${uid(110)}','${uid(100)}',NULL),('${uid(111)}','${uid(101)}',NULL),('${uid(112)}',NULL,'${wa}');`);
  beforeExposure=await exposure();aclBefore=await acls();staffBefore=[await gates(staff,a,ha,wa),await rows(staff)];
  await db.exec(readFileSync(root+'01_membership_foundation.sql','utf8'));
  await db.exec(`INSERT INTO program_members(program_id,user_id,role) VALUES('${a}','${coOwner}','co_owner');`);
  expect(await exposure()).toEqual(beforeExposure);
  await convert();
 },30000);
 afterAll(async()=>{await db.close();});
 it('primary and co-owner pass every converted helper for program A',async()=>{
  const expected={owns:true,sees:true,included:true,portal:true,readable:true,conversation:true};
  expect(await gates(primary,a,ha,wa)).toEqual(expected);expect(await gates(coOwner,a,ha,wa)).toEqual(expected);
 });
 it('co-owner cannot pass any converted helper for program B',async()=>{
  expect(await gates(coOwner,b,hb,wb)).toEqual({owns:false,sees:false,included:false,portal:false,readable:false,conversation:false});
 });
 it('primary and co-owner see identical live-policy rows including released conversations and resources',async()=>{
  const p=await rows(primary);expect(p.length).toBe(4);expect(await rows(coOwner)).toEqual(p);expect(p.some(x=>x.id===wb)).toBe(false);
 });
 it('removed member immediately fails all gates and RLS reads without deleting authored membership history',async()=>{
  await db.exec(`UPDATE program_members SET removed_at=now() WHERE user_id='${coOwner}';`);
  expect(await gates(coOwner,a,ha,wa)).toEqual({owns:false,sees:false,included:false,portal:false,readable:false,conversation:false});expect(await rows(coOwner)).toEqual([]);
  expect((await db.query('SELECT count(*)::int n FROM program_members WHERE user_id=$1 AND removed_at IS NOT NULL',[coOwner])).rows[0]).toEqual({n:1});
  await db.exec(`UPDATE program_members SET removed_at=NULL WHERE user_id='${coOwner}';`);
 });
 it('staff results including preview authority are identical before and after conversion',async()=>{
  expect([await gates(staff,a,ha,wa),await rows(staff)]).toEqual(staffBefore);
  expect((await db.query('SELECT private.owner_program_readable($1,$2,true) ok',[staff,a])).rows[0]).toEqual({ok:true});
  await restore();expect((await db.query('SELECT private.owner_program_readable($1,$2,true) ok',[staff,a])).rows[0]).toEqual({ok:true});await convert();
 });
 it('signed-out caller fails every helper and has no policy rows; anon schema access is refused',async()=>{
  expect(await gates(null,a,ha,wa)).toEqual({owns:false,sees:false,included:false,portal:false,readable:false,conversation:false});expect(await rows(null)).toEqual([]);
  await db.exec('SET ROLE anon');try{await expect(db.query('SELECT private.owns_program($1,$2)',[primary,a])).rejects.toThrow('permission denied');}finally{await db.exec('RESET ROLE');}
 });
 it('captured recipient mapping stays primary-only even after shared eligibility helper converts',async()=>{
  for(const user of [primary,coOwner]){
   expect((await db.query(`SELECT private.owner_approval_program(ROW(NULL,'owner',false,$1,$2)::public.approvals) program`,[user,ha])).rows[0]).toEqual({program:user===primary?a:null});
  }
  expect((await db.query('SELECT owner_user_id FROM owner_programs WHERE id=$1',[a])).rows[0]).toEqual({owner_user_id:primary});
 });
 it('anonymous-executable SECURITY DEFINER identity set and exact ACLs are unchanged',async()=>{
  expect(beforeExposure.length).toBe(1);expect(await exposure()).toEqual(beforeExposure);expect(await acls()).toEqual(aclBefore);
 });
 it('archive, inclusion, canonical-owner, banned-account and demo conditions retain their original behavior',async()=>{
  await db.exec(`UPDATE owner_program_properties SET inclusion_status='excluded' WHERE program_id='${a}';`);
  expect((await gates(coOwner,a,ha,wa))?.included).toBe(false);expect((await gates(coOwner,a,ha,wa))?.sees).toBe(true);
  await db.exec(`UPDATE owner_program_properties SET inclusion_status='included' WHERE program_id='${a}'; UPDATE auth.users SET banned_until=now()+interval '1 day' WHERE id='${coOwner}';`);
  expect((await gates(coOwner,a,ha,wa))?.readable).toBe(false);
  await db.exec(`UPDATE auth.users SET banned_until=NULL WHERE id='${coOwner}'; UPDATE owner_programs SET archived_at=now() WHERE id='${a}';`);
  expect((await gates(coOwner,a,ha,wa))?.portal).toBe(false);expect((await gates(coOwner,a,ha,wa))?.conversation).toBe(false);
  await db.exec(`UPDATE owner_programs SET archived_at=NULL,is_demo=true WHERE id='${a}';`);
  expect((await gates(coOwner,a,ha,wa))?.portal).toBe(false);expect((await gates(coOwner,a,ha,wa))?.readable).toBe(false);
  await db.exec(`UPDATE owner_programs SET is_demo=false WHERE id='${a}'; UPDATE owner_reviews SET status='prepared' WHERE id='${uid(100)}';`);
  expect((await rows(coOwner)).some(x=>x.id===uid(110))).toBe(false);
  await db.exec(`UPDATE owner_reviews SET status='released' WHERE id='${uid(100)}';`);
 });
 it('undo restores every exact live function definition, original policy behavior and ACL',async()=>{
  await restore();
  for(const f of proof.functions){
   const types=f.signature.split(',').map(arg=>arg.trim().split(' ').slice(1).join(' ')).join(',');
   const r=await db.query<{definition:string}>('SELECT pg_get_functiondef($1::regprocedure) definition',[f.schema+'.'+f.name+'('+types+')']);
   expect(r.rows[0]?.definition).toBe(decode(f.definition_base64));
  }
  expect(await acls()).toEqual(aclBefore);expect(await exposure()).toEqual(beforeExposure);expect(await rows(coOwner)).toEqual([]);await convert();
 });
 it('staged replacements differ only by the enumerated owner predicates',()=>{
  for(const f of proof.functions){let s=decode(f.definition_base64);for(const [a,b] of f.changes)s=s.replace(a,b);expect(s).toBe(decode(f.replacement_base64));expect(sha(decode(f.definition_base64))).toBe(f.sha256);}
 });
});