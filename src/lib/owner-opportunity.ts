/**
 * Active Owner participation opportunities (browser-safe presentation layer).
 *
 * An opportunity is never a separate task universe. It is a thin, owner-facing
 * offer attached to real Resolve work — an Onboarding task or an Operations
 * ticket — stored on `owner_reviews`. This module only derives labels and
 * availability; it never invents hours and never decides tax treatment.
 */

export const OWNER_ACTION_TYPES = [
  "approve_only",
  "review_comment",
  "review_decide",
  "provide_information",
  "attend_respond",
  "action_payment",
  "information_only",
  "research_recommend",
] as const;

/** Retain stored values and older callers without offering a second taxonomy for new work. */
export const LEGACY_OWNER_ACTION_TYPES = [
  "participate",
  "review",
  "approve",
  "attend",
  "research",
  "document",
] as const;

export const SUPPORTED_OWNER_ACTION_TYPES = [
  ...OWNER_ACTION_TYPES,
  ...LEGACY_OWNER_ACTION_TYPES,
] as const;
export type OwnerActionType = (typeof SUPPORTED_OWNER_ACTION_TYPES)[number];

export const ACTION_TYPE_META: Record<
  OwnerActionType,
  { label: string; verb: string; hint: string }
> = {
  approve_only: {
    label: "Approve only",
    verb: "Approve",
    hint: "Review the request and record your approval or rejection.",
  },
  review_comment: {
    label: "Review & comment",
    verb: "Comment",
    hint: "Review the information and share your comments.",
  },
  review_decide: {
    label: "Review & decide",
    verb: "Decide",
    hint: "Review the options and record your decision.",
  },
  provide_information: {
    label: "Provide information",
    verb: "Respond",
    hint: "Provide the information requested so the work can proceed.",
  },
  attend_respond: {
    label: "Attend & respond",
    verb: "Attend",
    hint: "Attend the scheduled activity and record your response.",
  },
  action_payment: {
    label: "Action or payment required",
    verb: "Take action",
    hint: "Complete the requested action or payment and record the outcome.",
  },
  information_only: {
    label: "Information only",
    verb: "Review",
    hint: "No response is required. You may review this work and log time you actually spend reviewing it.",
  },
  research_recommend: {
    label: "Research & recommend",
    verb: "Recommend",
    hint: "Research the options and share your recommendation.",
  },
  participate: {
    label: "Participate",
    verb: "Take part",
    hint: "Take an active part in this work.",
  },
  review: { label: "Review", verb: "Review", hint: "Look this over and share what you think." },
  approve: { label: "Approve", verb: "Decide", hint: "A decision is needed from you." },
  attend: { label: "Attend", verb: "Attend", hint: "Join a call, walkthrough or meeting." },
  research: { label: "Research", verb: "Research", hint: "Look into options and report back." },
  document: { label: "Document", verb: "Document", hint: "Record notes, photos or details." },
};

/** Reuse the existing response workflow; informational work must not become an approval gate. */
export function opportunityDecisionPath(
  actionType: OwnerActionType,
): "approve" | "inform" | "consult" {
  if (actionType === "approve" || actionType === "approve_only") return "approve";
  return actionType === "information_only" ? "inform" : "consult";
}

export type OpportunitySource = "onboarding" | "operations" | "program";

export const SOURCE_META: Record<OpportunitySource, { label: string }> = {
  onboarding: { label: "Onboarding" },
  operations: { label: "Operations" },
  program: { label: "Program" },
};

export type OpportunityState = "available" | "upcoming" | "completed" | "closed";

export const OPPORTUNITY_STATE_META: Record<
  OpportunityState,
  { label: string; tone: string; blurb: string }
> = {
  available: {
    label: "Available now",
    tone: "border-primary/40 bg-primary/10 text-primary",
    blurb: "Open to you right now.",
  },
  upcoming: {
    label: "Upcoming",
    tone: "border-border bg-muted text-muted-foreground",
    blurb: "Not open yet — we will let you know when it is.",
  },
  completed: {
    label: "Completed",
    tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    blurb: "You have already taken part in this.",
  },
  closed: {
    label: "No longer available",
    tone: "border-border bg-muted text-muted-foreground",
    blurb: "This opportunity has closed.",
  },
};

export type OpportunityLike = {
  status: string;
  available_from?: string | null;
  respond_by?: string | null;
};

/** Availability is derived, never stored twice. */
export function opportunityState(o: OpportunityLike, now = new Date()): OpportunityState {
  if (o.status === "answered") return "completed";
  if (o.status === "closed") return "closed";
  if (o.available_from && new Date(o.available_from).getTime() > now.getTime()) return "upcoming";
  return "available";
}

export function isActionable(o: OpportunityLike, now = new Date()) {
  return opportunityState(o, now) === "available";
}

/** Owner-facing sentence describing what is being asked. */
export function actionSentence(actionType: string) {
  const meta = ACTION_TYPE_META[actionType as OwnerActionType];
  return meta ? meta.hint : ACTION_TYPE_META.review.hint;
}

export function actionLabel(actionType: string) {
  return ACTION_TYPE_META[actionType as OwnerActionType]?.label ?? "Review";
}

export function sourceLabel(source: string) {
  return SOURCE_META[source as OpportunitySource]?.label ?? "Program";
}

/**
 * Every new time entry must point at a documented opportunity. Legacy entries
 * predating the opportunity model keep their history and are labelled instead.
 */
export const OPPORTUNITY_REQUIRED_NOTICE =
  "Time is always logged against a specific participation opportunity, so your record shows what you took part in.";

export const LEGACY_ENTRY_LABEL = "Legacy entry — original opportunity link unavailable";
