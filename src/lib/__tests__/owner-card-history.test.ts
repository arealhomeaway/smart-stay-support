import { describe, expect, it } from 'bun:test';
import { duplicateHistoryIds, historyTotals, type WorkHistoryRow } from '@/lib/owner-work-history';
const row=(id:string,minutes=90,extra:Partial<WorkHistoryRow>={}):WorkHistoryRow=>({id,entryId:id,saveId:id,source:'plan',cardId:'card',title:'Home care',kind:'Card',date:'2026-11-25',savedAt:'2026-11-25T20:00:00Z',activity:'Checked the home',minutes,superseded:false,actorId:'owner',values:{},files:[],paths:[],propertyIds:['home'],flagged:false,...extra});
describe('one save and owner history',()=>{
 it('one hour thirty minutes counts once as 1.5 hours',()=>{expect(historyTotals([row('1')]).hours).toBe(1.5);});
 it('an edit preserves the old row without double counting',()=>{expect(historyTotals([row('1',90,{superseded:true}),row('2',105)]).hours).toBe(1.75);});
 it('100 is not enough to pass 100',()=>{expect(historyTotals([row('1',6000)]).to100).toBe(1/60);});
 it('120 leaves zero hours to the recommendation',()=>{expect(historyTotals([row('1',7200)]).to120).toBe(0);});
 it('identical dates, minutes and descriptions flag both entries',()=>{expect([...duplicateHistoryIds([row('1'),row('2')])]).toEqual(['1','2']);});
 it('different minutes do not flag a duplicate',()=>{expect(duplicateHistoryIds([row('1'),row('2',91)]).size).toBe(0);});
 it('superseded versions do not flag duplicates',()=>{expect(duplicateHistoryIds([row('1',90,{superseded:true}),row('2')]).size).toBe(0);});
});
