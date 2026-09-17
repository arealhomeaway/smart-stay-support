import { evaluateAuthority, type WorkOrderLike } from "./work-orders";
import type { OwnerActionType } from "./owner-opportunity";
import { ACTION_TYPE_META } from "./owner-opportunity";
import { parseReviewedTicketRequest } from "./owner-ticket-intent";

export type OwnerTicketRequest = {
  category: OwnerActionType;
  label: string;
  why: string;
  ownerActionRequired: boolean | null;
  policyVersions: string[];
};

/** Canonical Work Order rules decide authority; this layer only explains the participation request. */
export function ownerTicketRequest(
  workOrders: (WorkOrderLike & { authorityUnconfirmed?: boolean })[],
  reviewedIntent?: unknown,
): OwnerTicketRequest {
  const authority = ownerTicketAuthority(workOrders);
  const intent = parseReviewedTicketRequest(reviewedIntent);
  if (!intent) return authority;
  const explicitWhy = `${ACTION_TYPE_META[intent.owner_request_type].label}: ${intent.owner_request_why}`;
  // Canonical pending approval always stays primary, while the separate staff request remains visible.
  if (authority.category === "approve_only" || intent.owner_request_type === "information_only")
    return { ...authority, why: `${authority.why} Reviewed owner request — ${explicitWhy}` };
  return {
    ...authority,
    category: intent.owner_request_type,
    label: ACTION_TYPE_META[intent.owner_request_type].label,
    ownerActionRequired: true,
    why: `${explicitWhy} Repair authority: ${authority.why}`,
  };
}

function ownerTicketAuthority(
  workOrders: (WorkOrderLike & { authorityUnconfirmed?: boolean })[],
): OwnerTicketRequest {
  const evaluated = workOrders.map((order) => ({ order, verdict: evaluateAuthority(order) }));
  const pending = evaluated.filter(
    ({ order, verdict }) =>
      !order.authorityUnconfirmed &&
      (order.approval_status === "pending" ||
        (verdict.ownerApprovalRequired &&
          !["approved", "declined", "info_requested"].includes(order.approval_status ?? ""))),
  );
  const policyVersions = [...new Set(evaluated.map(({ verdict }) => verdict.policyVersion))];
  if (pending.length)
    return {
      category: "approve_only",
      label: "Approve only",
      ownerActionRequired: true,
      policyVersions,
      why: pending
        .map(({ verdict }) =>
          verdict.ownerApprovalRequired
            ? verdict.reason
            : "An owner approval request is recorded for this work.",
        )
        .join(" "),
    };
  if (
    !evaluated.length ||
    evaluated.some(
      ({ order, verdict }) =>
        order.authorityUnconfirmed ||
        (verdict.amount === null && !verdict.mitigationOnly) ||
        (verdict.ownerApprovalRequired &&
          order.approval_status === "approved" &&
          (order.approved_amount == null ||
            !Number.isFinite(Number(order.approved_amount)) ||
            Number(order.approved_amount) < (verdict.amount ?? 0))),
    )
  )
    return {
      category: "information_only",
      label: "Review — Authority not yet confirmed",
      ownerActionRequired: null,
      policyVersions,
      why: "You can review the recorded work. The repair amount or authority covering it is not fully confirmed, so this view does not confirm permission to proceed.",
    };
  return {
    category: "information_only",
    label: "Review — No approval required",
    ownerActionRequired: false,
    policyVersions,
    why:
      evaluated
        .map(({ order, verdict }) =>
          verdict.ownerApprovalRequired
            ? order.approval_status === "declined"
              ? "You declined this request. This review does not authorize that repair."
              : order.approval_status === "info_requested"
                ? "You asked for more information. Staff must respond before this request can be decided."
                : "Your prior response is recorded. Review the progress and outcome; no new owner approval is requested by this record."
            : verdict.reason,
        )
        .join(" ") + " You may log time you actually spend reviewing this work.",
  };
}
