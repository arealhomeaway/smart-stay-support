/** Synthetic-safe OwnerRez ingestion rules. No network, database or delivery here. */
export type OwnerRezCheckoutEvent = {
  bookingId: string;
  ownerrezPropertyId: string;
  reservationStatus: "confirmed" | "changed" | "cancelled" | "checked_out";
  arrivalAt: string;
  checkoutAt: string;
  guestIdentityRef: string | null;
  bookingChannel: string | null;
  eventSource: "webhook" | "poll";
  sourceEventId?: string | null;
  payloadVersionOrHash: string;
};

export function validateOwnerRezCheckoutEvent(event: OwnerRezCheckoutEvent): void {
  if (
    !event.bookingId.trim() ||
    !event.ownerrezPropertyId.trim() ||
    !event.payloadVersionOrHash.trim()
  ) {
    throw new Error("OwnerRez event lacks a stable booking, property or payload identity.");
  }
  if (
    !Number.isFinite(Date.parse(event.arrivalAt)) ||
    !Number.isFinite(Date.parse(event.checkoutAt))
  ) {
    throw new Error("OwnerRez event has an invalid arrival or checkout time.");
  }
  if (Date.parse(event.checkoutAt) <= Date.parse(event.arrivalAt)) {
    throw new Error("OwnerRez checkout must follow arrival.");
  }
}

/** Booking identity, not delivery identity, is the turnover uniqueness boundary. */
export function turnoverKey(event: OwnerRezCheckoutEvent): string {
  validateOwnerRezCheckoutEvent(event);
  return `${event.ownerrezPropertyId.trim()}:${event.bookingId.trim()}`;
}

export function eventIdempotencyKey(event: OwnerRezCheckoutEvent): string {
  validateOwnerRezCheckoutEvent(event);
  return event.sourceEventId?.trim()
    ? `ownerrez:event:${event.sourceEventId.trim()}`
    : `ownerrez:booking:${turnoverKey(event)}:snapshot:${JSON.stringify([
        event.reservationStatus,
        event.arrivalAt,
        event.checkoutAt,
        event.guestIdentityRef,
        event.bookingChannel,
        event.payloadVersionOrHash.trim(),
      ])}`;
}

export type ExistingTurnover = {
  checkoutAt: string;
  propertyId: string;
  taskState: string | null;
  hasSubmittedEvidence: boolean;
};
export type CheckoutPlan =
  | { action: "ignore_cancelled" | "create" | "unchanged" }
  | { action: "reschedule"; previousCheckoutAt: string; newCheckoutAt: string }
  | {
      action: "scheduling_exception";
      reason: string;
      previousCheckoutAt: string;
      newCheckoutAt: string;
    };

export function planCheckoutEvent(
  event: OwnerRezCheckoutEvent,
  existing: ExistingTurnover | null,
): CheckoutPlan {
  validateOwnerRezCheckoutEvent(event);
  if (event.reservationStatus === "cancelled" && !existing) return { action: "ignore_cancelled" };
  if (!existing) return { action: "create" };
  if (event.reservationStatus === "cancelled") {
    return {
      action: "scheduling_exception",
      reason: "OwnerRez cancelled an existing turnover; Operations must review the assigned work.",
      previousCheckoutAt: existing.checkoutAt,
      newCheckoutAt: event.checkoutAt,
    };
  }
  if (Date.parse(existing.checkoutAt) === Date.parse(event.checkoutAt))
    return { action: "unchanged" };
  const safeToReschedule = existing.taskState === "scheduled" && !existing.hasSubmittedEvidence;
  return safeToReschedule
    ? {
        action: "reschedule",
        previousCheckoutAt: existing.checkoutAt,
        newCheckoutAt: event.checkoutAt,
      }
    : {
        action: "scheduling_exception",
        reason: "Checkout changed after cleaning was offered, accepted, started or evidenced.",
        previousCheckoutAt: existing.checkoutAt,
        newCheckoutAt: event.checkoutAt,
      };
}

export type CleanerEligibility = {
  id: string;
  active: boolean;
  verificationStatus: "verified" | "NEEDS VERIFICATION";
  eligibleMarkets: readonly string[];
  eligiblePropertyIds: readonly string[];
  serviceTypes: readonly string[];
  defaultPropertyIds: readonly string[];
  priority: number;
  blackoutUntil?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
};
export type AssignmentDecision =
  | { kind: "property_default" | "market_fallback"; cleanerId: string }
  | { kind: "unassigned"; atRisk: true };

export function selectCleaner(
  cleaners: readonly CleanerEligibility[],
  propertyId: string,
  canonicalMarket: string | null,
  serviceType: string,
  workAt: string,
): AssignmentDecision {
  if (!canonicalMarket?.trim()) return { kind: "unassigned", atRisk: true };
  const when = Date.parse(workAt);
  if (!Number.isFinite(when)) throw new Error("Work time is invalid.");
  const eligible = cleaners.filter(
    (cleaner) =>
      cleaner.active &&
      cleaner.verificationStatus === "verified" &&
      cleaner.eligibleMarkets.includes(canonicalMarket) &&
      cleaner.serviceTypes.includes(serviceType) &&
      (!cleaner.eligiblePropertyIds.length || cleaner.eligiblePropertyIds.includes(propertyId)) &&
      (!cleaner.blackoutUntil || Date.parse(cleaner.blackoutUntil) < when) &&
      (!cleaner.effectiveFrom || Date.parse(cleaner.effectiveFrom) <= when) &&
      (!cleaner.effectiveTo || Date.parse(cleaner.effectiveTo) >= when),
  );
  const byPriority = (a: CleanerEligibility, b: CleanerEligibility) =>
    a.priority - b.priority || a.id.localeCompare(b.id);
  const specific = eligible
    .filter((cleaner) => cleaner.defaultPropertyIds.includes(propertyId))
    .sort(byPriority)[0];
  if (specific) return { kind: "property_default", cleanerId: specific.id };
  const fallback = eligible.sort(byPriority)[0];
  return fallback
    ? { kind: "market_fallback", cleanerId: fallback.id }
    : { kind: "unassigned", atRisk: true };
}

export function acceptanceDeadlineResult(
  state: "offered" | "pending_acceptance" | "accepted" | "declined" | "expired",
  deadlineAt: string | null,
  now: string,
): "pending" | "accepted" | "route_again" {
  if (state === "accepted") return "accepted";
  if (state === "declined" || state === "expired") return "route_again";
  return deadlineAt && Date.parse(now) >= Date.parse(deadlineAt) ? "route_again" : "pending";
}

export type ChecklistField = {
  id: string;
  kind: "field" | "instruction";
  responseType: "text" | "yes_no" | "number" | "photo" | "condition" | null;
  required: boolean;
  photoRequired: boolean;
  appliesWhen?: { fieldId: string; equals: string } | null;
};
export type ChecklistAnswer = { fieldId: string; value: unknown; photoRefs: readonly string[] };

export function validateChecklistSubmission(
  fields: readonly ChecklistField[],
  answers: readonly ChecklistAnswer[],
): string[] {
  const byId = new Map(answers.map((answer) => [answer.fieldId, answer]));
  const errors: string[] = [];
  for (const field of fields) {
    if (field.kind === "instruction") continue;
    if (field.appliesWhen) {
      const parent = byId.get(field.appliesWhen.fieldId);
      if (String(parent?.value ?? "") !== field.appliesWhen.equals) continue;
    }
    const answer = byId.get(field.id);
    if (
      field.required &&
      (answer?.value === null || answer?.value === undefined || answer.value === "")
    ) {
      errors.push(`${field.id}: required answer missing`);
    }
    if (field.photoRequired && !answer?.photoRefs.length)
      errors.push(`${field.id}: required photo missing`);
  }
  return errors;
}

export type DailyWorkRecord = {
  kind: "quality_control" | "cleaning" | "quarterly_inspection";
  stayNights?: number | null;
  workDate: string;
};
export function deriveSupervisorDailyCounts(records: readonly DailyWorkRecord[], workDate: string) {
  const day = records.filter((record) => record.workDate === workDate);
  return {
    qcInspections: day.filter((record) => record.kind === "quality_control").length,
    shortStayCleans: day.filter(
      (record) => record.kind === "cleaning" && record.stayNights != null && record.stayNights < 21,
    ).length,
    longStayCleans: day.filter(
      (record) =>
        record.kind === "cleaning" && record.stayNights != null && record.stayNights >= 21,
    ).length,
    quarterlyInspections: day.filter((record) => record.kind === "quarterly_inspection").length,
    unclassifiedCleans: day.filter(
      (record) => record.kind === "cleaning" && record.stayNights == null,
    ).length,
  };
}
