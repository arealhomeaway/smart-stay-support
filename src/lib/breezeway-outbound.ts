/**
 * Browser-safe types and constants for Breezeway outbound task creation.
 *
 * Resolve stays the operational source of truth. A Breezeway task created from
 * here is a downstream copy of a Resolve ticket or onboarding task — Breezeway
 * never drives Resolve state, and nothing here reads credentials.
 */

/** Feature flag gating the whole outbound path. OFF means the UI must not offer it. */
export const BREEZEWAY_OUTBOUND_FLAG = "breezeway_outbound";

/**
 * Verified-eligibility model (replaces the original five-home beta allowlist).
 *
 * Write authorization now lives in the database: a property may receive
 * Breezeway writes only while its `breezeway_mapping_state` is `verified`,
 * which is set by the deterministic audit in `breezeway-mapping.server.ts`
 * (Breezeway home id + OwnerRez reference identity). Name or address
 * similarity is never authorization, and no home id is hardcoded here.
 */

/** The original single pilot home; kept for fixtures and the webhook baseline. */
export const OUTBOUND_PILOT_HOME_ID = "1473933";

export const BREEZEWAY_DEPARTMENTS = [
  "maintenance",
  "cleaning",
  "inspection",
  "other",
] as const;

export const BREEZEWAY_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

/**
 * Lifecycle of one outbound link.
 *   creating     — Resolve is calling Breezeway right now.
 *   created      — Breezeway accepted it and returned a task id.
 *   synced       — Breezeway has since acknowledged the task by webhook.
 *   error        — Breezeway refused it; nothing was created.
 *   needs_review — UNCERTAIN. The call may or may not have created a task
 *                  (timeout, 5xx, or our own bookkeeping failed). Never
 *                  retried automatically; an admin reconciles it by hand.
 *   abandoned    — an admin confirmed no Breezeway task exists for this row.
 */
export type BreezewayOutboundStatus =
  | "creating"
  | "created"
  | "synced"
  | "error"
  | "needs_review"
  | "abandoned";

/** User-facing wording for each state. The uncertain state must never read as a failure. */
export const OUTBOUND_STATUS_LABEL: Record<BreezewayOutboundStatus, string> = {
  creating: "Creating…",
  created: "Created in Breezeway",
  synced: "Confirmed by Breezeway",
  error: "Failed — not created",
  needs_review: "Uncertain — needs review",
  abandoned: "Reviewed — nothing was created",
};

export type BreezewayOutboundLink = {
  id: string;
  sourceType: "ticket" | "onboarding_task";
  ticketId: string | null;
  onboardingTaskId: string | null;
  breezewayTaskId: number | null;
  status: BreezewayOutboundStatus;
  title: string;
  department: string | null;
  priority: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  errorMessage: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  lastSyncedAt: string | null;
  lastWebhookAt: string | null;
};

export type BreezewayOutboundEligibility = {
  enabled: boolean;
  eligible: boolean;
  reason: string | null;
  propertyName: string | null;
  breezewayHomeId: string | null;
};

/** One uncertain link plus the Resolve record it came from, for the admin queue. */
export type BreezewayOutboundReviewItem = BreezewayOutboundLink & {
  propertyName: string | null;
  sourceTitle: string | null;
};
