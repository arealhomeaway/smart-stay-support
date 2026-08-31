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
 * Approved pilot scope: the single mapped property (9211 Fitzgerald Dr).
 * Enforced server-side; the UI only mirrors it.
 */
export const OUTBOUND_PILOT_HOME_ID = "1473933";

export const BREEZEWAY_DEPARTMENTS = [
  "maintenance",
  "cleaning",
  "inspection",
  "other",
] as const;

export const BREEZEWAY_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export type BreezewayOutboundStatus = "creating" | "created" | "synced" | "error";

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
