/**
 * "What the homeowner has" (approved by the Admin, Nov 16): one read-only answer, for staff, to
 * what has gone to the homeowner for a home. Pure and browser-safe. Presentation only: no card
 * rule, unlock, deadline or status changes here. The groups follow the homeowner portal's own
 * reading of a plan card (portalCardView, planCardOptional, isArhaSetupStep) so every screen
 * gives the same answer.
 */
import { isArhaSetupStep, planCardOptional } from "@/lib/owner-opportunity-board";
import { entriesForCard, hoursFromMinutes, portalOpensWhen, type HourEntry } from "@/lib/owner-portal-look";
import { parseOutputFields } from "@/lib/ao-ui";

const CENTRAL = "America/Chicago";

/** "11/18/2026", the Central calendar day of a time (or a stored YYYY-MM-DD as is). */
export function centralDay(value: string | null | undefined): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${m}/${d}/${y}`;
  }
  const t = new Date(value);
  if (Number.isNaN(t.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: CENTRAL, month: "2-digit", day: "2-digit", year: "numeric" }).format(t);
}

/** "11/18/2026, 5:00 PM", Central time. */
export function centralDayTime(value: string | null | undefined): string {
  if (!value) return "";
  const t = new Date(value);
  if (Number.isNaN(t.getTime())) return "";
  const time = new Intl.DateTimeFormat("en-US", { timeZone: CENTRAL, hour: "numeric", minute: "2-digit", hour12: true }).format(t);
  return `${centralDay(value)}, ${time}`;
}

export const HAS_COPY = {
  title: "What the homeowner has",
  preview: "Preview as homeowner",
  cards: "Homeowner cards",
  sent: "Sent for the homeowner's answer",
  groups: {
    answer: "Needs the homeowner's answer",
    open: "Open for the homeowner",
    waiting: "Waiting on our team",
    done: "Done by the homeowner",
    hidden: "Not shown to the homeowner",
  },
  noCards: "No homeowner cards for this home yet.",
  noSent: "Nothing has been sent for the homeowner's answer yet.",
  failed: "This could not load. Try again in a minute.",
  tryAgain: "Try again",
  loading: "Loading…",
} as const;

export type HasGroup = keyof typeof HAS_COPY.groups;

/** One plan card as staff read it (ao_home_plan_cards with its library card). */
export type HasPlanCard = {
  id: string;
  propertyId: string;
  code: string | null;
  title: string;
  opensText: string | null;
  stageWindow: string | null;
  lane: string | null;
  joinOutcome: string;
  unlockedAt: string | null;
  deadlineAt: string | null;
  expiredAt: string | null;
  ownerCompletedAt: string | null;
  createdAt: string | null;
  ownerReviewId: string | null;
  /** The card's answer fields (library output_fields), to label what the homeowner sent. */
  outputFields?: unknown;
  /** What the homeowner sent, when the reader may see it. */
  submission?: CardSubmission | null;
};

/** The homeowner's saved answer on a plan card (ao_contributions). */
export type CardSubmission = { values: Record<string, unknown>; files: HasFile[]; submittedAt: string };

/** What the homeowner sent, read for staff: proof lines and files on a finished card. */
export type HasProof = { lines: string[]; files: HasFile[] };

export type HasCardItem = { id: string; title: string; line: string; changedAt: string; proof?: HasProof };
export type HasCardGroups = Record<HasGroup, HasCardItem[]>;

export const HIDDEN_REASON = {
  covered: "Already covered",
  passed: "Past its stage",
  setup: "Our team's own setup step",
  planOff: "Homeowner plan is off for this home",
  notOnPlan: "Not on the homeowner's plan",
} as const;

const latest = (...values: (string | null | undefined)[]) =>
  values.filter((v): v is string => Boolean(v)).sort().at(-1) ?? "";

const fieldValue = (type: string, v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (type === "yes_no") return v === true || v === "yes" ? "Yes" : v === false || v === "no" ? "No" : String(v);
  return String(v).trim();
};

/** "Provider: AT&T", one per answered field, in the card's own field order. */
export function submissionLines(outputFields: unknown, sub: CardSubmission | null | undefined): string[] {
  if (!sub) return [];
  const fields = parseOutputFields(outputFields);
  const known = new Set(fields.map((f) => f.key));
  const out = fields.map((f) => ({ label: f.label, value: fieldValue(f.type, sub.values[f.key]) })).filter((x) => x.value);
  // Values whose field was later renamed still show, under their saved key.
  for (const [k, v] of Object.entries(sub.values)) if (!known.has(k) && fieldValue("text", v)) out.push({ label: k.replace(/_/g, " "), value: fieldValue("text", v) });
  return out.map((x) => `${x.label}: ${x.value}`);
}

/** One short line of the answer, for lists: "Provider: AT&T · Speed: 500 Mbps". */
export function submissionSummary(outputFields: unknown, sub: CardSubmission | null | undefined): string {
  const text = submissionLines(outputFields, sub).join(" · ").replace(/\s+/g, " ").trim();
  return text.length > 160 ? `${text.slice(0, 159).trimEnd()}…` : text;
}

/** "Hours: 2.7 hrs on 11/14/2026", one per saved entry for the card. */
export function hourProofLines(entries: HourEntry[]): string[] {
  return entries.map((e) => `Hours: ${hoursFromMinutes(Number(e.minutes) || 0)} hrs${e.entry_date ? ` on ${centralDay(e.entry_date)}` : ""}`);
}

/** Which group one card sits in, and its line. Same reading as the homeowner portal. */
export function cardPlacement(
  c: HasPlanCard,
  opts: { planOn: boolean; minutes: number },
): { group: HasGroup; line: string } {
  if (!opts.planOn) return { group: "hidden", line: HIDDEN_REASON.planOff };
  if (c.joinOutcome === "already_covered") return { group: "hidden", line: HIDDEN_REASON.covered };
  if (c.joinOutcome === "skipped_passed") return { group: "hidden", line: HIDDEN_REASON.passed };
  if (c.joinOutcome !== "locked" && c.joinOutcome !== "open") return { group: "hidden", line: HIDDEN_REASON.notOnPlan };
  if (isArhaSetupStep(c.title)) return { group: "hidden", line: HIDDEN_REASON.setup };
  if (c.ownerCompletedAt) {
    const hours = opts.minutes > 0 ? ` · ${hoursFromMinutes(opts.minutes)} hrs logged` : "";
    return { group: "done", line: `Done ${centralDay(c.ownerCompletedAt)}${hours}` };
  }
  // The homeowner reads a closed card as "ARHA is taking care of it".
  if (c.expiredAt) return { group: "waiting", line: `Our team took it over ${centralDay(c.expiredAt)}` };
  if (!c.unlockedAt) return { group: "waiting", line: `Opens when ${portalOpensWhen(c.opensText)}` };
  if (c.deadlineAt && !planCardOptional({ stage_window: c.stageWindow, lane: c.lane }))
    return { group: "answer", line: `Due ${centralDayTime(c.deadlineAt)} Central` };
  return { group: "open", line: `Open since ${centralDay(c.unlockedAt)}` };
}

/** Every plan card for the home, grouped, newest change first in each group. */
export function homeownerCardGroups(
  cards: HasPlanCard[],
  opts: { planOn: (propertyId: string) => boolean; hourEntries: HourEntry[] },
): HasCardGroups {
  const out: HasCardGroups = { answer: [], open: [], waiting: [], done: [], hidden: [] };
  for (const c of cards) {
    const entries = c.ownerCompletedAt
      ? entriesForCard(opts.hourEntries, { title: c.title, reviewId: c.ownerReviewId, propertyIds: [c.propertyId] })
      : [];
    const minutes = entries.reduce((sum, e) => sum + (e.minutes || 0), 0);
    const { group, line } = cardPlacement(c, { planOn: opts.planOn(c.propertyId), minutes });
    const proof = group === "done"
      ? { lines: [...submissionLines(c.outputFields, c.submission), ...hourProofLines(entries)], files: c.submission?.files ?? [] }
      : undefined;
    out[group].push({
      id: c.id,
      title: c.title,
      line,
      changedAt: latest(c.ownerCompletedAt, c.expiredAt, c.unlockedAt, c.createdAt),
      ...(proof && (proof.lines.length || proof.files.length) ? { proof } : {}),
    });
  }
  for (const g of Object.keys(out) as HasGroup[])
    out[g].sort((a, b) => b.changedAt.localeCompare(a.changedAt) || a.title.localeCompare(b.title));
  return out;
}

/* ---------- Sent for the homeowner's answer ---------- */

/** The role a teammate holds, never a name. Highest responsibility first. */
export function senderRole(input: { appRoles: readonly string[]; roleCodes: readonly string[] }): string {
  const has = (...codes: string[]) => codes.some((c) => input.roleCodes.includes(c));
  if (has("director_onboarding", "onboarding_director")) return "Director of Onboarding";
  if (has("director_ops")) return "Director of Operations";
  if (has("ops_supervisor")) return "Operations Supervisor";
  if (input.appRoles.includes("admin")) return "Admin";
  if (has("onboarding_project_manager", "project_manager")) return "Project Manager";
  if (has("utilities")) return "Utilities";
  if (has("design_staging", "designer", "lead_designer", "design")) return "Design";
  if (has("finance_lead")) return "Finance lead";
  if (input.appRoles.includes("tech")) return "Property Coordinator";
  if (input.appRoles.includes("onboarding")) return "Onboarding team";
  if (input.appRoles.includes("manager")) return "Operations team";
  return "Our team";
}

export type HasFile = { id: string; name: string };

/** One owner item (owner_reviews) as staff read it. */
export type HasReview = {
  id: string;
  title: string;
  status: string;
  sentAt: string | null;
  sentBy: string | null;
  respondedAt: string | null;
  closedAt: string | null;
  decision: string | null;
  response: string | null;
  /** The homeowner's last message on the item, when the answer was written there. */
  lastOwnerMessage: string | null;
  files: HasFile[];
};

/** One approval sent to the homeowner (approvals, approver role owner). */
export type HasApproval = {
  id: string;
  title: string;
  status: string;
  createdAt: string | null;
  requestedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  files: HasFile[];
};

export type HasSentItem = {
  key: string;
  title: string;
  sentLine: string;
  statusLine: string;
  waiting: boolean;
  sentAt: string;
  files: HasFile[];
};

/** Owner items not yet shared ("prepared") were never sent. */
export const UNSENT_REVIEW = new Set(["prepared", "draft"]);
/** Approvals the team withdrew or cancelled are gone from the homeowner's view. */
export const GONE_APPROVAL = new Set(["withdrawn", "cancelled"]);

const DECISION_WORDS: Record<string, string> = {
  approved: "Approved",
  approve: "Approved",
  declined: "Declined",
  decline: "Declined",
  changes_requested: "Changes requested",
  acknowledged: "Acknowledged",
};
const decisionWord = (d: string | null | undefined) =>
  d ? DECISION_WORDS[d] ?? d.replace(/_/g, " ").replace(/^./, (x) => x.toUpperCase()) : "";
const clip = (t: string) => {
  const s = t.replace(/\s+/g, " ").trim();
  return s.length > 160 ? `${s.slice(0, 159).trimEnd()}…` : s;
};
const answerText = (...parts: (string | null | undefined)[]) =>
  clip(parts.filter((p): p is string => Boolean(p && p.trim())).join(". "));

export function reviewStatusLine(r: HasReview): { line: string; waiting: boolean } {
  const answered = Boolean(r.respondedAt) || r.status === "answered";
  if (answered) {
    const text = answerText(decisionWord(r.decision), r.response) || (r.lastOwnerMessage ? clip(r.lastOwnerMessage) : "");
    const day = centralDay(r.respondedAt ?? r.closedAt);
    return { line: `Answered${day ? ` ${day}` : ""}${text ? `: ${text}` : ""}`, waiting: false };
  }
  if (r.status === "closed" || r.closedAt) return { line: `Closed by our team ${centralDay(r.closedAt)}`.trim(), waiting: false };
  return { line: `Waiting on the homeowner since ${centralDay(r.sentAt)}`, waiting: true };
}

export function approvalStatusLine(a: HasApproval): { line: string; waiting: boolean } {
  if (a.status === "pending") return { line: `Waiting on the homeowner since ${centralDay(a.createdAt)}`, waiting: true };
  const text = answerText(decisionWord(a.status), a.decisionNote);
  const day = centralDay(a.decidedAt);
  return { line: `Answered${day ? ` ${day}` : ""}${text ? `: ${text}` : ""}`, waiting: false };
}

/** Every owner item and approval the team sent, newest first. */
export function sentForAnswer(
  reviews: HasReview[],
  approvals: HasApproval[],
  roleOf: (userId: string | null) => string,
): HasSentItem[] {
  const out: HasSentItem[] = [];
  for (const r of reviews) {
    if (UNSENT_REVIEW.has(r.status)) continue;
    const s = reviewStatusLine(r);
    out.push({
      key: `review:${r.id}`,
      title: r.title,
      sentLine: `Sent ${centralDay(r.sentAt)} by ${roleOf(r.sentBy)}`,
      statusLine: s.line,
      waiting: s.waiting,
      sentAt: r.sentAt ?? "",
      files: r.files,
    });
  }
  for (const a of approvals) {
    if (GONE_APPROVAL.has(a.status)) continue;
    const s = approvalStatusLine(a);
    out.push({
      key: `approval:${a.id}`,
      title: a.title,
      sentLine: `Sent ${centralDay(a.createdAt)} by ${roleOf(a.requestedBy)}`,
      statusLine: s.line,
      waiting: s.waiting,
      sentAt: a.createdAt ?? "",
      files: a.files,
    });
  }
  return out.sort((x, y) => y.sentAt.localeCompare(x.sentAt) || x.title.localeCompare(y.title));
}

/* ---------- Task drawer lines ---------- */

/** "This opened the homeowner's card: [title] · [date]", only when finishing the Task opened it. */
export function openedCardLine(
  card: { title: string; unlockedAt: string | null } | null,
  task: { done: boolean; completedAt: string | null },
): string | null {
  if (!card?.unlockedAt || !task.done) return null;
  // A card opened earlier (Unlock now) was not opened by finishing this Task.
  if (task.completedAt && Date.parse(card.unlockedAt) < Date.parse(task.completedAt) - 5 * 60_000) return null;
  return `This opened the homeowner's card: ${card.title} · ${centralDay(card.unlockedAt)}`;
}

/** "Sent to the homeowner [date] · Waiting on their answer" or "Answered [date]: [answer]". */
export function taskSentLine(item: { sentAt: string | null; answered: boolean; answeredAt: string | null; answer: string }): string {
  if (!item.answered) return `Sent to the homeowner ${centralDay(item.sentAt)} · Waiting on their answer`;
  const day = centralDay(item.answeredAt);
  return `Answered${day ? ` ${day}` : ""}${item.answer ? `: ${item.answer}` : ""}`;
}
