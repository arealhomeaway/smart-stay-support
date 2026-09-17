import { createHmac, timingSafeEqual } from "node:crypto";
import type { OwnerRezCheckoutEvent } from "./ownerrez-checkout.ts";
import { validateOwnerRezCheckoutEvent } from "./ownerrez-checkout.ts";

/** Internal gateway contract. OwnerRez-native webhook signing has not been verified. */
export type CheckoutIngressConfig = {
  enabled: boolean;
  sharedSecret: string | null;
  maximumAgeMs: number;
};
export function checkoutIngressConfigFromEnv(
  env: Record<string, string | undefined>,
): CheckoutIngressConfig {
  return {
    enabled:
      env["OPS_ENVIRONMENT"] === "isolated-staging" &&
      env["OPS_ISOLATED_BACKEND_VERIFIED"] === "true" &&
      env["OWNERREZ_CHECKOUT_INGRESS_ENABLED"] === "true",
    sharedSecret: env["OWNERREZ_CHECKOUT_GATEWAY_SECRET"] ?? null,
    maximumAgeMs: 300_000,
  };
}
export type CheckoutIngressHeaders = {
  timestamp: string | null;
  signature: string | null;
};
export type CheckoutIngressResult =
  | {
      accepted: false;
      reason:
        "disabled" | "configuration_missing" | "stale" | "invalid_signature" | "invalid_event";
    }
  | { accepted: true; event: OwnerRezCheckoutEvent };

export function signSyntheticCheckoutPayload(
  secret: string,
  timestamp: string,
  body: string,
): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function parseCheckoutIngress(
  config: CheckoutIngressConfig,
  headers: CheckoutIngressHeaders,
  rawBody: string,
  nowMs: number,
): CheckoutIngressResult {
  if (!config.enabled) return { accepted: false, reason: "disabled" };
  if (!config.sharedSecret) return { accepted: false, reason: "configuration_missing" };
  const sentMs = Number(headers.timestamp);
  if (!Number.isFinite(sentMs) || Math.abs(nowMs - sentMs) > config.maximumAgeMs) {
    return { accepted: false, reason: "stale" };
  }
  const provided = headers.signature?.replace(/^sha256=/, "") ?? "";
  const expected = signSyntheticCheckoutPayload(config.sharedSecret, headers.timestamp!, rawBody);
  if (
    !/^[a-f0-9]{64}$/i.test(provided) ||
    !timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"))
  ) {
    return { accepted: false, reason: "invalid_signature" };
  }
  try {
    const event = JSON.parse(rawBody) as OwnerRezCheckoutEvent;
    validateOwnerRezCheckoutEvent(event);
    if (event.eventSource !== "webhook") return { accepted: false, reason: "invalid_event" };
    return { accepted: true, event };
  } catch {
    return { accepted: false, reason: "invalid_event" };
  }
}

export type ProcessingOutcome = { result: string; retryable: boolean };
export function retryDelayMs(attempt: number, outcome: ProcessingOutcome): number | null {
  if (!outcome.retryable || attempt >= 5) return null;
  return Math.min(60_000, 1000 * 2 ** Math.max(0, attempt - 1));
}

export function pollingEnabled(config: {
  enabled: boolean;
  sandboxBackendVerified: boolean;
}): boolean {
  return config.enabled && config.sandboxBackendVerified;
}
