/**
 * Evidence Quality Gate — browser-safe vocabulary.
 *
 * One standard, everywhere evidence is captured (Work Orders, Tickets,
 * Onboarding tasks, Assessments, property records):
 *
 *   "Can a reasonable reviewer clearly verify the work from this photo?"
 *
 * The gate is deliberately two-staged. Stage A asks whether the photo is
 * usable at all (sharp, lit, framed). Stage B asks whether it shows the thing
 * the requirement actually asked for. A photo can be beautiful and still fail
 * Stage B, and a correct subject can still fail Stage A.
 *
 * The gate scores PHOTOS, never people. Nothing here rolls up to an individual.
 */

export const EVIDENCE_SUBJECTS = [
  "ticket",
  "onboarding_task",
  "work_order",
  "property",
  "assessment",
] as const;
export type EvidenceSubject = (typeof EVIDENCE_SUBJECTS)[number];

export const EVIDENCE_KINDS = [
  "general",
  "serial_label",
  "filter_size",
  "completed_repair",
  "before",
  "after",
  "property_feature",
  "meter_reading",
  "damage",
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export type RequirementStatus =
  "awaiting" | "checking" | "verified" | "rejected" | "accepted_exception";
export type ItemStatus = "checking" | "verified" | "rejected" | "accepted_exception" | "unchecked";

/** The status words Operations sees. These are fixed — do not paraphrase them. */
export const REQUIREMENT_STATUS_LABEL: Record<RequirementStatus, string> = {
  awaiting: "Awaiting evidence",
  checking: "Checking photo",
  verified: "Evidence verified",
  rejected: "Needs better photo",
  accepted_exception: "Accepted with exception",
};

export const ITEM_STATUS_LABEL: Record<ItemStatus, string> = {
  checking: "Checking photo",
  verified: "Evidence verified",
  rejected: "Photo not accepted",
  accepted_exception: "Accepted with exception",
  unchecked: "Not checked",
};

export function requirementSatisfied(status: RequirementStatus) {
  return status === "verified" || status === "accepted_exception";
}

/* ------------------------------------------------------------------ */
/* Rejection reasons                                                   */
/* ------------------------------------------------------------------ */

/**
 * Every rejection names one of these. A generic "photo rejected" is not an
 * acceptable outcome: the person holding the phone has to know what to change.
 */
export const REASON_CODES = [
  // Stage A — technical
  "blurry",
  "low_resolution",
  "too_dark",
  "overexposed",
  "glare",
  "obstructed",
  "too_far",
  "too_close",
  "cut_off",
  "motion_blur",
  // Stage B — requirement
  "wrong_subject",
  "text_unreadable",
  "dimensions_unreadable",
  "state_not_shown",
  "work_not_visible",
  "context_missing",
  "duplicate_of_before",
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export const REASON_GUIDANCE: Record<ReasonCode, { title: string; fix: string }> = {
  blurry: {
    title: "Too blurry",
    fix: "Hold still, tap the screen on the subject to focus, then take it again.",
  },
  low_resolution: {
    title: "Too small to read",
    fix: "Send the full-size photo from the camera, not a screenshot or a forwarded copy.",
  },
  too_dark: {
    title: "Too dark",
    fix: "Turn on the room light or your phone's flash and retake it.",
  },
  overexposed: {
    title: "Too bright",
    fix: "Move out of the direct light or turn off the flash and retake it.",
  },
  glare: {
    title: "Glare on the surface",
    fix: "Step slightly to one side so the light does not bounce back at the lens.",
  },
  obstructed: {
    title: "Something is in the way",
    fix: "Move the object blocking the view, or shoot from another angle.",
  },
  too_far: {
    title: "Taken from too far away",
    fix: "Move closer so the subject fills most of the frame.",
  },
  too_close: {
    title: "Taken too close",
    fix: "Step back so we can see the subject and enough of what is around it.",
  },
  cut_off: {
    title: "Subject is cut off",
    fix: "Reframe so the whole subject is inside the picture with a little room around it.",
  },
  motion_blur: {
    title: "Camera moved",
    fix: "Brace your elbows or rest the phone on something and take it again.",
  },
  wrong_subject: {
    title: "Not what was asked for",
    fix: "Read the request again and photograph that exact item.",
  },
  text_unreadable: {
    title: "The label cannot be read",
    fix: "Get close enough that every character is sharp, straight on, with light on the label rather than behind it.",
  },
  dimensions_unreadable: {
    title: "The size is not readable",
    fix: "Photograph the printed size on the edge of the filter, square on and close enough to read it.",
  },
  state_not_shown: {
    title: "Does not show the state we need",
    fix: "Show the item in the condition the request asks for, from the same angle as the matching photo.",
  },
  work_not_visible: {
    title: "The completed work is not visible",
    fix: "Frame the repair itself, not the room, so a reviewer can see it is finished.",
  },
  context_missing: {
    title: "No sense of where this is",
    fix: "Include a little of the surrounding area so we can tell where in the home this is.",
  },
  duplicate_of_before: {
    title: "Looks like the earlier photo",
    fix: "Take a fresh photo now that the work is done, from the same spot as the first one.",
  },
};

export function isReasonCode(value: string): value is ReasonCode {
  return (REASON_CODES as readonly string[]).includes(value);
}

/* ------------------------------------------------------------------ */
/* Requirement presets                                                 */
/* ------------------------------------------------------------------ */

export const KIND_LABEL: Record<EvidenceKind, string> = {
  general: "Photo of the work",
  serial_label: "Serial / model label",
  filter_size: "HVAC filter size",
  completed_repair: "Completed repair",
  before: "Before",
  after: "After",
  property_feature: "Feature at the home",
  meter_reading: "Meter reading",
  damage: "Damage",
};

/** What Stage B is told to look for. Plain language on purpose — it is also shown to staff. */
export const KIND_CRITERIA: Record<EvidenceKind, string> = {
  general: "The photo clearly shows the work or item described in the request.",
  serial_label:
    "A manufacturer label is visible and every character of the model and serial number can be read without guessing.",
  filter_size:
    "The printed filter size (for example 20x25x1) is visible on the filter frame and fully readable.",
  completed_repair:
    "The repair itself is in frame and visibly finished — no exposed wiring, open holes, loose parts or tools left in place.",
  before: "The problem or the original condition is clearly visible before any work was done.",
  after:
    "The same area as the before photo, showing the finished condition from a comparable angle.",
  property_feature:
    "The feature is clearly identifiable, with enough of the room to place it in the home.",
  meter_reading: "The full reading, including every digit, is sharp and readable.",
  damage:
    "The damage is clearly visible, with both a close view of it and enough context to locate it.",
};

export type EvidenceRequirementView = {
  id: string;
  subjectType: EvidenceSubject;
  subjectId: string;
  slotKey: string;
  label: string;
  kind: EvidenceKind;
  instruction: string | null;
  detail: string | null;
  required: boolean;
  status: RequirementStatus;
  items: EvidenceItemView[];
};

export type EvidenceItemView = {
  id: string;
  status: ItemStatus;
  source: "resolve_upload" | "breezeway_photo";
  url: string | null;
  reasonCodes: ReasonCode[];
  guidance: string | null;
  evaluatedAt: string | null;
  createdAt: string;
  uploadedByName: string | null;
  exceptionReason: string | null;
  exceptionByName: string | null;
  exceptionAt: string | null;
  originalRejection: string | null;
  postedToBreezewayAt: string | null;
};

/** One line summarising why a photo was not accepted, ready to show as-is. */
export function rejectionSummary(codes: ReasonCode[]): string {
  if (codes.length === 0) return "A reviewer could not clearly verify the work from this photo.";
  return codes.map((c) => REASON_GUIDANCE[c].title).join(" · ");
}

export function rejectionSteps(codes: ReasonCode[]): string[] {
  return codes.map((c) => REASON_GUIDANCE[c].fix);
}
