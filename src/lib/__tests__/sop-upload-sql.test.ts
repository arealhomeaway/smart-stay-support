import { beforeAll, afterAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { canManagePlaybooks, reorderPlaybookSteps } from "../playbook-editing";
import { parsePlaybook } from "../playbooks";
import { matchPlaybook } from "../playbook-match";
import { canOpenPath } from "../route-access";
const ADMIN="00000000-0000-0000-0000-000000000001", OPS="00000000-0000-0000-0000-000000000002", ONBOARD="00000000-0000-0000-0000-000000000003", SUP="00000000-0000-0000-0000-000000000004", PC="00000000-0000-0000-0000-000000000005";
let db: PGlite;
const sql=readFileSync("docs/pending/playbooks-nov5/01_playbook_editing.sql","utf8");
const columns=`id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, category text NOT NULL, summary text, active boolean DEFAULT true, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), playbook_key text, version integer DEFAULT 1, status text DEFAULT 'active', effective_on date, approved_by uuid, applies_to text[] DEFAULT ARRAY['ticket'], matcher jsonb DEFAULT '{}', priority_reason text, risk_flags jsonb DEFAULT '[]', immediate_actions text[] DEFAULT '{}', escalate_if text[] DEFAULT '{}', vendor_brief jsonb, source text DEFAULT 'authored', source_refs text[] DEFAULT '{}', supersedes_id uuid, requires_director boolean DEFAULT false, submitted_by uuid, submitted_at timestamptz, approved_at timestamptz, retired_at timestamptz, review_note text, source_version text, generated_at timestamptz, required_evidence text[] DEFAULT '{}', checklist jsonb`;
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE SCHEMA private;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('qa.uid',true),'')::uuid $$;
 CREATE FUNCTION public.has_role(u uuid,r text) RETURNS boolean LANGUAGE sql AS $$ SELECT u='${ADMIN}'::uuid AND r='admin' $$;
 CREATE FUNCTION public.is_director(u uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT u IN ('${ADMIN}'::uuid,'${OPS}'::uuid) $$;
 CREATE FUNCTION public.is_onboarding_director(u uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT u='${ONBOARD}'::uuid $$;
 CREATE FUNCTION public.is_internal_staff(u uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT u IN ('${ADMIN}'::uuid,'${OPS}'::uuid,'${ONBOARD}'::uuid,'${SUP}'::uuid,'${PC}'::uuid) $$;
 CREATE TABLE public.playbooks(${columns});
 CREATE TABLE public.playbook_steps(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),playbook_id uuid,position integer,instruction text,detail text,required boolean DEFAULT true,photo_required boolean DEFAULT false);
 CREATE TABLE public.playbook_approvals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),playbook_id uuid,from_status text,to_status text,actor_id uuid,actor_role text,note text,created_at timestamptz DEFAULT now());
 CREATE TABLE public.work_types(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),playbook_id uuid);
 CREATE TABLE public.tickets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),playbook_id uuid);
 CREATE FUNCTION public.qa_updated() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=clock_timestamp(); RETURN NEW; END $$;
 CREATE TRIGGER qa_updated BEFORE UPDATE ON public.playbooks FOR EACH ROW EXECUTE FUNCTION public.qa_updated();`);
 await db.exec(sql);
 await db.exec("CREATE TABLE profiles(id uuid PRIMARY KEY);");
 await db.query("INSERT INTO profiles(id) VALUES($1),($2),($3)",[ADMIN,OPS,ONBOARD]);
 await db.exec(readFileSync("docs/pending/sop-upload/01_sop_upload.sql","utf8"));
});
afterAll(async()=>{await db.close()});
const as=(u:string|null)=>db.query("select set_config('qa.uid',$1,false),set_config('resolve.playbook_write','',false)",[u??'']);
const content=(title='Edited')=>({title,category:'maintenance',summary:'New description',applies_to:['ticket'],keywords:['leak'],risk_flags:[{title:'Water damage',why:'Check downstairs'}],immediate_actions:['Shut off water'],escalate_if:['Cannot stop water'],required_evidence:['Photo'],steps:[{instruction:'Inspect',detail:'Record findings',required:true,photo_required:true},{instruction:'Dry',detail:null,required:false,photo_required:false}]});
async function seed(status='draft',key?:string){await as(null); const r=await db.query<{id:string}>("insert into playbooks(title,category,status,active,playbook_key,matcher,immediate_actions) values('Original','maintenance',$1,$2,$3,'{\"keywords\":[\"leak\"]}',ARRAY['Old guidance']) returning id",[status,status==='active',key??crypto.randomUUID()]);return r.rows[0]?.id??'';}
async function row(id:string){return (await db.query<Record<string,any>>("select * from playbooks where id=$1",[id])).rows[0]??{};}
async function save(id:string,c=content()){const r=await row(id);return (await db.query<{r:{id:string,version:number,created:boolean}}>("select save_playbook_draft($1,$2,$3) r",[id,r['updated_at'],JSON.stringify(c)])).rows[0]?.r;}
async function state(id:string,action:string,note='Checked'){const r=await row(id);return db.query("select change_playbook_state($1,$2,$3,$4)",[id,r['updated_at'],action,note]);}
async function failure(fn:()=>Promise<unknown>){try{await fn();return ''}catch(e){return e instanceof Error?e.message:String(e)}}

const reserve=async(name='SOP.docx')=>(await db.query<{r:{id:string,version:number}}>("select reserve_sop_upload($1,$2,'2026-11-05') r",[name,ADMIN])).rows[0]?.r;
const commit=async(id:string,previous:string|null=null)=>(await db.query<{r:{draftIds:string[]}}>("select commit_sop_upload($1,$2,$3) r",[id,JSON.stringify({id:'file',driveId:'drive',url:'https://arealhomeaway.sharepoint.com/file'}),JSON.stringify([{previousPlaybookId:previous,situations:['locked_out'],checklistCategories:['lockout'],content:content()}])])).rows[0]?.r;
describe('SOP upload isolated transactions',()=>{
 it('creates one SOP record and inactive draft with attribution',async()=>{await as(ADMIN);const r=await reserve();if(!r)throw Error('no reservation');const result=await commit(r.id);const id=result?.draftIds[0];if(!id)throw Error('no draft');expect((await row(id))['status']).toBe('draft');expect((await row(id))['active']).toBe(false);const v=(await db.query<Record<string,any>>('select * from sop_versions where id=$1',[r.id])).rows[0];expect(v?.['uploaded_by']).toBe(ADMIN);expect(v?.['version']).toBe(1);expect(v?.['owner_id']).toBe(ADMIN);});
 it('new version preserves active and attaches v2 suggested draft and Needs review projection',async()=>{await as(ADMIN);const r=await reserve('Access.pdf');if(!r)throw Error('no reservation');const first=await commit(r.id);const id=first?.draftIds[0];if(!id)throw Error('no draft');await state(id,'approve');const next=await reserve('Access.pdf');if(!next)throw Error('no reservation');expect(next.version).toBe(2);const second=await commit(next.id,id);const draft=second?.draftIds[0];if(!draft)throw Error('no draft');expect((await row(id))['active']).toBe(true);expect((await row(id))['status']).toBe('approved');expect((await row(draft))['active']).toBe(false);expect((await row(draft))['supersedes_id']).toBe(id);const links=(await db.query<{r:Record<string,{version:number,latest_version:number}>}>('select read_sop_playbook_links() r')).rows[0]?.r;expect(links?.[id]?.version).toBe(1);expect(links?.[id]?.latest_version).toBe(2);expect(links?.[draft]?.version).toBe(2);await state(draft,'approve');expect((await row(id))['status']).toBe('retired');expect((await row(draft))['active']).toBe(true);});
 it('failed commit leaves no saved SOP or draft and can abort',async()=>{await as(ADMIN);const r=await reserve('Broken.docx');if(!r)throw Error('no reservation');const count=(await db.query<{n:number}>('select count(*)::int n from playbooks')).rows[0]?.n;const invalid=content();const s=invalid.steps[0];if(s)s.instruction='';expect(await failure(()=>db.query('select commit_sop_upload($1,$2,$3)',[r.id,JSON.stringify({id:'file',driveId:'drive',url:'https://arealhomeaway.sharepoint.com/file'}),JSON.stringify([{previousPlaybookId:null,content:invalid}])]))).toContain('instruction');expect((await db.query<{n:number}>('select count(*)::int n from playbooks')).rows[0]?.n).toBe(count);await db.query('select abort_sop_upload($1)',[r.id]);expect((await db.query('select * from sop_versions where id=$1',[r.id])).rows).toHaveLength(0);});
 it('server refuses Supervisor, PC and anonymous before reservation',async()=>{for(const u of [SUP,PC,null]){await as(u);expect(await failure(()=>reserve('Denied.pdf'))).toContain('Only Admins and Directors');expect(await failure(()=>db.query("select sop_upload_context('Denied.pdf')"))).toContain('Only Admins and Directors');}});
 it('both Directors pass server permission check',async()=>{for(const u of [OPS,ONBOARD]){await as(u);expect(await failure(()=>db.query("select sop_upload_context('Check.pdf')"))).toBe('');}});
 it('duplicate upload is blocked while reserved',async()=>{await as(ADMIN);const r=await reserve('Parallel.pdf');expect(await failure(()=>reserve('Parallel.pdf'))).toContain('unfinished upload');if(r)await db.query('select abort_sop_upload($1)',[r.id]);});
});
