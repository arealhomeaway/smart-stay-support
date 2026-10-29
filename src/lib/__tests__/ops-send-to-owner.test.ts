import { describe, expect, it } from 'bun:test';
import { approvalPolicyLine, operationsContent, ownerSendTypes, sentOwnerStatus } from '../ops-send-to-owner';
describe('Operations Send to owner rules',()=>{
  it('Ticket entry offers the four approved types',()=>expect(ownerSendTypes('ticket').map(t=>t.type)).toEqual(['owner_task','ticket_update','approval','review']));
  it('property entry cannot send Ticket updates or approvals',()=>expect(ownerSendTypes().map(t=>t.type)).toEqual(['owner_task','review']));
  it('under $200 does not request owner approval',()=>expect(approvalPolicyLine(199.99)).toBe('Under $200: no owner approval needed.'));
  it('$200 to $350 requires Supervisor with owner informed afterward',()=>{expect(approvalPolicyLine(200)).toBe('$200 to $350: Supervisor approves and the owner is told afterward.');expect(approvalPolicyLine(350)).toBe(approvalPolicyLine(200));});
  it('over $350 needs the owner before work',()=>expect(approvalPolicyLine(350.01)).toBe('Over $350: owner approves before work starts.'));
  it('standalone activity never carries a Ticket link',()=>expect(operationsContent({},'owner_task','ticket','')).toMatchObject({ticket_id:null,source_department:'operations',send_kind:'owner_task'}));
  it('review carries the existing Ticket provenance and due date',()=>expect(operationsContent({},'review','ticket','2026-11-01')).toMatchObject({ticket_id:'ticket',due_on:'2026-11-01'}));
  it('Reviewed is distinct from answered and spending outcomes',()=>{expect(sentOwnerStatus({status:'open',reviewed:true})).toBe('reviewed');expect(sentOwnerStatus({status:'open',responded:true})).toBe('answered');expect(sentOwnerStatus({status:'approved'})).toBe('approved');expect(sentOwnerStatus({status:'declined'})).toBe('declined');expect(sentOwnerStatus({status:'open'})).toBe('waiting');});
});