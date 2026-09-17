import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkoutIngressConfigFromEnv,
  parseCheckoutIngress,
  pollingEnabled,
  retryDelayMs,
  signSyntheticCheckoutPayload,
} from "../ownerrez-checkout-adapter.server.ts";

const body = JSON.stringify({
  bookingId: "synthetic-booking",
  ownerrezPropertyId: "synthetic-property",
  reservationStatus: "confirmed",
  arrivalAt: "2026-10-01T20:00:00Z",
  checkoutAt: "2026-10-05T15:00:00Z",
  guestIdentityRef: "synthetic-guest",
  bookingChannel: "synthetic",
  eventSource: "webhook",
  sourceEventId: "synthetic-event",
  payloadVersionOrHash: "synthetic-v1",
});
const config = { enabled: true, sharedSecret: "synthetic-secret", maximumAgeMs: 300_000 };
const timestamp = "1790000000000";

test("gateway is disabled by default and requires a secret", () => {
  assert.equal(checkoutIngressConfigFromEnv({}).enabled, false);
  assert.equal(
    checkoutIngressConfigFromEnv({ OWNERREZ_CHECKOUT_INGRESS_ENABLED: "true" }).enabled,
    false,
  );
  assert.deepEqual(
    parseCheckoutIngress(
      { ...config, enabled: false },
      { timestamp, signature: null },
      body,
      Number(timestamp),
    ),
    { accepted: false, reason: "disabled" },
  );
  assert.deepEqual(
    parseCheckoutIngress(
      { ...config, sharedSecret: null },
      { timestamp, signature: null },
      body,
      Number(timestamp),
    ),
    { accepted: false, reason: "configuration_missing" },
  );
  assert.equal(pollingEnabled({ enabled: true, sandboxBackendVerified: false }), false);
});

test("signature and timestamp reject stale or altered synthetic deliveries", () => {
  const signature = signSyntheticCheckoutPayload("synthetic-secret", timestamp, body);
  assert.equal(
    parseCheckoutIngress(config, { timestamp, signature }, body, Number(timestamp)).accepted,
    true,
  );
  assert.deepEqual(
    parseCheckoutIngress(config, { timestamp, signature }, body, Number(timestamp) + 300_001),
    { accepted: false, reason: "stale" },
  );
  assert.deepEqual(
    parseCheckoutIngress(config, { timestamp, signature }, `${body} `, Number(timestamp)),
    { accepted: false, reason: "invalid_signature" },
  );
});

test("retry policy is bounded and only for retryable failures", () => {
  assert.equal(retryDelayMs(1, { result: "temporary_failure", retryable: true }), 1000);
  assert.equal(retryDelayMs(5, { result: "temporary_failure", retryable: true }), null);
  assert.equal(retryDelayMs(1, { result: "invalid_event", retryable: false }), null);
});
