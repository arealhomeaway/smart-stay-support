import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acceptanceDeadlineResult,
  deriveSupervisorDailyCounts,
  eventIdempotencyKey,
  planCheckoutEvent,
  selectCleaner,
  turnoverKey,
  validateChecklistSubmission,
  type CleanerEligibility,
  type OwnerRezCheckoutEvent,
} from "../ownerrez-checkout.ts";

const event: OwnerRezCheckoutEvent = {
  bookingId: "synthetic-booking-1",
  ownerrezPropertyId: "synthetic-ownerrez-home-1",
  reservationStatus: "confirmed",
  arrivalAt: "2026-10-01T21:00:00Z",
  checkoutAt: "2026-10-05T15:00:00Z",
  guestIdentityRef: "synthetic-guest-1",
  bookingChannel: "synthetic-channel",
  eventSource: "webhook",
  sourceEventId: "synthetic-event-1",
  payloadVersionOrHash: "v1",
};

test("webhook retry and polling share booking turnover identity", () => {
  const poll: OwnerRezCheckoutEvent = { ...event, eventSource: "poll", sourceEventId: null };
  assert.equal(turnoverKey(event), turnoverKey(poll));
  assert.notEqual(eventIdempotencyKey(event), eventIdempotencyKey(poll));
  assert.notEqual(
    eventIdempotencyKey(poll),
    eventIdempotencyKey({ ...poll, checkoutAt: "2026-10-06T15:00:00Z" }),
  );
  assert.deepEqual(planCheckoutEvent(event, null), { action: "create" });
  assert.deepEqual(
    planCheckoutEvent(poll, {
      checkoutAt: event.checkoutAt,
      propertyId: "p1",
      taskState: "scheduled",
      hasSubmittedEvidence: false,
    }),
    { action: "unchanged" },
  );
});

test("schedule changes preserve active work and surface an exception", () => {
  const changed = {
    ...event,
    checkoutAt: "2026-10-06T15:00:00Z",
    reservationStatus: "changed" as const,
  };
  const scheduled = {
    checkoutAt: event.checkoutAt,
    propertyId: "p1",
    taskState: "scheduled",
    hasSubmittedEvidence: false,
  };
  assert.equal(planCheckoutEvent(changed, scheduled).action, "reschedule");
  assert.equal(
    planCheckoutEvent(changed, { ...scheduled, taskState: "accepted" }).action,
    "scheduling_exception",
  );
  assert.equal(
    planCheckoutEvent(changed, { ...scheduled, hasSubmittedEvidence: true }).action,
    "scheduling_exception",
  );
  assert.equal(
    planCheckoutEvent({ ...event, reservationStatus: "cancelled" }, scheduled).action,
    "scheduling_exception",
  );
});

const cleaner = (id: string, extra: Partial<CleanerEligibility> = {}): CleanerEligibility => ({
  id,
  active: true,
  verificationStatus: "verified",
  eligibleMarkets: ["OKC"],
  eligiblePropertyIds: [],
  serviceTypes: ["departure"],
  defaultPropertyIds: [],
  priority: 10,
  ...extra,
});

test("verified default wins; unverified and blacked-out cleaners never dispatch", () => {
  const candidates = [
    cleaner("fallback", { priority: 1 }),
    cleaner("default", { defaultPropertyIds: ["p1"], priority: 99 }),
    cleaner("unverified", {
      defaultPropertyIds: ["p1"],
      priority: 0,
      verificationStatus: "NEEDS VERIFICATION",
    }),
  ];
  assert.deepEqual(selectCleaner(candidates, "p1", "OKC", "departure", event.checkoutAt), {
    kind: "property_default",
    cleanerId: "default",
  });
  assert.deepEqual(selectCleaner(candidates, "p2", "OKC", "departure", event.checkoutAt), {
    kind: "market_fallback",
    cleanerId: "fallback",
  });
  assert.deepEqual(selectCleaner(candidates, "p1", null, "departure", event.checkoutAt), {
    kind: "unassigned",
    atRisk: true,
  });
  assert.deepEqual(
    selectCleaner(
      [cleaner("away", { blackoutUntil: "2026-10-07T00:00:00Z" })],
      "p1",
      "OKC",
      "departure",
      event.checkoutAt,
    ),
    { kind: "unassigned", atRisk: true },
  );
});

test("declined and expired offers route again", () => {
  assert.equal(
    acceptanceDeadlineResult("offered", "2026-10-04T10:00:00Z", "2026-10-04T10:00:00Z"),
    "route_again",
  );
  assert.equal(
    acceptanceDeadlineResult("pending_acceptance", "2026-10-04T10:00:00Z", "2026-10-04T09:00:00Z"),
    "pending",
  );
  assert.equal(acceptanceDeadlineResult("declined", null, "2026-10-04T09:00:00Z"), "route_again");
});

test("required and conditional checklist evidence blocks submission", () => {
  const fields = [
    {
      id: "walkthrough",
      kind: "field" as const,
      responseType: "text" as const,
      required: true,
      photoRequired: true,
    },
    {
      id: "damage",
      kind: "field" as const,
      responseType: "yes_no" as const,
      required: true,
      photoRequired: false,
    },
    {
      id: "damage_photo",
      kind: "field" as const,
      responseType: "photo" as const,
      required: true,
      photoRequired: true,
      appliesWhen: { fieldId: "damage", equals: "yes" },
    },
  ];
  assert.deepEqual(
    validateChecklistSubmission(fields, [{ fieldId: "damage", value: "no", photoRefs: [] }]),
    ["walkthrough: required answer missing", "walkthrough: required photo missing"],
  );
  assert.deepEqual(
    validateChecklistSubmission(fields, [
      { fieldId: "walkthrough", value: "Synthetic condition", photoRefs: ["synthetic-photo"] },
      { fieldId: "damage", value: "yes", photoRefs: [] },
    ]),
    ["damage_photo: required answer missing", "damage_photo: required photo missing"],
  );
});

test("daily counts derive only known stay lengths", () => {
  assert.deepEqual(
    deriveSupervisorDailyCounts(
      [
        { kind: "quality_control", workDate: "2026-10-05" },
        { kind: "cleaning", workDate: "2026-10-05", stayNights: 20 },
        { kind: "cleaning", workDate: "2026-10-05", stayNights: 21 },
        { kind: "cleaning", workDate: "2026-10-05" },
        { kind: "quarterly_inspection", workDate: "2026-10-06" },
      ],
      "2026-10-05",
    ),
    {
      qcInspections: 1,
      shortStayCleans: 1,
      longStayCleans: 1,
      quarterlyInspections: 0,
      unclassifiedCleans: 1,
    },
  );
});
