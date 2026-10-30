import { beforeAll, afterAll, describe, it, expect } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

type Fn = { schema: string; name: string; signature: string; definition_base64: string; sha256: string; grants: string | null; acl: {grantee: string; grantable: boolean}[] };
type Policy = { schemaname: string; tablename: string; policyname: string; cmd: string; qual: string | null; with_check: string | null; permissive: string; roles: string[] };
const root = 'docs/pending/co-owners/';
const live = JSON.parse(readFileSync(root+'pass2-live-reference.json','utf8')) as {functions: Fn[]; policies: Policy[]};
const proof = JSON.parse(readFileSync(root+'pass2-undo-proof.json','utf8')) as {functions: (Fn & {replacement_base64: string; changes: [string,string][]})[]; policy: Policy};
const uid = (n:number) => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const primary=uid(1),coOwner=uid(2),other=uid(3),staff=uid(4),a=uid(10),b=uid(20),ha=uid(30),hb=uid(40),oa=uid(50),ob=uid(60),wa=uid(70),wb=uid(80);
let db:PGlite;
let beforeExposure:unknown[];
let staffBefore:string;
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
 try { return (await db.query<{kind:string;id:string}>(`SELECT 'work' kind,id FROM work_items UNION ALL SELECT 'file',id FROM work_item_resources UNION ALL SELECT 'message',id FROM owner_request_messages ORDER BY 1,2`)).rows; }
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
  beforeExposure=await exposure();aclBefore=await acls();staffBefore=JSON.stringify([await gates(staff,a,ha,wa),await rows(staff)]);
  await db.exec(readFileSync(root+'01_membership_foundation.sql','utf8'));
  await db.exec(`INSERT INTO program_members(program_id,user_id,role) VALUES('${a}','${coOwner}','co_owner');`);
  expect(await exposure()).toEqual(beforeExposure);
  await convert();
 });
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
  expect(JSON.stringify([await gates(staff,a,ha,wa),await rows(staff)])).toBe(staffBefore);
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
 it('all substituted live definitions match the staged bytes exactly',async()=>{
  for(const f of proof.functions){
   const types=f.signature.split(',').map(arg=>arg.trim().split(' ').slice(1).join(' ')).join(',');
   const result=await db.query<{definition:string}>('SELECT pg_get_functiondef($1::regprocedure) definition',[f.schema+'.'+f.name+'('+types+')']);
   expect(result.rows[0]?.definition).toBe(decode(f.replacement_base64));
  }
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
  await db.exec(`UPDATE property_owners SET active=false WHERE id='${oa}';`);
  expect((await gates(coOwner,a,ha,wa))?.readable).toBe(false);
  await db.exec(`UPDATE property_owners SET active=true WHERE id='${oa}';`);
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
 it('undo restores the exact catalog policy predicate, roles, command and permissiveness',async()=>{
  await restore();
  const result=await db.query<Policy>(`SELECT schemaname,tablename,policyname,cmd,qual,with_check,permissive,roles FROM pg_policies WHERE schemaname=$1 AND tablename=$2 AND policyname=$3`,[proof.policy.schemaname,proof.policy.tablename,proof.policy.policyname]);
  const original=live.policies.find(p=>p.policyname===proof.policy.policyname);
  expect(result.rows[0]).toEqual(original);await convert();
 });
 it('staged replacements differ only by the enumerated owner predicates',()=>{
  for(const f of proof.functions){let s=decode(f.definition_base64);for(const [a,b] of f.changes)s=s.replace(a,b);expect(s).toBe(decode(f.replacement_base64));expect(sha(decode(f.definition_base64))).toBe(f.sha256);}
 });
});
// ---------------------------------------------------------------------------
// Pass 3A: remaining direct owner gates, loaded from exact LIVE definitions.
// ---------------------------------------------------------------------------
type Captured = { schema: string; name: string; signature: string; acl: string | null; sha256: string; definition_base64: string; replacement_base64?: string; changes?: [string,string][] };
const ref3 = JSON.parse(readFileSync(root+'pass3a-live-reference.json','utf8')) as {targets: Captured[]; inherited: Captured[]; dependencies: Captured[]};
describe('pending co-owner remaining gates (04) from captured LIVE definitions',()=>{
 let d:PGlite; let expBefore:unknown[]; let aclsBefore:unknown[]; let staffBefore3:string;
 const P=uid(201),C=uid(202),R=uid(203),O=uid(204),S=uid(205),A=uid(210),B=uid(220),HA=uid(230),HB=uid(240),OA=uid(250),OB=uid(260);
 const WA=uid(270),WB=uid(280),TA=uid(290),AP=uid(300),LA=uid(310),LB=uid(320),DA=uid(330),DS=uid(331);
 const as=async(u:string|null)=>{await d.query("SELECT set_config('request.test_uid',$1,false)",[u??'']);};
 const types=(sig:string)=>sig?sig.split(',').map(a=>{const p=a.trim().replace(/ DEFAULT .*$/,'').split(' ');return p.slice(1).join(' ');}).join(','):'';
 const reg=(f:Captured)=>`${f.schema}.${f.name}(${types(f.signature)})`;
 const exp3=async()=>(await d.query(`SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) s FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private') AND p.prosecdef AND has_function_privilege('anon',p.oid,'EXECUTE') ORDER BY 1,2,3`)).rows;
 const acl3=async()=>(await d.query(`SELECT n.nspname,p.proname,p.proacl::text acl,p.prosecdef,p.proconfig::text cfg FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname = ANY($1) ORDER BY 1,2`,[ref3.targets.map(t=>t.name)])).rows;
 const one=async<T>(sql:string,args:unknown[]=[])=>(await d.query<T>(sql,args)).rows[0] as T;
 const fails=async(sql:string,args:unknown[]=[])=>{let err='';try{await d.query(sql,args);}catch(e){err=String((e as Error).message);}return err;};
 const load=async(f:Captured,body?:string)=>{
  const src=body??decode(f.definition_base64); if(!body) expect(sha(src)).toBe(f.sha256); await d.exec(src);
  if(!body){await d.exec(`REVOKE ALL ON FUNCTION ${reg(f)} FROM PUBLIC,anon,authenticated,service_role;`);
   if(f.acl===null) await d.exec(`GRANT EXECUTE ON FUNCTION ${reg(f)} TO PUBLIC;`);
   for(const m of (f.acl??'').matchAll(/([a-z_]+)=X\//g)) if(m[1]!=='postgres') await d.exec(`GRANT EXECUTE ON FUNCTION ${reg(f)} TO ${m[1]};`);}
 };
 const staffView=async()=>{await as(S);return JSON.stringify([await one('SELECT public.owner_hours_eligibility($1) r',[A]),await one('SELECT public.can_view_owner_library_video($1) r',[LB]),
  await fails('SELECT public.tag_owner_upload($1,$2,$3)',[DS,'photo',WA])]);};
 beforeAll(async()=>{
  d=new PGlite(); await d.exec(readFileSync('supabase/tests/fixtures/co_owner_remaining_access_schema.sql','utf8'));
  await d.exec('SET check_function_bodies=off');
  const p2=['private.has_role','public.has_role','public.is_onboarding_director','private.demo_owner_link_ok','private.owner_program_readable'];
  for(const n of p2){const f=live.functions.find(f=>f.schema+'.'+f.name===n)!;await load({...f,acl:'{'+(f.acl??[]).map(g=>g.grantee+'=X/postgres').join(',')+'}'} as Captured);}
  for(const f of ref3.dependencies.filter(f=>f.name!=='notify_opportunity_staff')) await load(f); // staff alert side effect stays stubbed
  for(const f of ref3.targets) await load(f);
  await d.exec(`INSERT INTO property_owners VALUES('${OA}',true),('${OB}',true);
   INSERT INTO auth.users(id,email) VALUES('${P}','p@owners.test'),('${C}','c@owners.test'),('${R}','r@owners.test'),('${O}','o@owners.test'),('${S}','s@staff.test');
   INSERT INTO profiles VALUES('${P}','Pat Primary'),('${C}','Casey Co'),('${R}','Riley Removed'),('${S}','Sam Staff');
   INSERT INTO user_roles VALUES('${P}','owner'),('${C}','owner'),('${R}','owner'),('${O}','owner'),('${S}','admin');
   INSERT INTO owner_programs VALUES('${A}','${P}','${HA}','${OA}',false,NULL,'active',current_date-30,NULL),('${B}','${O}','${HB}','${OB}',false,NULL,'active',current_date-30,NULL);
   INSERT INTO properties VALUES('${HA}','${OA}',false,NULL,'1 A St'),('${HB}','${OB}',false,NULL,'2 B St');
   INSERT INTO owner_program_properties VALUES('${A}','${HA}','included',NULL,false,true,current_date-40),('${B}','${HB}','included',NULL,false,true,current_date-40);
   INSERT INTO owner_opportunity_library VALUES('${LA}',false),('${LB}',false);
   INSERT INTO onboarding_tasks VALUES('${TA}','${HA}',NULL,true,'awaiting_owner');
   INSERT INTO approvals(id,entity_type,entity_id,property_id,status) VALUES('${AP}','onboarding_task','${TA}','${HA}','pending');
   INSERT INTO work_items(id,program_id,property_id,kind,status,source,source_task_id,response_types,title,library_template_id) VALUES
    ('${WA}','${A}','${HA}','opportunity','awaiting_owner','arha','${TA}','{decision,feedback}','Approve paint','${LA}'),
    ('${WB}','${B}','${HB}','opportunity','awaiting_owner','arha',NULL,'{decision,feedback}','Other home','${LB}');
   INSERT INTO documents VALUES('${DA}','${C}',NULL,'${HA}',NULL,NULL),('${DS}','${S}',NULL,'${HA}',NULL,NULL);
   INSERT INTO owner_notifications(id,program_id,owner_user_id,kind,priority) VALUES('${uid(340)}','${A}','${P}','review_ready','p3'),('${uid(341)}','${B}','${O}','review_ready','p3');
   INSERT INTO str_participation_reports VALUES('${uid(350)}','${A}','${HA}','released',1,NULL,NULL,NULL,NULL,'{}');`);
  expBefore=await exp3(); aclsBefore=await acl3(); staffBefore3=await staffView();
  await d.exec(readFileSync(root+'01_membership_foundation.sql','utf8'));
  await d.exec(`INSERT INTO program_members(program_id,user_id,role) VALUES('${A}','${C}','co_owner');
   INSERT INTO program_members(program_id,user_id,role,removed_at) VALUES('${A}','${R}','co_owner',now());
   INSERT INTO owner_time_entries(id,program_id,owner_user_id,minutes) VALUES('${uid(360)}','${A}','${P}',60),('${uid(361)}','${A}','${C}',30),('${uid(362)}','${A}','${R}',45),('${uid(363)}','${B}','${O}',90);`);
  const readable=proof.functions.find(f=>f.name==='owner_program_readable')!; await d.exec(decode(readable.replacement_base64));
  await d.exec(readFileSync(root+'04_access_remaining.sql','utf8'));
 });
 afterAll(async()=>{await d.close();});
 it('hour authority (lock_owner_time_program): primary and co-owner pass for A; B, removed and signed-out fail',async()=>{
  for(const u of [P,C]){await as(u);expect((await one<{id:string}>('SELECT (private.lock_owner_time_program($1,$2,false,true)).id',[A,u])).id).toBe(A);}
  await as(C);expect(await fails('SELECT private.lock_owner_time_program($1,$2,false,true)',[B,C])).toContain('not available to you');
  await as(R);expect(await fails('SELECT private.lock_owner_time_program($1,$2,false,true)',[A,R])).toContain('not available to you');
  await as(null);expect(await fails('SELECT private.lock_owner_time_program($1,NULL,false,true)',[A])).toContain('not open');
 });
 it('every member reads every member entry, including a removed member past hours, and the total sums them',async()=>{
  for(const u of [P,C]){await as(u);
   const r=(await d.query<{item:{owner_user_id:string;minutes:number}}>(`SELECT item FROM public.read_owner_participation('entries',$1)`,[A])).rows;
   expect(r.map(x=>x.item.owner_user_id).sort()).toEqual([P,C,R].sort());expect(r.reduce((s,x)=>s+Number(x.item.minutes),0)).toBe(135);}
  await as(C);expect((await d.query(`SELECT 1 FROM public.read_owner_participation('entries',$1)`,[B])).rows).toEqual([]);
  await as(R);expect((await d.query(`SELECT 1 FROM public.read_owner_participation('entries',$1)`,[A])).rows).toEqual([]);
 });
 it('in-app notifications are shared by program with one row and shared read state',async()=>{
  for(const u of [P,C]){await as(u);expect((await d.query(`SELECT id FROM public.read_owner_participation('alerts',$1)`,[A])).rows).toEqual([{id:uid(340)}]);}
  await as(C);expect(await one('SELECT public.mark_owner_alerts_read($1) n',[[uid(340),uid(341)]])).toEqual({n:1});
  expect(await one('SELECT count(*)::int n, count(read_at)::int r FROM owner_notifications WHERE program_id=$1',[A])).toEqual({n:1,r:1});
  expect(await one('SELECT read_at FROM owner_notifications WHERE id=$1',[uid(341)])).toEqual({read_at:null});
 });
 it('co-owner can view, tag uploads, open library video and reports for A only',async()=>{
  await as(C);await d.query('SELECT public.mark_owner_opportunity_viewed($1)',[WB]);await d.query('SELECT public.mark_owner_opportunity_viewed($1)',[WA]);
  expect(await one('SELECT (viewed_at IS NOT NULL) a,(SELECT viewed_at IS NOT NULL FROM work_items WHERE id=$2) b FROM work_items WHERE id=$1',[WA,WB])).toEqual({a:true,b:false});
  expect(await one('SELECT public.can_view_owner_library_video($1) a, public.can_view_owner_library_video($2) b',[LA,LB])).toEqual({a:true,b:false});
  expect(await fails('SELECT public.tag_owner_upload($1,$2,$3)',[DA,'photo',WB])).toContain('different home');
  expect(await fails('SELECT public.tag_owner_upload($1,$2,$3)',[DA,'photo',WA])).toBe('');
  expect((await one<{r:{reports:unknown[]}}>('SELECT public.owner_str_reports() r')).r.reports.length).toBe(0);
  await d.exec(`UPDATE owner_programs SET status='completed' WHERE id='${A}'`);
  expect((await one<{r:{reports:unknown[]}}>('SELECT public.owner_str_reports() r')).r.reports.length).toBe(1);
  await d.exec(`UPDATE owner_programs SET status='active' WHERE id='${A}'`);
  expect(await one('SELECT public.owner_hours_eligibility($1) a, public.owner_hours_eligibility($2) b',[A,B])).toEqual({a:{eligible:true},b:{eligible:false,reason:'unavailable'}});
  await as(R);expect(await one('SELECT public.owner_hours_eligibility($1) a, public.can_view_owner_library_video($2) v',[A,LA])).toEqual({a:{eligible:false,reason:'unavailable'},v:false});
 });
 it('first decision counts, records the acting member, and a second decision is rejected',async()=>{
  await as(C);expect(await fails('SELECT public.respond_owner_opportunity($1,$2,$3,$4)',[WB,'decision','authorize',''])).toContain('not available');
  expect(await fails('SELECT public.respond_owner_opportunity($1,$2,$3,$4)',[WA,'decision','authorize','Go ahead'])).toBe('');
  expect(await one('SELECT status,decision_note FROM approvals WHERE id=$1',[AP])).toEqual({status:'approved',decision_note:'Casey Co authorized this work in Opportunity "Approve paint": Go ahead'});
  expect((await one<{r:{by:string}[]}>('SELECT owner_response r FROM work_items WHERE id=$1',[WA])).r.map(x=>x.by)).toEqual(['Casey Co']);
  await as(P);expect(await fails('SELECT public.respond_owner_opportunity($1,$2,$3,$4)',[WA,'decision','changes','No'])).toContain('already answered');
  expect((await one<{r:unknown[]}>('SELECT owner_response r FROM work_items WHERE id=$1',[WA])).r.length).toBe(1);
 });
 it('messages: co-owner posts as homeowner; staff message notifies only the primary, once',async()=>{
  await as(C);await d.query('SELECT public.post_owner_request_message($1,$2)',[WA,'Question']);
  expect(await one(`SELECT author_id,author_type FROM owner_request_messages WHERE body='Question'`)).toEqual({author_id:C,author_type:'homeowner'});
  await as(C);expect(await fails('SELECT public.post_owner_request_message($1,$2)',[WB,'x'])).toContain('not available');
  await as(S);await d.query('SELECT public.post_owner_request_message($1,$2)',[WA,'Answer']);
  expect((await d.query(`SELECT owner_user_id FROM owner_notifications WHERE program_id=$1 AND kind<>'review_ready'`,[A])).rows).toEqual([{owner_user_id:P}]);
 });
 it('signed-out and anon callers are refused',async()=>{
  await as(null);
  expect(await one('SELECT public.can_view_owner_library_video($1) v, public.owner_hours_eligibility($2) e',[LA,A])).toEqual({v:false,e:{eligible:false,reason:'unavailable'}});
  expect(await fails('SELECT public.respond_owner_opportunity($1,$2,$3,$4)',[WA,'feedback',null,'x'])).toContain('not available');
  expect((await d.query(`SELECT 1 FROM public.read_owner_participation('entries',$1)`,[A])).rows).toEqual([]);
  await d.exec('SET ROLE anon');try{for(const f of ref3.targets.filter(t=>t.acl!==null)) expect(await fails(`SELECT has_function_privilege('anon','${reg(f)}','EXECUTE') AND false`)).toBe('');
   await expect(d.query('SELECT public.owner_hours_eligibility($1)',[A])).rejects.toThrow('permission denied');}finally{await d.exec('RESET ROLE');}
  for(const f of ref3.targets.filter(t=>t.acl!==null)) expect(await one(`SELECT has_function_privilege('anon','${reg(f)}','EXECUTE') x`)).toEqual({x:false});
 });
 it('staff results, anon-executable SECURITY DEFINER set, ACLs, security and search_path are unchanged',async()=>{
  expect(await staffView()).toBe(staffBefore3);expect(await exp3()).toEqual(expBefore);expect(await acl3()).toEqual(aclsBefore);
 });
 it('staged bytes equal live plus only the enumerated changes; undo restores exact live definitions and ACLs',async()=>{
  for(const f of ref3.targets){let s=decode(f.definition_base64);for(const [a,b] of f.changes!)s=s.split(a).join(b);expect(s).toBe(decode(f.replacement_base64!));
   expect((await one<{x:string}>('SELECT pg_get_functiondef($1::regprocedure) x',[reg(f)])).x).toBe(decode(f.replacement_base64!));}
  await d.exec(readFileSync(root+'undo/04_access_remaining.sql','utf8'));
  for(const f of ref3.targets) expect(sha((await one<{x:string}>('SELECT pg_get_functiondef($1::regprocedure) x',[reg(f)])).x)).toBe(f.sha256);
  expect(await acl3()).toEqual(aclsBefore);expect(await exp3()).toEqual(expBefore);
  await as(C);expect(await fails('SELECT private.lock_owner_time_program($1,$2,false,true)',[A,C])).toContain('not available to you');
 });
});
