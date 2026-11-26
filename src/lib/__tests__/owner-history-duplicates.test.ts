import { describe, expect, it } from 'bun:test';
import { duplicateHistoryIds, duplicateRemovalIds, type WorkHistoryRow } from '@/lib/owner-work-history';

const row=(id:string,savedAt:string,extra:Partial<WorkHistoryRow>={}):WorkHistoryRow=>({
  id,entryId:id,saveId:null,source:'work',cardId:null,title:'Added work',kind:'Added work',date:'2026-11-26',savedAt,
  activity:'Checked the home',minutes:90,superseded:false,actorId:'owner',values:{},files:[],paths:[],propertyIds:[],flagged:false,...extra,
});

describe('owner duplicate archiving',()=>{
  it('keeps the earliest entry and offers only the later copy for removal',()=>{
    const rows=[row('first','2026-11-26T12:00:00Z'),row('later','2026-11-26T12:01:00Z')];
    expect([...duplicateHistoryIds(rows)]).toEqual(['first','later']);
    expect([...duplicateRemovalIds(rows)]).toEqual(['later']);
  });
  it('never offers the original for removal when three copies exist',()=>{
    const rows=[row('c','2026-11-26T12:02:00Z'),row('a','2026-11-26T12:00:00Z'),row('b','2026-11-26T12:01:00Z')];
    expect([...duplicateRemovalIds(rows)].sort()).toEqual(['b','c']);
  });
  it('requires the same date, minutes and description',()=>{
    expect(duplicateRemovalIds([row('a','1'),row('b','2',{minutes:91})]).size).toBe(0);
    expect(duplicateRemovalIds([row('a','1'),row('b','2',{activity:'Different work'})]).size).toBe(0);
    expect(duplicateRemovalIds([row('a','1'),row('b','2',{date:'2026-11-25'})]).size).toBe(0);
  });
  it('does not offer superseded history for removal',()=>{
    expect(duplicateRemovalIds([row('a','1',{superseded:true}),row('b','2')]).size).toBe(0);
  });
});
