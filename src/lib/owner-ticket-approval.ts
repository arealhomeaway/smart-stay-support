import type { WorkOrderLike } from "./work-orders";

export type TicketAuthorityApproval = {
  id: string;
  entity_type: string | null;
  entity_id: string | null;
  property_id: string | null;
  approver_role: string | null;
  status: string;
  amount: number | null;
  decided_at: string | null;
};

/** Reconcile identity and canonical decision before interpreting a Work Order's mirrored fields. */
export function reconcileTicketApproval<
  T extends WorkOrderLike & {
    id: string;
    property_id: string | null;
    approval_id?: string | null;
  },
>(order: T, approvals: TicketAuthorityApproval[]): T & { authorityUnconfirmed?: boolean } {
  if (!order.approval_id)
    return {
      ...order,
      authorityUnconfirmed: ["approved", "declined", "pending", "info_requested"].includes(
        order.approval_status ?? "",
      ),
    };
  const approval = approvals.find(
    (row) =>
      row.id === order.approval_id &&
      row.entity_type === "work_order" &&
      row.entity_id === order.id &&
      row.property_id === order.property_id &&
      row.approver_role === "owner",
  );
  if (!approval || !["pending", "approved", "declined"].includes(approval.status))
    return { ...order, authorityUnconfirmed: true };
  if (
    approval.status === "approved" &&
    (!approval.decided_at ||
      approval.amount == null ||
      !Number.isFinite(approval.amount) ||
      approval.amount < 0)
  ) {
    return { ...order, authorityUnconfirmed: true };
  }
  const mirrored = order.approved_amount == null ? null : Number(order.approved_amount);
  const approvedAmount =
    approval.status !== "approved"
      ? null
      : mirrored == null
        ? approval.amount
        : Number.isFinite(mirrored)
          ? Math.min(mirrored, approval.amount!)
          : null;
  return {
    ...order,
    approval_status: approval.status,
    approved_amount: approvedAmount,
    authorityUnconfirmed: false,
  };
}
