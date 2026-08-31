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
 * Approved limited-beta scope: the five verified, mapped properties.
 * Each entry was confirmed against Breezeway by home id AND the OwnerRez
 * reference id on the Breezeway record — never by name/address similarity.
 * Enforced server-side; the UI only mirrors it.
 *
 *   1473933 — 9211 Fitzgerald Dr., Indianapolis IN   (OwnerRez 492500)
 *   1295301 — 2901 E. 75th St., Tulsa OK             (OwnerRez 480826)
 *    368125 — 2701 Berkshire Way, Oklahoma City OK   (OwnerRez 380978)
 *    322641 — 721 Dusty Trail, Yukon OK              (OwnerRez 376992)
 *   1293536 — 7351 Red Rock Rd, Indianapolis IN      (OwnerRez 480764)
 */
export const OUTBOUND_ALLOWED_HOME_IDS = [
  "1473933",
  "1295301",
  "368125",
  "322641",
  "1293536",
] as const;

/** The original single pilot home; kept for the webhook/company baseline. */
export const OUTBOUND_PILOT_HOME_ID = "1473933";

/** Server-side gate: only these Breezeway homes may receive outbound writes. */
export function isOutboundAllowedHome(homeId: string | number | null | undefined) {
  if (homeId === null || homeId === undefined || homeId === "") return false;
  return (OUTBOUND_ALLOWED_HOME_IDS as readonly string[]).includes(String(homeId));
}

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
