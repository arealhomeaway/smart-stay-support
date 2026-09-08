/**
 * Active Owner investor showcase — a frozen, frontend-only fixture.
 *
 * REMOVAL: this file plus src/routes/_authenticated/owner-showcase.tsx are
 * the entire fixture. Nothing else in the app imports either one, so
 * deleting both files removes the showcase completely.
 *
 * This is NOT the real Active Owner data model. It is a static, in-memory
 * stand-in for the same "Dana Reyes / ZZ QA AO — Willow" investor-demo
 * scenario designed for supabase/migrations/20260908190000_...sql, reused
 * here so Lovable Preview can render a believable Active Owner walkthrough
 * without that migration being applied to the shared backend.
 *
 * Every number below is fixed at author time — nothing here calls Supabase,
 * nothing here is fetched, and nothing here is ever written back anywhere.
 * The one piece of real production logic this file uses is
 * `progressSnapshot` from owner-participation.ts (pure, browser-safe, no
 * I/O), so the displayed pace/benchmark/state reflects the same math the
 * real owner hub relies on rather than a hand-typed approximation.
 */

import { progressSnapshot, hoursFromMinutes } from "@/lib/owner-participation";

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function isoTimestampDaysAgo(n: number): string {
  return `${isoDaysAgo(n)}T12:00:00.000Z`;
}

/** Program started 37 days ago — day 38 of 90, deliberately "on track". */
const PROGRAM_STARTED_DAYS_AGO = 37;
/** Convert a "days after program start" offset into a "days ago from today" one. */
const ago = (daysAfterStart: number) => PROGRAM_STARTED_DAYS_AGO - daysAfterStart;

export const SHOWCASE_PROPERTY_ID = "showcase-property-willow";
export const SHOWCASE_PROGRAM_ID = "showcase-program-dana-reyes";
export const SHOWCASE_TICKET_ID = "showcase-ticket-900200";
export const SHOWCASE_ROUTE = "/owner-showcase";

export type ShowcaseReview = {
  id: string;
  title: string;
  phase: "onboarding" | "ongoing";
  stage: string;
  taskType: "program_wide" | "property_specific";
  recommendation: string | null;
  businessQuestion: string | null;
  decisionPath: "inform" | "consult" | "approve";
  ownerActionType: "participate" | "review" | "approve" | "attend" | "research" | "document";
  sourceType: "onboarding" | "operations" | "program";
  status: "answered" | "awaiting_owner";
  ownerDecision: string | null;
  ownerResponse: string | null;
  outcome: string | null;
  respondBy: string | null;
  respondedAt: string | null;
  availableFrom: string | null;
  staffContext: string | null;
  ticketId: string | null;
  propertyIds: string[];
  sortOrder: number;
};

type ReviewSpec = {
  key: string;
  title: string;
  phase: "onboarding" | "ongoing";
  stage: string;
  programWide?: boolean;
  recommendation?: string | null;
  businessQuestion?: string | null;
  decisionPath: "inform" | "consult" | "approve";
  ownerActionType: ShowcaseReview["ownerActionType"];
  sourceType: ShowcaseReview["sourceType"];
  ownerDecision?: string | null;
  ownerResponse?: string | null;
  outcome?: string | null;
  /** Days after program start the response was/is due — for history rows. */
  respondByAfterStart?: number;
  respondedAfterStart?: number;
  /** For still-open rows: days from *today* the response is due. */
  respondByDaysFromNow?: number;
  ticketId?: string;
  staffContext?: string | null;
};

const HISTORY_REVIEW_SPECS: ReviewSpec[] = [
  // ---- Onboarding phase (all answered — unlocks "Onboarding Champion") ----
  {
    key: "kickoff",
    title: "Attend the onboarding kickoff call",
    phase: "onboarding",
    stage: "kickoff",
    programWide: true,
    recommendation: "Meet the onboarding lead and walk through the 90-day roadmap.",
    businessQuestion: "Ready to get started?",
    decisionPath: "inform",
    ownerActionType: "attend",
    sourceType: "onboarding",
    ownerResponse: "Attended and reviewed the roadmap.",
    outcome: "Kickoff complete — roadmap confirmed.",
    respondByAfterStart: 7,
    respondedAfterStart: 2,
  },
  {
    key: "assess",
    title: "Review the property assessment & make-ready scope",
    phase: "onboarding",
    stage: "assess",
    recommendation: "Confirm the make-ready scope compiled from the initial walk.",
    businessQuestion: "Anything missing from this scope?",
    decisionPath: "consult",
    ownerActionType: "review",
    sourceType: "onboarding",
    ownerResponse: "Reviewed the scope and flagged two items for the punch list.",
    outcome: "Scope confirmed with two additions.",
    respondByAfterStart: 9,
    respondedAfterStart: 4,
  },
  {
    key: "walkthrough",
    title: "Walk the home with the onboarding lead",
    phase: "onboarding",
    stage: "walkthrough",
    recommendation: "Join an on-site walkthrough before make-ready work begins.",
    decisionPath: "consult",
    ownerActionType: "attend",
    sourceType: "onboarding",
    ownerResponse: "Walked the full property and agreed the punch list on site.",
    outcome: "Punch list finalized on the walkthrough.",
    respondByAfterStart: 11,
    respondedAfterStart: 6,
  },
  {
    key: "furnish",
    title: "Approve the furnishing & make-ready budget",
    phase: "onboarding",
    stage: "make_ready",
    recommendation: "Approve the proposed furnishing and make-ready budget.",
    businessQuestion: "Do you approve this budget?",
    decisionPath: "approve",
    ownerActionType: "approve",
    sourceType: "onboarding",
    ownerDecision: "approve",
    ownerResponse: "Approved the proposed budget.",
    outcome: "Budget approved as recommended.",
    respondByAfterStart: 14,
    respondedAfterStart: 9,
  },
  {
    key: "select",
    title: "Select furnishings and décor for the primary living areas",
    phase: "onboarding",
    stage: "make_ready",
    recommendation: "Choose between two furniture packages for the living and primary bedroom.",
    businessQuestion: "Which package do you prefer?",
    decisionPath: "consult",
    ownerActionType: "document",
    sourceType: "onboarding",
    ownerResponse: "Selected furniture package B with two fabric swaps.",
    outcome: "Package B ordered with the requested swaps.",
    respondByAfterStart: 16,
    respondedAfterStart: 11,
  },
  {
    key: "listing",
    title: "Review the listing copy and photography set",
    phase: "onboarding",
    stage: "listing",
    recommendation: "Review the draft listing description and the photo shoot selects.",
    businessQuestion: "Anything you would change?",
    decisionPath: "consult",
    ownerActionType: "review",
    sourceType: "onboarding",
    ownerResponse: "Approved with two caption edits.",
    outcome: "Listing published with the requested caption changes.",
    respondByAfterStart: 20,
    respondedAfterStart: 15,
  },
  {
    key: "price-floor",
    title: "Approve the pricing floor for the first season",
    phase: "onboarding",
    stage: "pricing",
    recommendation: "Set a $219 weekday floor for the first 60 days.",
    businessQuestion: "Do you approve this floor?",
    decisionPath: "approve",
    ownerActionType: "approve",
    sourceType: "onboarding",
    ownerDecision: "approve",
    ownerResponse: "Approved the recommended floor.",
    outcome: "$219 weekday floor approved for the first 60 days.",
    respondByAfterStart: 22,
    respondedAfterStart: 17,
  },
  {
    key: "guest-standards",
    title: "Review guest experience & house-rules standards",
    phase: "onboarding",
    stage: "standards",
    recommendation: "Review the standard guest communication templates and house rules for this home.",
    businessQuestion: "Anything specific to add?",
    decisionPath: "inform",
    ownerActionType: "review",
    sourceType: "onboarding",
    ownerResponse: "Reviewed and confirmed the standards as written.",
    outcome: "Standards confirmed, no changes requested.",
    respondByAfterStart: 24,
    respondedAfterStart: 19,
  },

  // ---- Ongoing phase (mix of history; two are learning items) ----
  {
    key: "guide",
    title: "Read the Owner Participation Program guide",
    phase: "ongoing",
    stage: "learning",
    programWide: true,
    recommendation: "Reference material: how participation hours are counted and what qualifies.",
    decisionPath: "inform",
    ownerActionType: "research",
    sourceType: "program",
    ownerResponse: "Read the guide and reviewed how hours are counted.",
    outcome: "Guide reviewed.",
    respondByAfterStart: 26,
    respondedAfterStart: 21,
  },
  {
    key: "year1-budget",
    title: "Review the year-one operating budget variance",
    phase: "ongoing",
    stage: "operations",
    recommendation: "Review where actuals differ from the year-one operating budget.",
    businessQuestion: "Anything you want the team to revisit?",
    decisionPath: "inform",
    ownerActionType: "review",
    sourceType: "operations",
    ownerResponse: "Reviewed the variance and had no follow-up questions.",
    outcome: "Variance reviewed, no action needed.",
    respondByAfterStart: 27,
    respondedAfterStart: 22,
  },
  {
    key: "vendor-estimate",
    title: "Review the landscaping & hot tub service estimate",
    phase: "ongoing",
    stage: "operations",
    recommendation: "Review the vendor estimate for landscaping and hot tub servicing.",
    businessQuestion: "Do you want anything added to scope?",
    decisionPath: "consult",
    ownerActionType: "review",
    sourceType: "operations",
    ownerResponse: "Reviewed the estimate and approved it for scheduling.",
    outcome: "Estimate approved for scheduling.",
    respondByAfterStart: 28,
    respondedAfterStart: 23,
    ticketId: SHOWCASE_TICKET_ID,
  },
  {
    key: "guest-escalation",
    title: "Review a guest escalation summary and response",
    phase: "ongoing",
    stage: "operations",
    recommendation: "Review how a recent guest escalation was handled and the resolution offered.",
    businessQuestion: "Would you have handled this differently?",
    decisionPath: "consult",
    ownerActionType: "review",
    sourceType: "operations",
    ownerResponse: "Reviewed the summary and agreed with the resolution.",
    outcome: "Resolution confirmed with the owner.",
    respondByAfterStart: 29,
    respondedAfterStart: 24,
  },
  {
    key: "str-regs",
    title: "Research local short-term rental regulation updates",
    phase: "ongoing",
    stage: "learning",
    programWide: true,
    recommendation: "Look into recent short-term rental regulation changes for the market.",
    decisionPath: "inform",
    ownerActionType: "research",
    sourceType: "program",
    ownerResponse: "Reviewed the update posted by the local association.",
    outcome: "No action required at this time.",
    respondByAfterStart: 30,
    respondedAfterStart: 25,
  },
  {
    key: "market-briefing",
    title: "Attend the local market & comp-set briefing",
    phase: "ongoing",
    stage: "operations",
    programWide: true,
    recommendation: "Join the quarterly market and comp-set briefing.",
    decisionPath: "inform",
    ownerActionType: "attend",
    sourceType: "program",
    ownerResponse: "Attended the briefing and asked follow-up questions on comp pricing.",
    outcome: "Briefing attended.",
    respondByAfterStart: 31,
    respondedAfterStart: 26,
  },
  {
    key: "repair-approve",
    title: "Approve a repair estimate over the standing threshold",
    phase: "ongoing",
    stage: "operations",
    recommendation: "Approve a repair estimate that exceeds the standing spend threshold.",
    businessQuestion: "Do you approve this repair?",
    decisionPath: "approve",
    ownerActionType: "approve",
    sourceType: "operations",
    ownerDecision: "approve",
    ownerResponse: "Approved the repair as estimated.",
    outcome: "Repair approved and scheduled.",
    respondByAfterStart: 32,
    respondedAfterStart: 27,
  },
  {
    key: "appliance-approve",
    title: "Approve the replacement appliance package",
    phase: "ongoing",
    stage: "operations",
    recommendation: "Approve the replacement package for the kitchen appliances nearing end of life.",
    businessQuestion: "Do you approve this package?",
    decisionPath: "approve",
    ownerActionType: "approve",
    sourceType: "operations",
    ownerDecision: "approve",
    ownerResponse: "Approved the recommended package.",
    outcome: "Appliance package approved.",
    respondByAfterStart: 33,
    respondedAfterStart: 28,
  },
  {
    key: "ops-report",
    title: "Review the first 30 days operations report",
    phase: "ongoing",
    stage: "operations",
    recommendation: "Review the first 30 days of operations at the home.",
    businessQuestion: "Anything you want to see differently?",
    decisionPath: "inform",
    ownerActionType: "review",
    sourceType: "operations",
    ownerResponse: "Reviewed the report and had no follow-up questions.",
    outcome: "Report reviewed.",
    respondByAfterStart: 34,
    respondedAfterStart: 29,
  },
  {
    key: "marketing-plan",
    title: "Review the year-one marketing plan draft",
    phase: "ongoing",
    stage: "operations",
    programWide: true,
    recommendation: "Review the draft year-one marketing plan for the home.",
    businessQuestion: "Anything you want added?",
    decisionPath: "consult",
    ownerActionType: "review",
    sourceType: "program",
    ownerResponse: "Reviewed the draft and suggested one seasonal promotion.",
    outcome: "Plan updated with the suggested promotion.",
    respondByAfterStart: 35,
    respondedAfterStart: 30,
  },
  {
    key: "review-calibration",
    title: "Participate in the guest review response calibration session",
    phase: "ongoing",
    stage: "operations",
    programWide: true,
    recommendation: "Join a session calibrating how guest reviews are responded to.",
    decisionPath: "consult",
    ownerActionType: "participate",
    sourceType: "program",
    ownerResponse: "Participated and shared two example responses.",
    outcome: "Calibration session complete.",
    respondByAfterStart: 36,
    respondedAfterStart: 31,
  },
  {
    key: "holiday-rate",
    title: "Approve the holiday-season rate strategy",
    phase: "ongoing",
    stage: "operations",
    recommendation: "Approve the proposed holiday-season rate strategy.",
    businessQuestion: "Do you approve this strategy?",
    decisionPath: "approve",
    ownerActionType: "approve",
    sourceType: "operations",
    ownerDecision: "approve",
    ownerResponse: "Approved the strategy as proposed.",
    outcome: "Holiday rate strategy approved.",
    respondByAfterStart: 37,
    respondedAfterStart: 32,
  },
  {
    key: "smart-lock",
    title: "Attend the smart-lock & tech install walkthrough",
    phase: "ongoing",
    stage: "operations",
    recommendation: "Join the vendor walkthrough for the smart-lock and tech install.",
    decisionPath: "consult",
    ownerActionType: "attend",
    sourceType: "operations",
    ownerResponse: "Attended and approved the placement of the new devices.",
    outcome: "Install walkthrough complete.",
    respondByAfterStart: 38,
    respondedAfterStart: 33,
  },
  {
    key: "mid-check-in",
    title: "Mid-program check-in call with the operations lead",
    phase: "ongoing",
    stage: "operations",
    programWide: true,
    recommendation: "A scheduled mid-program check-in on how the program is going.",
    decisionPath: "inform",
    ownerActionType: "attend",
    sourceType: "operations",
    ownerResponse: "Attended the check-in call.",
    outcome: "Check-in complete; time logged and awaiting internal review.",
    respondByAfterStart: 39,
    respondedAfterStart: 34,
  },
  {
    key: "seasonal-refresh",
    title: "Refresh seasonal décor and guest welcome materials",
    phase: "ongoing",
    stage: "operations",
    recommendation: "Refresh seasonal décor and the printed guest welcome materials.",
    decisionPath: "consult",
    ownerActionType: "document",
    sourceType: "operations",
    ownerResponse: "Selected and delivered new seasonal décor and welcome materials.",
    outcome: "Refresh complete.",
    respondByAfterStart: 40,
    respondedAfterStart: 35,
  },
  {
    key: "winterization",
    title: "Approve the winterization & preventive maintenance plan",
    phase: "ongoing",
    stage: "operations",
    recommendation: "Approve the winterization and preventive maintenance plan before the cold season.",
    businessQuestion: "Do you approve this plan?",
    decisionPath: "approve",
    ownerActionType: "approve",
    sourceType: "operations",
    ownerDecision: "approve",
    ownerResponse: "Approved the plan as recommended.",
    outcome: "Winterization plan approved.",
    respondByAfterStart: 41,
    respondedAfterStart: 36,
  },
  {
    key: "weekly-sync",
    title: "Weekly operations sync call",
    phase: "ongoing",
    stage: "operations",
    programWide: true,
    recommendation: "A standing weekly sync call on operations at the home.",
    decisionPath: "inform",
    ownerActionType: "attend",
    sourceType: "operations",
    ownerResponse: "Attended the weekly sync call.",
    outcome: "Sync call complete.",
    respondByAfterStart: 42,
    respondedAfterStart: 37,
  },
  {
    key: "fall-refresh-day",
    title: "On-site day: fall refresh, vendor walkthroughs and guest-ready inspection",
    phase: "ongoing",
    stage: "operations",
    recommendation: "A full on-site day covering the fall refresh, vendor walkthroughs and a guest-ready inspection.",
    decisionPath: "consult",
    ownerActionType: "document",
    sourceType: "operations",
    ownerResponse: "Spent the day on site for the fall refresh, three vendor walkthroughs and the final guest-ready inspection.",
    outcome: "Home confirmed guest-ready for the season.",
    respondByAfterStart: 42,
    respondedAfterStart: 37,
  },
];

/** Open opportunities the homeowner has not acted on yet. */
const OPEN_REVIEW_SPECS: ReviewSpec[] = [
  {
    key: "fall-maintenance",
    title: "Review the fall maintenance walkthrough summary",
    phase: "ongoing",
    stage: "operations",
    recommendation: "Fall walkthrough complete — furnace, gutters and exterior lighting all checked out.",
    businessQuestion: "Anything you would like double-checked before winter?",
    decisionPath: "inform",
    ownerActionType: "review",
    sourceType: "operations",
    respondByDaysFromNow: 7,
  },
  {
    key: "winter-rate",
    title: "Approve the winter guest-ready rate adjustment",
    phase: "ongoing",
    stage: "operations",
    recommendation: "A $15/night winter adjustment starting next month.",
    businessQuestion: "Do you approve this adjustment?",
    decisionPath: "approve",
    ownerActionType: "approve",
    sourceType: "operations",
    respondByDaysFromNow: 5,
  },
];

/** Program-wide, forward-looking items — one available, one still "upcoming". */
const FORWARD_REVIEW_SPECS: (ReviewSpec & { availableFromAfterStart: number })[] = [
  {
    key: "advisory-council",
    title: "RSVP: Owner Advisory Council welcome session",
    phase: "ongoing",
    stage: "learning",
    programWide: true,
    recommendation: "Join the welcome session for ARHA's Owner Advisory Council.",
    decisionPath: "inform",
    ownerActionType: "attend",
    sourceType: "program",
    respondByDaysFromNow: 10,
    availableFromAfterStart: 36,
  },
  {
    key: "year1-review-call",
    title: "Year-one performance review call",
    phase: "ongoing",
    stage: "operations",
    programWide: true,
    recommendation: "A full year-one performance review call covering all participation and results.",
    decisionPath: "inform",
    ownerActionType: "attend",
    sourceType: "program",
    respondByDaysFromNow: 20,
    staffContext: "Opens once the fall maintenance and winter rate items are resolved.",
    availableFromAfterStart: 48, // in the future — renders as "Upcoming"
  },
];

function buildReview(
  spec: ReviewSpec,
  index: number,
  overrides: { status: ShowcaseReview["status"]; availableFrom: string | null },
): ShowcaseReview {
  return {
    id: `showcase-review-${spec.key}`,
    title: spec.title,
    phase: spec.phase,
    stage: spec.stage,
    taskType: spec.programWide ? "program_wide" : "property_specific",
    recommendation: spec.recommendation ?? null,
    businessQuestion: spec.businessQuestion ?? null,
    decisionPath: spec.decisionPath,
    ownerActionType: spec.ownerActionType,
    sourceType: spec.sourceType,
    status: overrides.status,
    ownerDecision: spec.ownerDecision ?? null,
    ownerResponse: spec.ownerResponse ?? null,
    outcome: spec.outcome ?? null,
    respondBy:
      spec.respondByDaysFromNow != null
        ? isoDaysAgo(-spec.respondByDaysFromNow)
        : spec.respondByAfterStart != null
          ? isoDaysAgo(ago(spec.respondByAfterStart))
          : null,
    respondedAt:
      spec.respondedAfterStart != null ? isoTimestampDaysAgo(ago(spec.respondedAfterStart)) : null,
    availableFrom: overrides.availableFrom,
    staffContext: spec.staffContext ?? null,
    ticketId: spec.ticketId ?? null,
    propertyIds: spec.programWide ? [] : [SHOWCASE_PROPERTY_ID],
    sortOrder: index + 1,
  };
}

/**
 * The one review still open because a logged entry against it was returned
 * for correction (see `returnedEntry` below) — mirrors the same "Confirm the
 * pricing call notes" scenario in the SQL seed, kept open (not answered) so
 * the fixture's own returned entry always resolves to a real opportunity.
 */
const RETURNED_ITEM_REVIEW: ShowcaseReview = {
  id: "showcase-review-price-call-notes",
  title: "Confirm the pricing call notes",
  phase: "ongoing",
  stage: "operations",
  taskType: "property_specific",
  recommendation: "Confirm the notes from the pricing strategy call before they are logged.",
  businessQuestion: "Which home did this call cover?",
  decisionPath: "consult",
  ownerActionType: "document",
  sourceType: "operations",
  status: "awaiting_owner",
  ownerDecision: null,
  ownerResponse: null,
  outcome: null,
  respondBy: isoDaysAgo(ago(25)),
  respondedAt: null,
  availableFrom: null,
  staffContext: "Returned to the homeowner — the logged entry did not say which property the call covered.",
  ticketId: null,
  propertyIds: [SHOWCASE_PROPERTY_ID],
  sortOrder: HISTORY_REVIEW_SPECS.length + 1,
};

export const SHOWCASE_REVIEWS: ShowcaseReview[] = [
  ...HISTORY_REVIEW_SPECS.map((spec, i) => buildReview(spec, i, { status: "answered", availableFrom: null })),
  RETURNED_ITEM_REVIEW,
  ...OPEN_REVIEW_SPECS.map((spec, i) =>
    buildReview(spec, HISTORY_REVIEW_SPECS.length + 1 + i, {
      status: "awaiting_owner",
      availableFrom: isoTimestampDaysAgo(2 - i), // already available
    }),
  ),
  ...FORWARD_REVIEW_SPECS.map((spec, i) =>
    buildReview(spec, HISTORY_REVIEW_SPECS.length + 1 + OPEN_REVIEW_SPECS.length + i, {
      status: "awaiting_owner",
      availableFrom: isoTimestampDaysAgo(ago(spec.availableFromAfterStart)),
    }),
  ),
];

export type ShowcaseEntry = {
  id: string;
  reviewId: string | null;
  reviewTitle: string;
  entryDate: string;
  minutes: number;
  activity: string;
  activityCategory: string;
  output: string | null;
  reviewStatus: "approved" | "submitted" | "returned";
  reviewedAt: string | null;
  reviewNote: string | null;
  amendsEntryId: string | null;
  correctionReason: string | null;
};

type EntrySpec = {
  key: string;
  reviewKey: string;
  afterStart: number;
  minutes: number;
  activity: string;
  category: string;
  output?: string | null;
  status?: ShowcaseEntry["reviewStatus"];
  reviewNote?: string | null;
};

const HISTORY_ENTRY_SPECS: EntrySpec[] = [
  { key: "kickoff", reviewKey: "kickoff", afterStart: 2, minutes: 90, activity: "Attended the onboarding kickoff call with the onboarding lead.", category: "Onboarding meeting", output: "Reviewed the 90-day roadmap and confirmed next steps." },
  { key: "assess", reviewKey: "assess", afterStart: 4, minutes: 180, activity: "Reviewed the property assessment and make-ready scope line by line.", category: "Property assessment review", output: "Flagged two items to add to the punch list." },
  { key: "walkthrough", reviewKey: "walkthrough", afterStart: 6, minutes: 240, activity: "Walked the full property with the onboarding lead ahead of make-ready work.", category: "Property assessment review", output: "Agreed the punch list on site." },
  { key: "furnish", reviewKey: "furnish", afterStart: 9, minutes: 60, activity: "Reviewed and approved the furnishing and make-ready budget.", category: "Make-ready or furnishing decision", output: "Approved with no changes." },
  { key: "select", reviewKey: "select", afterStart: 11, minutes: 300, activity: "Researched furniture options and selected the living-room and primary-bedroom packages.", category: "Make-ready or furnishing decision", output: "Selected package B with two fabric swaps." },
  { key: "listing", reviewKey: "listing", afterStart: 15, minutes: 150, activity: "Reviewed the draft listing copy and the full photography select set.", category: "Listing, photography or pricing review", output: "Approved with two caption edits." },
  { key: "price-floor", reviewKey: "price-floor", afterStart: 17, minutes: 75, activity: "Reviewed pricing strategy and approved the first-season weekday floor.", category: "Listing, photography or pricing review", output: "Approved the $219 floor." },
  { key: "guest-standards", reviewKey: "guest-standards", afterStart: 19, minutes: 105, activity: "Reviewed the standard guest communication templates and house rules for the home.", category: "Guest experience or standards", output: "Confirmed as written, no changes." },
  { key: "guide", reviewKey: "guide", afterStart: 21, minutes: 45, activity: "Read the Owner Participation Program guide end to end.", category: "Other participation", output: "Reviewed how participation hours are counted." },
  { key: "year1-budget", reviewKey: "year1-budget", afterStart: 22, minutes: 210, activity: "Reviewed the year-one operating budget and where actuals differed from plan.", category: "Financial or reporting review", output: "No follow-up questions." },
  { key: "vendor-estimate", reviewKey: "vendor-estimate", afterStart: 23, minutes: 90, activity: "Reviewed the landscaping and hot tub service vendor estimate.", category: "Vendor estimate review", output: "Approved for scheduling." },
  { key: "guest-escalation", reviewKey: "guest-escalation", afterStart: 24, minutes: 105, activity: "Reviewed a recent guest escalation and how it was resolved.", category: "Guest experience or standards", output: "Agreed with the resolution offered." },
  { key: "str-regs", reviewKey: "str-regs", afterStart: 25, minutes: 75, activity: "Researched recent short-term rental regulation changes for the local market.", category: "Other participation", output: "No action required at this time." },
  { key: "market-briefing", reviewKey: "market-briefing", afterStart: 26, minutes: 120, activity: "Attended the quarterly local market and comp-set briefing.", category: "Operating decision", output: "Asked follow-up questions on comp pricing." },
  { key: "repair-approve", reviewKey: "repair-approve", afterStart: 27, minutes: 60, activity: "Reviewed and approved a repair estimate over the standing spend threshold.", category: "Assessment or maintenance review", output: "Approved as estimated." },
  { key: "appliance-approve", reviewKey: "appliance-approve", afterStart: 28, minutes: 120, activity: "Reviewed and approved the replacement kitchen appliance package.", category: "Make-ready or furnishing decision", output: "Approved the recommended package." },
  { key: "ops-report", reviewKey: "ops-report", afterStart: 29, minutes: 150, activity: "Reviewed the first 30 days of operations report for the home.", category: "Financial or reporting review", output: "No follow-up questions." },
  { key: "marketing-plan", reviewKey: "marketing-plan", afterStart: 30, minutes: 240, activity: "Reviewed the draft year-one marketing plan and researched two seasonal promotion ideas.", category: "Operating decision", output: "Suggested one seasonal promotion, added to the plan." },
  { key: "review-calibration", reviewKey: "review-calibration", afterStart: 31, minutes: 105, activity: "Participated in the session calibrating guest review response tone.", category: "Guest experience or standards", output: "Shared two example responses." },
  { key: "holiday-rate", reviewKey: "holiday-rate", afterStart: 32, minutes: 90, activity: "Reviewed and approved the proposed holiday-season rate strategy.", category: "Listing, photography or pricing review", output: "Approved as proposed." },
  { key: "smart-lock", reviewKey: "smart-lock", afterStart: 33, minutes: 210, activity: "Attended the vendor walkthrough for the smart-lock and tech install and approved device placement.", category: "Vendor estimate review", output: "Approved the placement of the new devices." },
  { key: "mid-check-in", reviewKey: "mid-check-in", afterStart: 34, minutes: 90, activity: "Attended the scheduled mid-program check-in call with the operations lead.", category: "Operating decision", output: null, status: "submitted" },
  { key: "seasonal-refresh", reviewKey: "seasonal-refresh", afterStart: 35, minutes: 300, activity: "Selected and delivered refreshed seasonal décor and printed guest welcome materials.", category: "Guest experience or standards", output: "Refresh complete ahead of the season." },
  { key: "winterization", reviewKey: "winterization", afterStart: 36, minutes: 90, activity: "Reviewed and approved the winterization and preventive maintenance plan.", category: "Assessment or maintenance review", output: "Approved as recommended." },
  { key: "fall-refresh-day", reviewKey: "fall-refresh-day", afterStart: 37, minutes: 390, activity: "Spent the day on site for the fall refresh, three vendor walkthroughs and the final guest-ready inspection.", category: "Assessment or maintenance review", output: "Home confirmed guest-ready for the season." },
];

function buildEntry(spec: EntrySpec): ShowcaseEntry {
  const status = spec.status ?? "approved";
  return {
    id: `showcase-entry-${spec.key}`,
    reviewId: `showcase-review-${spec.reviewKey}`,
    reviewTitle: HISTORY_REVIEW_SPECS.find((r) => r.key === spec.reviewKey)?.title ?? spec.reviewKey,
    entryDate: isoDaysAgo(ago(spec.afterStart)),
    minutes: spec.minutes,
    activity: spec.activity,
    activityCategory: spec.category,
    output: spec.output ?? null,
    reviewStatus: status,
    reviewedAt: status === "approved" ? isoTimestampDaysAgo(ago(spec.afterStart) - 1) : null,
    reviewNote: spec.reviewNote ?? null,
    amendsEntryId: null,
    correctionReason: null,
  };
}

const returnedEntry: ShowcaseEntry = {
  id: "showcase-entry-returned",
  reviewId: "showcase-review-price-call-notes",
  reviewTitle: "Confirm the pricing call notes",
  entryDate: isoDaysAgo(ago(20)),
  minutes: 45,
  activity: "Call about the winter pricing strategy.",
  activityCategory: "Listing, photography or pricing review",
  output: "Decision pending.",
  reviewStatus: "returned",
  reviewedAt: isoTimestampDaysAgo(ago(21)),
  reviewNote: "Please note which property this call covered before we can approve it.",
  amendsEntryId: null,
  correctionReason: null,
};

const weeklySyncOriginal: ShowcaseEntry = {
  id: "showcase-entry-weekly-sync-original",
  reviewId: "showcase-review-weekly-sync",
  reviewTitle: "Weekly operations sync call",
  entryDate: isoDaysAgo(ago(37)),
  minutes: 30,
  activity: "Weekly operations sync call (initial log).",
  activityCategory: "Operating decision",
  output: null,
  reviewStatus: "approved",
  reviewedAt: isoTimestampDaysAgo(ago(37)),
  reviewNote: null,
  amendsEntryId: null,
  correctionReason: null,
};

const weeklySyncCorrected: ShowcaseEntry = {
  id: "showcase-entry-weekly-sync-corrected",
  reviewId: "showcase-review-weekly-sync",
  reviewTitle: "Weekly operations sync call",
  entryDate: isoDaysAgo(ago(37)),
  minutes: 60,
  activity: "Weekly operations sync call.",
  activityCategory: "Operating decision",
  output: "Confirmed follow-ups with the operations lead.",
  reviewStatus: "approved",
  reviewedAt: isoTimestampDaysAgo(ago(37)),
  reviewNote: null,
  amendsEntryId: "showcase-entry-weekly-sync-original",
  correctionReason: "Corrected the call length — the calendar showed 60 minutes, not 30.",
};

export const SHOWCASE_ENTRIES: ShowcaseEntry[] = [
  ...HISTORY_ENTRY_SPECS.map(buildEntry),
  returnedEntry,
  weeklySyncOriginal,
  weeklySyncCorrected,
];

/** Same counting rule as owner-participation.server.ts: a returned entry, or
 *  one a later correction superseded, never counts toward the total. */
function countedMinutes(entries: ShowcaseEntry[]): number {
  const superseded = new Set(entries.map((e) => e.amendsEntryId).filter((id): id is string => Boolean(id)));
  return entries
    .filter((e) => e.reviewStatus !== "returned" && !superseded.has(e.id))
    .reduce((sum, e) => sum + e.minutes, 0);
}

export const SHOWCASE_REPORTED_MINUTES = countedMinutes(SHOWCASE_ENTRIES);
export const SHOWCASE_REPORTED_HOURS = hoursFromMinutes(SHOWCASE_REPORTED_MINUTES);

export type ShowcaseBadge = {
  code: string;
  awardedAt: string;
  triggerRule: string;
  needsReview: boolean;
};

export const SHOWCASE_BADGES: ShowcaseBadge[] = [
  { code: "first_step", awardedAt: isoTimestampDaysAgo(ago(2)), triggerRule: "First participation entry recorded", needsReview: false },
  { code: "decision_maker", awardedAt: isoTimestampDaysAgo(ago(9)), triggerRule: "First owner decision completed", needsReview: false },
  { code: "building_momentum", awardedAt: isoTimestampDaysAgo(ago(11)), triggerRule: "10 reported hours reached", needsReview: false },
  { code: "consistent_participation", awardedAt: isoTimestampDaysAgo(ago(15)), triggerRule: "Activity reported in 3 separate program weeks", needsReview: false },
  { code: "engaged_owner", awardedAt: isoTimestampDaysAgo(ago(23)), triggerRule: "25 reported hours reached", needsReview: false },
  { code: "halfway", awardedAt: isoTimestampDaysAgo(ago(35)), triggerRule: "50 reported hours reached", needsReview: false },
  { code: "onboarding_champion", awardedAt: isoTimestampDaysAgo(ago(37)), triggerRule: "60 reported hours with all onboarding activities complete", needsReview: false },
];

export const SHOWCASE_PROPERTY = {
  id: SHOWCASE_PROPERTY_ID,
  name: "ZZ QA AO — Willow",
  address: "48 Willow Bend Court, Franklin, TN",
  photoUrl: null as string | null,
};

export const SHOWCASE_PROGRAM = {
  id: SHOWCASE_PROGRAM_ID,
  ownerName: "Dana Reyes (not a real person)",
  ownerEmail: "dana.reyes.qa@example.invalid",
  startedOn: isoDaysAgo(PROGRAM_STARTED_DAYS_AGO),
  status: "active" as const,
};

export const SHOWCASE_SNAPSHOT = progressSnapshot({
  status: SHOWCASE_PROGRAM.status,
  startedOn: SHOWCASE_PROGRAM.startedOn,
  reportedMinutes: SHOWCASE_REPORTED_MINUTES,
});

export const SHOWCASE_TICKET = {
  id: SHOWCASE_TICKET_ID,
  ref: 900200,
  title: "ZZ QA AO — Willow: Hot tub service estimate",
  status: "resolved" as const,
  reportedAt: isoTimestampDaysAgo(ago(22)),
  resolvedAt: isoTimestampDaysAgo(ago(23)),
};
