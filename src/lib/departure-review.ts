/**
 * Departure Review — one automated post-departure workflow that replaces the
 * manual Checkout / Cleaning Review / Review Request routine controls.
 *
 * Created only by the database trigger `create_departure_review_from_clean`
 * when a Breezeway departure clean is Finished (or later) and the reservation
 * has ended. Everything here is pure so the rules are testable and shared.
 */

export const DAMAGE_CATEGORIES = [
  { id: "extra_cleaning", label: "Extra cleaning" },
  { id: "pet_damage", label: "Pet damage" },
  { id: "missing_items", label: "Missing items" },
  { id: "linen_damage", label: "Linen/towel damage" },
  { id: "smoking", label: "Smoking" },
  { id: "property_damage", label: "Property damage" },
  { id: "other", label: "Other" },
] as const;

export const OUTREACH_OPTIONS = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
  { id: "already_reviewed", label: "Already reviewed" },
  { id: "unable", label: "Unable to request" },
] as const;

export const OUTREACH_NO_REASONS = [
  "Significant unresolved stay issue",
  "Guest complaint",
  "Active recovery situation",
  "Other",
];

export const HOST_REVIEW_OPTIONS = [
  { id: "completed", label: "Completed" },
  { id: "not_completed", label: "Not completed" },
  { id: "not_applicable", label: "Not applicable" },
  { id: "unable", label: "Unable to complete" },
] as const;

export type Platform = "airbnb" | "vrbo" | "direct" | "other";

/** Normalises OwnerRez booking source text to a platform. */
export function platformOf(source: string | null | undefined): Platform {
  const s = (source ?? "").toLowerCase();
  if (s.includes("airbnb")) return "airbnb";
  if (s.includes("vrbo") || s.includes("homeaway") || s.includes("expedia")) return "vrbo";
  if (s.includes("direct") || s.includes("ownerrez") || s.includes("website")) return "direct";
  return "other";
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  airbnb: "Airbnb",
  vrbo: "Vrbo",
  direct: "Direct booking",
  other: "Other",
};

/** Airbnb and Vrbo let hosts review guests; direct/other bookings do not. */
export function hostReviewSupported(source: string | null | undefined): boolean {
  const p = platformOf(source);
  return p === "airbnb" || p === "vrbo";
}

/** The review-request action shown for the guest's platform. Never Google. */
export function reviewRequestGuidance(source: string | null | undefined): string {
  switch (platformOf(source)) {
    case "airbnb":
      return "Send the review reminder from the Airbnb message thread.";
    case "vrbo":
      return "Send the review request from the Vrbo inbox.";
    case "direct":
      return "Send the standard post-stay thank-you with the review link from OwnerRez.";
    default:
      return "Request a review through the channel the guest booked on, if it supports one.";
  }
}

export type ReviewState = {
  clean_reviewed_at: string | null;
  property_attention: string | null;
  property_notes: string | null;
  damage_screen: string | null;
  damage_categories: string[] | null;
  outreach_decision: string | null;
  outreach_reason: string | null;
  outreach_status: string | null;
  host_review: string | null;
  booking_source: string | null;
};

export type StepCheck = { id: string; label: string; done: boolean; missing?: string };

/** Required steps, in order. Completion is allowed only when all are done. */
export function stepChecks(r: ReviewState, ctx: { linkedWork: number; hasClaim: boolean; externalReview: boolean }): StepCheck[] {
  const damageFlag = r.damage_screen === "yes" || r.damage_screen === "unsure";
  const outreach = effectiveOutreach(r, ctx.externalReview);
  return [
    { id: "clean", label: "Departure clean reviewed", done: !!r.clean_reviewed_at, missing: "Confirm the clean was reviewed." },
    {
      id: "property",
      label: "Property condition",
      done: r.property_attention === "no" || (r.property_attention === "yes" && !!r.property_notes?.trim()),
      missing: r.property_attention === "yes" ? "Describe what needs attention." : "Answer the property condition question.",
    },
    {
      id: "damage",
      label: "Damage / claim screening",
      done: r.damage_screen === "no" || (damageFlag && (r.damage_categories?.length ?? 0) > 0),
      missing: damageFlag ? "Pick at least one damage category." : "Answer the damage question.",
    },
    {
      id: "outreach",
      label: "Review outreach",
      done:
        outreach === "already_reviewed" ||
        outreach === "unable" ||
        (outreach === "no" && !!r.outreach_reason?.trim()) ||
        (outreach === "yes" && !!r.outreach_status),
      missing:
        outreach === "no"
          ? "Give a reason for not requesting a review."
          : outreach === "yes"
            ? "Record whether the review was requested."
            : "Answer the review outreach question.",
    },
    {
      id: "host",
      label: "Host review",
      done: !hostReviewSupported(r.booking_source) || !!r.host_review,
      missing: "Record the host review result.",
    },
  ];
}

/** An external review that already arrived always wins: no duplicate request work. */
export function effectiveOutreach(r: Pick<ReviewState, "outreach_decision">, externalReview: boolean): string | null {
  return externalReview ? "already_reviewed" : r.outreach_decision;
}

export function canComplete(r: ReviewState, ctx: { linkedWork: number; hasClaim: boolean; externalReview: boolean }): boolean {
  return stepChecks(r, ctx).every((s) => s.done);
}

/** Summary lines shown before completion. */
export function completionSummary(r: ReviewState, ctx: { linkedWork: number; hasClaim: boolean; externalReview: boolean }) {
  const outreach = effectiveOutreach(r, ctx.externalReview);
  const outreachText =
    outreach === "already_reviewed"
      ? "Already reviewed"
      : outreach === "unable"
        ? "Unable to request"
        : outreach === "no"
          ? `Not requested — ${r.outreach_reason ?? ""}`
          : r.outreach_status === "requested"
            ? "Requested"
            : r.outreach_status
              ? "Not requested"
              : "—";
  const host = hostReviewSupported(r.booking_source)
    ? (HOST_REVIEW_OPTIONS.find((o) => o.id === r.host_review)?.label ?? "—")
    : "N/A for this booking source";
  return {
    clean: r.clean_reviewed_at ? "Reviewed" : "Not reviewed",
    property: r.property_attention === "no" ? "None" : ctx.linkedWork > 0 ? `Linked work created (${ctx.linkedWork})` : "Issue noted",
    damage: r.damage_screen === "no" ? "None" : ctx.hasClaim ? "Claim linked" : "Flagged — no claim",
    outreach: outreachText,
    host,
  };
}

/** Cleaning Review outcome derived from the answers — never stored twice by hand. */
export function cleaningOutcome(r: Pick<ReviewState, "property_attention" | "damage_screen">): "accepted" | "follow_up_needed" {
  return r.property_attention === "yes" || r.damage_screen === "yes" || r.damage_screen === "unsure"
    ? "follow_up_needed"
    : "accepted";
}

// ---------- Turnover exception (clean not complete after departure) ----------

export const TURNOVER_THRESHOLDS_KEY = "departure_clean_thresholds";
export type TurnoverThresholds = { high_risk: string; overdue: string };
export const DEFAULT_TURNOVER_THRESHOLDS: TurnoverThresholds = { high_risk: "15:30", overdue: "16:00" };

export function readTurnoverThresholds(value: unknown): TurnoverThresholds {
  const v = (value ?? {}) as Partial<TurnoverThresholds>;
  const ok = (s: unknown) => typeof s === "string" && /^\d{2}:\d{2}$/.test(s);
  return {
    high_risk: ok(v.high_risk) ? v.high_risk! : DEFAULT_TURNOVER_THRESHOLDS.high_risk,
    overdue: ok(v.overdue) ? v.overdue! : DEFAULT_TURNOVER_THRESHOLDS.overdue,
  };
}

/** Chicago calendar day + minutes-of-day for an instant. */
export function chicagoParts(now: Date): { day: string; minutes: number } {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  return { day: `${p['year']}-${p['month']}-${p['day']}`, minutes: Number(p['hour']) * 60 + Number(p['minute']) };
}

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * Departed reservation whose clean is not complete: "high_risk" from the
 * high-risk time on checkout day, "overdue" from the overdue time and on every
 * later day. Before that, or once the clean is complete, null.
 */
export function turnoverRisk(
  departure: string | null | undefined,
  cleanComplete: boolean,
  now: Date,
  t: TurnoverThresholds = DEFAULT_TURNOVER_THRESHOLDS,
): "high_risk" | "overdue" | null {
  if (cleanComplete || !departure) return null;
  const { day, minutes } = chicagoParts(now);
  if (departure > day) return null;
  if (departure < day) return "overdue";
  if (minutes >= toMin(t.overdue)) return "overdue";
  if (minutes >= toMin(t.high_risk)) return "high_risk";
  return null;
}

export function isCleanComplete(status: string | null | undefined): boolean {
  return ["finished", "approved", "closed"].includes((status ?? "").toLowerCase());
}

export function breezewayTaskUrl(taskId: number | string | null | undefined): string | null {
  if (!taskId || !/^\d+$/.test(String(taskId))) return null;
  return `https://app.breezeway.io/task/${taskId}`;
}
