/**
 * Browser-safe types for the transitional Breezeway Work Order read model.
 *
 * A Breezeway-originated Work Order is NOT a Resolve Ticket. It is a mirror of
 * work Breezeway is executing, shown inside Resolve so Operations does not have
 * to open Breezeway. A Ticket is created from one only by a deliberate action.
 */

export type BreezewayWorkOrder = {
  id: string;
  breezewayTaskId: number;
  propertyId: string | null;
  propertyName: string | null;
  breezewayHomeId: string;
  name: string | null;
  description: string | null;
  department: string | null;
  priority: string | null;
  status: string | null;
  stage: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  assignees: { name: string | null; status: string | null }[];
  photoCount: number;
  commentCount: number;
  linkedTicketId: string | null;
  needsAttention: boolean;
  breezewayCreatedAt: string | null;
  breezewayUpdatedAt: string | null;
  lastSyncedAt: string;
  source: "breezeway";
};

export type BreezewayWorkOrderComment = {
  id: string;
  breezewayCommentId: number | null;
  author: string | null;
  body: string;
  commentedAt: string | null;
  direction: "inbound" | "outbound";
};

/** Breezeway stages we treat as current work. Closed history is never imported. */
export const CURRENT_WORK_ORDER_STAGES = ["created", "committed", "started", "paused", "resumed"];

export function isCurrentWorkOrder(stage: string | null, status: string | null) {
  const s = (stage ?? status ?? "").toLowerCase();
  if (!s) return true;
  return !["closed", "approved", "deleted", "cancelled", "canceled", "finished"].includes(s);
}

export const WORK_ORDER_ACTIONS = ["update", "close", "reopen", "approve", "comment"] as const;
export type WorkOrderAction = (typeof WORK_ORDER_ACTIONS)[number];
