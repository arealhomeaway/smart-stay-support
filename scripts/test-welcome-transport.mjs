// Run with Node 24+: node scripts/test-welcome-transport.mjs
// Uses actual sendEmail + welcome worker. All transport and database calls are mocked.
import { registerHooks } from 'node:module';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const auditStub = 'data:text/javascript,export const supabaseAdmin={from:()=>({insert:async()=>({error:null})})};';
registerHooks({resolve(specifier, context, next) {
  if (specifier === '@/integrations/supabase/client.server') return {url:auditStub,shortCircuit:true};
  if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
    const u = new URL(specifier,context.parentURL);
    if (!existsSync(u) && existsSync(new URL(u.href+'.ts'))) return next(u.href+'.ts',context);
  }
  return next(specifier,context);
}});
process.env.LOVABLE_API_KEY='mock-only'; process.env.MICROSOFT_OUTLOOK_API_KEY='mock-only';
const { sendEmail } = await import('../src/lib/email.server.ts');
const { drainOwnerWelcomes, retryOwnerWelcome } = await import('../src/lib/owner-welcome.server.ts');
let calls=0; let response;
globalThis.fetch=async()=>{calls++;return response();};
beforeEach(()=>{calls=0;response=()=>new Response('',{status:202});});
function database(rows,review='approved') {
 return {from(name) {
  let filters=[],patch;
  const match=()=>rows.filter(r=>filters.every(([k,v])=>r[k]===v));
  const query={select(){return this},order(){return this},is(){return this},
   eq(k,v){filters.push([k,v]);return this},update(v){patch=v;return this},
   async maybeSingle(){
    if(name==='app_settings')return {data:{value:{subject:'Welcome',body:'Hello, your portal is ready.',video:null,version:1,review}}};
    if(name==='profiles')return {data:{full_name:'Synthetic Owner'}};
    return {data:match()[0]??null};
   },async limit(){return {data:match().map(r=>({...r}))}},
   then(resolve){if(name==='owner_program_properties')return resolve({data:[]});
    const found=match();if(patch)found.forEach(r=>Object.assign(r,patch));resolve({data:found.map(r=>({...r})),error:null});}
  };return query;
 }};
}
const row=()=>({id:'w1',program_id:'p',owner_user_id:'u',recipient:'owner@fixture.invalid',attempts:0,status:'queued',is_demo:false});
// The mocked worker uses a syntactically deliverable address so the test-address guard isn't the code under test.
const deliverable=()=>({...row(),recipient:'fixture@arha-mail-fixture.com'});
test('actual transport exception becomes uncertain and cannot be retried or drained again',async()=>{
 response=()=>{throw new Error('response lost after acceptance')};
 const rows=[deliverable()],db=database(rows);
 await drainOwnerWelcomes(db);assert.equal(rows[0].status,'sending');assert.match(rows[0].error_message,/Delivery uncertain/);
 await assert.rejects(retryOwnerWelcome(db,'w1'));await drainOwnerWelcomes(db);assert.equal(calls,1);
});
test('gateway 504 is uncertain, explicit 400 is a confirmed failure',async()=>{
 response=()=>new Response('gateway timeout',{status:504});const rows=[deliverable()];await drainOwnerWelcomes(database(rows));assert.equal(rows[0].status,'sending');
 response=()=>new Response('invalid recipient',{status:400});const failed=[deliverable()];await drainOwnerWelcomes(database(failed));assert.equal(failed[0].status,'failed');
});
test('concurrent retries and workers produce one queue transition and one send',async()=>{
 const rows=[{...deliverable(),status:'failed'}],db=database(rows);
 const results=await Promise.allSettled([retryOwnerWelcome(db,'w1'),retryOwnerWelcome(db,'w1')]);
 assert.equal(results.filter(r=>r.status==='fulfilled'&&r.value.requeued).length,1);
 await Promise.all([drainOwnerWelcomes(db),drainOwnerWelcomes(db)]);assert.equal(calls,1);assert.equal(rows[0].status,'sent');
});
test('unapproved template, demo rows and test addresses cannot send',async()=>{
 await drainOwnerWelcomes(database([deliverable()],'draft'));
 await drainOwnerWelcomes(database([{...deliverable(),is_demo:true}]));
 await drainOwnerWelcomes(database([row()]));assert.equal(calls,0);
});
test('other single-attempt callers keep their prior failed outcome',async()=>{
 response=()=>{throw new Error('network')};
 const r=await sendEmail({to:'fixture@arha-mail-fixture.com',subject:'Fixture',html:'',singleAttempt:true});
 assert.deepEqual(r,{status:'failed',error:'network'});assert.equal(calls,1);
});
