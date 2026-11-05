import { describe, it, expect } from "bun:test";
import { performSopUpload, SOP_MAX_BYTES, validateSopFile, sopVersionName, sopNeedsReview, type SopDraft } from "../sop-upload";
import { canManagePlaybooks } from "../playbook-editing";
const draft:SopDraft={previousPlaybookId:null,situations:['locked_out'],checklistCategories:['lockout'],content:{title:'Lockout',summary:null,category:'maintenance',applies_to:['ticket'],keywords:['lock'],risk_flags:[],immediate_actions:[],escalate_if:[],required_evidence:[],steps:[{instruction:'Check the code',detail:null,required:true,photo_required:false}]}};
function mocks(fail=''){
 const state={file:false,saved:false,aborted:false, ai:0,uploadedName:''};
 const receipt={sopId:'sop',title:'Access',version:1,draftIds:['draft']};
 const deps={generate:async()=>{state.ai++;if(fail==='ai')throw Error('AI failed');return [draft]},reserve:async()=>({id:'sop',version:1}),upload:async(v:number)=>{if(fail==='sharepoint')throw Error('unavailable');state.file=true;state.uploadedName=sopVersionName('Access.docx',v);return {id:'file',driveId:'drive',url:'https://arealhomeaway.sharepoint.com/file'}},commit:async()=>{if(fail==='commit')throw Error('Failed');state.saved=true;if(fail==='response')throw Error('Response lost');return receipt},receipt:async()=>state.saved?receipt:null,removeFile:async()=>{state.file=false},abort:async()=>{state.aborted=true}};
 return {state,deps,receipt};
}
describe('SOP upload with mocked SharePoint and AI',()=>{
 it('accepts exactly 20 MB Word/PDF and rejects larger files',()=>{expect(()=>validateSopFile({name:'SOP.pdf',size:SOP_MAX_BYTES})).not.toThrow();expect(()=>validateSopFile({name:'SOP.docx',size:SOP_MAX_BYTES+1})).toThrow('20 MB');expect(()=>validateSopFile({name:'SOP.exe',size:20})).toThrow('Word');});
 it('keeps original name plus v number',()=>expect(sopVersionName('Guest SOP.pdf',2)).toBe('Guest SOP v2.pdf'));
 it('upload creates SOP receipt and drafts',async()=>{const m=mocks();expect(await performSopUpload(m.deps)).toEqual(m.receipt);expect(m.state.saved).toBe(true);expect(m.state.file).toBe(true);expect(m.state.ai).toBe(1)});
 for(const fail of ['ai','sharepoint','commit'])it(`${fail} failure saves nothing`,async()=>{const m=mocks(fail);await expect(performSopUpload(m.deps)).rejects.toThrow();expect(m.state.saved).toBe(false);expect(m.state.file).toBe(false)});
 it('lost commit response reads receipt without deleting the master copy',async()=>{const m=mocks('response');expect(await performSopUpload(m.deps)).toEqual(m.receipt);expect(m.state.file).toBe(true)});
 it('Needs review is a projection and does not replace approved status',()=>{expect(sopNeedsReview({title:'SOP',version:1,latest_version:2,file_url:'url'},'approved')).toBe(true);expect(sopNeedsReview({title:'SOP',version:2,latest_version:2,file_url:'url'},'draft')).toBe(false)});
 it('Upload is available only to Admin and Directors',()=>{expect(canManagePlaybooks(['admin'])).toBe(true);expect(canManagePlaybooks(['manager'])).toBe(false);expect(canManagePlaybooks(['tech'])).toBe(false);expect(canManagePlaybooks(['onboarding'],{onboardingDirector:true})).toBe(true);expect(canManagePlaybooks(['manager'],{opsDirector:true})).toBe(true)});
});
