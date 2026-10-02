/**
 * Guest Feedback — one canonical rule set shared by the public survey,
 * the OwnerRez review import, the follow-up Ticket and property history.
 * Pure module: safe in the browser and on the server.
 */

/** How long a survey link keeps working after checkout. */
export const SURVEY_VALID_DAYS = 14;
/** Default lookback window for repeat-issue detection. */
export const REPEAT_LOOKBACK_DAYS = 180;
/** Work type every automatic feedback follow-up Ticket uses. */
export const FEEDBACK_WORK_TYPE = "Guest review, survey and rating logs";

export const ISSUE_CATEGORIES = [
  "Cleaning",
  "Maintenance",
  "Property condition",
  "Amenities",
  "Check-in / access",
  "Communication",
  "Listing accuracy",
  "Noise",
  "Comfort",
  "Value",
  "Other",
] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export function cleanCategories(input: unknown): IssueCategory[] {
  if (!Array.isArray(input)) return [];
  const set = new Set(ISSUE_CATEGORIES as readonly string[]);
  return [...new Set(input.filter((c): c is IssueCategory => typeof c === "string" && set.has(c)))];
}

/** Only a perfect score skips follow-up work. Never gate anything else on rating. */
export function needsFollowUp(rating: number | null | undefined): boolean {
  return typeof rating === "number" && rating >= 1 && rating < 5;
}

export const CONTACT_OUTCOMES = [
  { value: "spoke", label: "Spoke with guest" },
  { value: "voicemail", label: "Left voicemail" },
  { value: "no_answer", label: "No answer" },
  { value: "callback", label: "Guest requested callback" },
  { value: "unreachable", label: "Unable to reach" },
  { value: "other", label: "Other" },
] as const;

export const FOLLOWUP_OUTCOMES = [
  { value: "no_issue", label: "No operational issue identified" },
  { value: "operational", label: "Operational follow-up required" },
  { value: "recovery", label: "Guest experience recovery only" },
  { value: "both", label: "Operational follow-up and guest recovery" },
] as const;

export function outcomeNeedsLinkedWork(o: string | null | undefined) {
  return o === "operational" || o === "both";
}

/* ---------------- Survey ---------------- */

export const RATED_QUESTIONS = [
  { key: "cleanliness", label: "Cleanliness" },
  { key: "comfort", label: "Beds and furniture comfort" },
  { key: "linens", label: "Linens and towels" },
  { key: "accuracy", label: "The listing matched the home" },
  { key: "communication", label: "Communication and responsiveness" },
  { key: "value", label: "Value for the price" },
] as const;

export type SurveyAnswers = {
  overall: number;
  stay_again: number;
  cleanliness?: number;
  comfort?: number;
  linens?: number;
  accuracy?: number;
  communication?: number;
  value?: number;
  had_issues: boolean;
  severity?: "minor" | "moderate" | "major";
  issue_categories?: IssueCategory[];
  issue_description?: string;
  reported_during_stay?: "yes" | "no";
  resolved_satisfactorily?: "yes" | "partly" | "no";
  improve_before_checkout?: string;
  comments?: string;
  follow_up_ok: boolean;
};

const txt = (v: unknown, max = 4000) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
const stars = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : undefined;
};

/** Validates and strips answers so hidden conditional fields are never stored. */
export function parseSurveyAnswers(input: unknown): SurveyAnswers {
  const a = (input ?? {}) as Record<string, unknown>;
  const overall = stars(a["overall"]);
  const stayAgain = stars(a["stay_again"]);
  if (!overall) throw new Error("Please choose an overall rating.");
  if (!stayAgain) throw new Error("Please tell us how likely you are to stay again.");
  const out: SurveyAnswers = {
    overall,
    stay_again: stayAgain,
    had_issues: a["had_issues"] === true,
    follow_up_ok: a["follow_up_ok"] === true,
  };
  for (const q of RATED_QUESTIONS) {
    const v = stars(a[q.key]);
    if (v) out[q.key] = v;
  }
  if (out.had_issues) {
    const sev = a["severity"];
    if (sev === "minor" || sev === "moderate" || sev === "major") out.severity = sev;
    const cats = cleanCategories(a["issue_categories"]);
    if (cats.length) out.issue_categories = cats;
    const d = txt(a["issue_description"]);
    if (d) out.issue_description = d;
    const rep = a["reported_during_stay"];
    if (rep === "yes" || rep === "no") out.reported_during_stay = rep;
    if (rep === "yes") {
      const r = a["resolved_satisfactorily"];
      if (r === "yes" || r === "partly" || r === "no") out.resolved_satisfactorily = r;
    }
  }
  const imp = txt(a["improve_before_checkout"]);
  if (imp) out.improve_before_checkout = imp;
  const c = txt(a["comments"]);
  if (c) out.comments = c;
  return out;
}

/** One-line summary stored on the shared feedback record. */
export function surveySummary(a: SurveyAnswers): string {
  return [a.issue_description, a.comments, a.improve_before_checkout].filter(Boolean).join(" — ").slice(0, 2000);
}

/* ---------------- Repeat issues ---------------- */

export type FeedbackForRepeat = { id: string; submitted_at: string; issue_categories: string[] | null };

/**
 * For each category on the current record, how many OTHER feedback records on
 * the same property carried it within the lookback window before it.
 * Informational only — never escalates.
 */
export function repeatIssues(
  current: FeedbackForRepeat,
  others: FeedbackForRepeat[],
  lookbackDays = REPEAT_LOOKBACK_DAYS,
): { category: string; count: number }[] {
  const at = new Date(current.submitted_at).getTime();
  const from = at - lookbackDays * 86400000;
  return (current.issue_categories ?? [])
    .map((category) => ({
      category,
      count: others.filter((o) => {
        if (o.id === current.id) return false;
        const t = new Date(o.submitted_at).getTime();
        return t >= from && t <= at && (o.issue_categories ?? []).includes(category);
      }).length,
    }))
    .filter((r) => r.count > 0);
}

export function repeatIssueText(r: { category: string; count: number }, lookbackDays = REPEAT_LOOKBACK_DAYS) {
  return `Possible repeat issue: ${r.category} appeared in ${r.count} prior feedback record${r.count === 1 ? "" : "s"} in the last ${lookbackDays} days.`;
}

/** True while the survey link for a stay that ended on `checkout` may still be used. */
export function surveyWindowOpen(checkout: string, now = new Date()): boolean {
  const end = new Date(`${checkout.slice(0, 10)}T00:00:00Z`).getTime();
  if (Number.isNaN(end)) return false;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return today >= end - 86400000 && today <= end + SURVEY_VALID_DAYS * 86400000;
}

export function normalizeName(s: string | null | undefined) {
  return (s ?? "").normalize("NFKD").replace(/[^a-z]/gi, "").toLowerCase();
}

/* ---------------- Review follow-up automation start date ---------------- */

/** app_settings key holding { date: "YYYY-MM-DD" } (America/Chicago calendar day). */
export const REVIEW_FOLLOWUP_START_KEY = "review_followup_automation_start";

export type ReviewImportDecision = "historical" | "no_follow_up" | "follow_up";

/** Reads the configured start date; anything invalid counts as not configured. */
export function readReviewFollowUpStart(value: unknown): string | null {
  const d = value && typeof value === "object" ? (value as { date?: unknown }).date : null;
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

/** The America/Chicago calendar day an instant falls on, as YYYY-MM-DD. */
export function chicagoDay(iso: string): string | null {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
}

/**
 * The one rule for whether an imported review opens follow-up work.
 * Published before the start date (or no start date / no publish date) →
 * historical: stored for history and reporting, never a Ticket.
 * On or after → under 5 stars opens follow-up; 5 stars does not.
 */
export function reviewImportDecision(rating: number | null, publishedAt: string | null, startDate: string | null): ReviewImportDecision {
  if (!startDate || !publishedAt) return "historical";
  const day = chicagoDay(publishedAt);
  if (!day || day < startDate) return "historical";
  return needsFollowUp(rating) ? "follow_up" : "no_follow_up";
}
