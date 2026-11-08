import { describe, expect, it } from 'bun:test';
import { approvalPolicyLine, operationsContent, ownerSendTypes, sentOwnerStatus } from '../ops-send-to-owner';
describe('Operations Send to owner rules',()=>{
  it('Ticket entry offers the four approved types',()=>expect(ownerSendTypes('ticket').map(t=>t.type)).toEqual(['owner_task','ticket_update','approval','review']));
  it('property entry cannot send Ticket updates or approvals',()=>expect(ownerSendTypes().map(t=>t.type)).toEqual(['owner_task','review']));
  it('$249 and under does not request owner approval',()=>{expect(approvalPolicyLine(249.99)).toBe('$249 and under: it proceeds and the cost is recorded.');expect(approvalPolicyLine(200)).toBe(approvalPolicyLine(249.99));});
  it('$250 to $349 requires the Operations Supervisor with the owner told the same day',()=>{expect(approvalPolicyLine(250)).toBe('$250 to $349: the Operations Supervisor approves and the owner is told the same day.');expect(approvalPolicyLine(349.99)).toBe(approvalPolicyLine(250));});
  it('$350 and up needs the Operations Supervisor and the owner before work',()=>{expect(approvalPolicyLine(350)).toBe('$350 and up: the Operations Supervisor and the owner both approve before work starts.');expect(approvalPolicyLine(351)).toBe(approvalPolicyLine(350));});
  it('standalone activity never carries a Ticket link',()=>expect(operationsContent({},'owner_task','ticket','')).toMatchObject({ticket_id:null,source_department:'operations',send_kind:'owner_task'}));
  it('review carries the existing Ticket provenance and due date',()=>expect(operationsContent({},'review','ticket','2026-11-01')).toMatchObject({ticket_id:'ticket',due_on:'2026-11-01'}));
  it('Reviewed is distinct from answered and spending outcomes',()=>{expect(sentOwnerStatus({status:'open',reviewed:true})).toBe('reviewed');expect(sentOwnerStatus({status:'open',responded:true})).toBe('answered');expect(sentOwnerStatus({status:'approved'})).toBe('approved');expect(sentOwnerStatus({status:'declined'})).toBe('declined');expect(sentOwnerStatus({status:'open'})).toBe('waiting');});
});