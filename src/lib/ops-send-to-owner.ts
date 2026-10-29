import { MAINTENANCE_POLICY } from './maintenance-policy';
export type OwnerSendType = 'owner_task' | 'ticket_update' | 'approval' | 'review';
export const OWNER_SEND_TYPES = [
  { type: 'owner_task', label: 'Owner task', description: 'Ask the owner to complete a standalone activity.' },
  { type: 'ticket_update', label: 'Ticket update', description: 'Share what happened and the next step on this Ticket.' },
  { type: 'approval', label: 'Approval request', description: 'Ask for a decision on a quoted Work Order.' },
  { type: 'review', label: 'For review', description: 'Share files for the owner to mark Reviewed.' },
] as const;
export function ownerSendTypes(ticketId?: string) {
  return OWNER_SEND_TYPES.filter(item => Boolean(ticketId) || item.type === 'owner_task' || item.type === 'review');
}
export function approvalPolicyLine(amount: number) {
  const { supervisorApprovalThreshold: supervisor, ownerApprovalThreshold: owner } = MAINTENANCE_POLICY;
  if (amount < supervisor) return `Under $${supervisor}: no owner approval needed.`;
  if (amount <= owner) return `$${supervisor} to $${owner}: Supervisor approves and the owner is told afterward.`;
  return `Over $${owner}: owner approves before work starts.`;
}
export function sentOwnerStatus(item: { status: string; kind?: string; responded?: boolean; reviewed?: boolean }) {
  if (item.status === 'approved' || item.status === 'declined') return item.status;
  if (item.reviewed) return 'reviewed';
  if (item.responded || ['answered', 'complete', 'completed', 'closed'].includes(item.status)) return 'answered';
  return 'waiting';
}
export function operationsContent<T extends object>(content: T, kind: 'owner_task' | 'review', ticketId: string | null, dueOn: string) {
  return { ...content, source_department: 'operations', send_kind: kind, ticket_id: kind === 'review' ? ticketId : null, due_on: dueOn || null };
}