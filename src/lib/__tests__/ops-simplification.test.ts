import { describe,it,expect } from 'bun:test';
import { isOldBacklog,personalNeeds,defaultOpsTeam,teamASubject,TEAM_A_SUBJECTS } from '../ops-simplification';
describe('Operations simplification rules',()=>{
 it('open work created before Nov 16 Central is backlog',()=>expect(isOldBacklog({created_at:'2026-11-16T05:59:59Z',status:'open'})).toBe(true));
 it('the Nov 16 Central start is live',()=>expect(isOldBacklog({created_at:'2026-11-16T06:00:00Z',status:'open'})).toBe(false));
 it('every Notion date starts in backlog',()=>expect(isOldBacklog({external_source:'notion',created_at:'2026-11-25T12:00:00Z'})).toBe(true));
 it('an explicit move makes a Notion record live',()=>expect(isOldBacklog({external_source:'notion',ops_live_at:'2026-11-25T12:00:00Z'})).toBe(false));
 it('Needs you now stops at seven',()=>expect(personalNeeds(Array.from({length:9},(_,i)=>({id:String(i),personId:'me',priority:i,at:null})),'me').rows.length).toBe(7));
 it('Needs you now is for this person only',()=>expect(personalNeeds([{id:'1',personId:'other',priority:0,at:null}],'me').total).toBe(0));
 it('old backlog never enters Needs you now',()=>expect(personalNeeds([{id:'1',personId:'me',priority:0,at:null,backlog:true}],'me').total).toBe(0));
 it('bookings older than 24 hours stay off Home',()=>expect(personalNeeds([{id:'1',personId:'me',priority:0,at:null,bookingCreatedAt:'2026-11-24T11:59:59Z'}],'me',Date.parse('2026-11-25T12:00:00Z')).total).toBe(0));
 it('the most urgent row comes first',()=>expect(personalNeeds([{id:'routine',personId:'me',priority:2,at:null},{id:'urgent',personId:'me',priority:0,at:null}],'me').rows[0]?.id).toBe('urgent'));
 it('leaders start on Mine',()=>expect(defaultOpsTeam(false,'guest_experience')).toBe('mine'));
 it('Team B coordinators start on Team B',()=>expect(defaultOpsTeam(true,'property_operations')).toBe('b'));
 it('Team A coordinators start on Team A',()=>expect(defaultOpsTeam(true,'guest_experience')).toBe('a'));
 it('Team A has at most six subject tabs',()=>expect(TEAM_A_SUBJECTS.length).toBeLessThanOrEqual(6));
 it('unmatched Team A work goes to Other',()=>expect(teamASubject('Unmapped type')).toBe('other'));
});
