import { beforeAll, afterAll, describe, it, expect } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const primary='00000000-0000-4000-8000-000000000001';
const coOwner='00000000-0000-4000-8000-000000000002';
const outsider='00000000-0000-4000-8000-000000000003';
const staff='00000000-0000-4000-8000-000000000004';
const programA='00000000-0000-4000-8000-000000000010';
const programB='00000000-0000-4000-8000-000000000020';
let db: PGlite;
async function member(program:string,user:string|null) {
  const r=await db.query<{ok:boolean}>('SELECT private.is_program_member($1,$2) ok',[program,user]);
  return r.rows[0]?.ok;
}
async function roster(user:string) {
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.test_uid','${user}',false);`);
  try { return (await db.query<{program_id:string}>('SELECT program_id FROM public.program_members')).rows; }
  finally { await db.exec('RESET ROLE'); }
}
describe('co-owner pending membership foundation',()=>{
  beforeAll(async()=>{
    db=new PGlite();
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA private; CREATE SCHEMA auth;
      GRANT USAGE ON SCHEMA public,private,auth TO authenticated;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.test_uid',true),'')::uuid$$;
      CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT $1='${staff}'::uuid AND $2='admin' $$;
      CREATE FUNCTION public.is_onboarding_director(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
      CREATE TABLE public.owner_programs(id uuid PRIMARY KEY,owner_user_id uuid);
      INSERT INTO public.owner_programs VALUES('${programA}','${primary}'),('${programB}','${outsider}');
      CREATE TABLE public.owner_time_entries(program_id uuid,owner_user_id uuid,minutes integer);
      INSERT INTO public.owner_time_entries VALUES('${programA}','${primary}',60),('${programA}','${coOwner}',90);`);
    await db.exec(readFileSync('docs/pending/co-owners/01_membership_foundation.sql','utf8'));
    await db.exec(`INSERT INTO public.program_members(program_id,user_id,role) VALUES('${programA}','${coOwner}','co_owner');`);
  });
  afterAll(async()=>{await db.close();});
  it('canonical primary counts before backfill',async()=>{expect(await member(programA,primary)).toBe(true);});
  it('active co-owner and primary can read the identical membership roster',async()=>{
    expect(await member(programA,coOwner)).toBe(true);
    expect(await roster(primary)).toEqual(await roster(coOwner));
    expect((await roster(coOwner)).map(x=>x.program_id)).toEqual([programA]);
  });
  it('program A co-owner cannot read program B membership',async()=>{
    expect(await member(programB,coOwner)).toBe(false);
    expect((await roster(outsider)).length).toBe(0);
  });
  it('anonymous and PUBLIC cannot execute the new function',async()=>{
    const r=await db.query<{anon:boolean;pub:boolean}>(`SELECT has_function_privilege('anon','private.is_program_member(uuid,uuid)','EXECUTE') anon,
      EXISTS(SELECT 1 FROM pg_proc p,aclexplode(p.proacl) a WHERE p.oid='private.is_program_member(uuid,uuid)'::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE') pub`);
    expect(r.rows[0]).toEqual({anon:false,pub:false});
    expect(await member(programA,null)).toBe(false);
    const exposure=await db.query<{n:number}>(`SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace
      WHERE s.nspname IN ('public','private') AND p.prosecdef AND has_function_privilege('anon',p.oid,'EXECUTE')`);
    expect(exposure.rows[0]?.n).toBe(0);
  });
  it('members cannot directly add another account',async()=>{
    await db.exec('SET ROLE authenticated');
    try {await expect(db.exec(`INSERT INTO public.program_members(program_id,user_id,role) VALUES('${programA}','${outsider}','co_owner')`)).rejects.toThrow('permission denied');}
    finally {await db.exec('RESET ROLE');}
  });
  it('duplicate active membership is rejected',async()=>{
    await expect(db.exec(`INSERT INTO public.program_members(program_id,user_id,role) VALUES('${programA}','${coOwner}','co_owner')`)).rejects.toThrow('duplicate key');
  });
  it('authorized staff roster read remains separate from membership',async()=>{
    expect(await member(programA,staff)).toBe(false);expect((await roster(staff)).length).toBe(1);
  });
  it('removal immediately revokes membership and preserves attributed hours and history',async()=>{
    await db.exec(`UPDATE public.program_members SET removed_at=now(),removed_by='${staff}' WHERE user_id='${coOwner}';`);
    expect(await member(programA,coOwner)).toBe(false);expect((await roster(coOwner)).length).toBe(0);
    const hours=await db.query<{minutes:number}>('SELECT sum(minutes)::int minutes FROM public.owner_time_entries');
    expect(hours.rows[0]?.minutes).toBe(150);
    const history=await db.query<{user_id:string;removed:boolean}>('SELECT user_id,removed_at IS NOT NULL removed FROM public.program_members');
    expect(history.rows[0]).toEqual({user_id:coOwner,removed:true});
  });
  it('primary backfill is idempotent and leaves canonical owner IDs unchanged',async()=>{
    const sql=readFileSync('docs/pending/co-owners/02_primary_backfill.data.sql','utf8');
    await db.exec(sql);await db.exec(sql);
    const r=await db.query<{n:number}>("SELECT count(*)::int n FROM public.program_members WHERE role='primary'");expect(r.rows[0]?.n).toBe(2);
    expect(await member(programA,primary)).toBe(true);
  });
  it('staged undo restores new-object absence without touching owner programs or hours',async()=>{
    await db.exec(readFileSync('docs/pending/co-owners/undo/01_membership_foundation.sql','utf8'));
    const r=await db.query<{table_absent:boolean;helper_absent:boolean}>("SELECT to_regclass('public.program_members') IS NULL table_absent,to_regprocedure('private.is_program_member(uuid,uuid)') IS NULL helper_absent");
    expect(r.rows[0]).toEqual({table_absent:true,helper_absent:true});
    const n=await db.query<{n:number}>('SELECT count(*)::int n FROM public.owner_programs');expect(n.rows[0]?.n).toBe(2);
  });
});