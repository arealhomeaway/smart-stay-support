/**
 * Homeowner status on the team's own screens (approved by the Admin, Nov 16): the chip on a Task
 * row in My Tasks, the "My homeowners" lists and the homeowner rows in Needs you now. Pure and
 * browser-safe, read only. Every reading reuses "What the homeowner has" (src/lib/homeowner-has.ts):
 * the same card placement, the same answered and waiting lines, the same "opened by this Task"
 * rule, so every screen gives the same answer. No card rule, unlock, deadline or notice here.
 */
import {
  approvalStatusLine,
  cardPlacement,
  centralDay,
  centralDayTime,
  openedCardLine,
  reviewStatusLine,
  type HasApproval,
  type HasPlanCard,
  type HasReview,
} from "@/lib/homeowner-has";

export const STATUS_COPY = {
  myHomeowners: "My homeowners",
  waiting: "Waiting on the homeowner",
  answered: "Homeowner answered or finished",
  empty: "Nothing waiting on a homeowner.",
  noneAnswered: "No answers in the last 7 days.",
  needsAnswered: "Homeowner answered",
  needsOverdue: "Homeowner overdue",
  failed: "Homeowner status could not load. Try again in a minute.",
} as const;

/** Answers and finished cards count as recent for this many days. */
export const RECENT_DAYS = 7;

export type StatusCard = HasPlanCard & { linkedTaskId: string | null; ownerNeeded: boolean };
export type StatusReview = HasReview & { propertyId: string | null; taskId: string | null };
export type StatusApproval = HasApproval & { propertyId: string | null; taskId: string | null };

export type HomeownerStatusData = {
  cards: StatusCard[];
  /** Owner items the team sent; items a plan card created are not here (they show as the card). */
  reviews: StatusReview[];
  /** Owner items a plan card created, by id: only to read the homeowner's answer on that card. */
  cardReviews: Record<string, StatusReview>;
  approvals: StatusApproval[];
  planOn: Record<string, boolean>;
  homeLabels: Record<string, string>;
};

const DAY = 24 * 60 * 60 * 1000;

/** The Central calendar day of a time, as YYYY-MM-DD. */
export function centralKey(value: string | number | Date): string {
  const t = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
  return parts;
}

/** Whole Central calendar days from a time to now (0 on the same day). */
export function daysWaiting(since: string | null | undefined, now: Date): number {
  if (!since || Number.isNaN(Date.parse(since))) return 0;
  const a = Date.parse(`${centralKey(since)}T12:00:00Z`);
  const b = Date.parse(`${centralKey(now)}T12:00:00Z`);
  return Math.max(0, Math.round((b - a) / DAY));
}
const dayWord = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

/** An owner_needed card the homeowner still has open (shown to them as needing their answer or open). */
export function cardStillWaiting(c: StatusCard, planOn: boolean): boolean {
  if (!c.ownerNeeded) return false;
  const g = cardPlacement(c, { planOn, minutes: 0 }).group;
  return g === "answer" || g === "open";
}

/** An owner_needed card past its due time that the homeowner has not done. */
export function cardOverdue(c: StatusCard, planOn: boolean, now: Date): boolean {
  if (!c.deadlineAt || !cardStillWaiting(c, planOn)) return false;
  return cardPlacement(c, { planOn, minutes: 0 }).group === "answer" && Date.parse(c.deadlineAt) < now.getTime();
}

const cardDone = (c: StatusCard, planOn: boolean) => cardPlacement(c, { planOn, minutes: 0 }).group === "done";
const reviewAnswered = (r: StatusReview) => Boolean(r.respondedAt) || r.status === "answered";
const reviewWaiting = (r: StatusReview) => reviewStatusLine(r).waiting;
const approvalWaiting = (a: StatusApproval) => approvalStatusLine(a).waiting;
const reviewAnsweredAt = (r: StatusReview) => r.respondedAt ?? r.closedAt ?? null;

export type ChipKind = "overdue" | "waiting" | "answered" | "opened";
export type HomeownerChip = { kind: ChipKind; text: string };

/**
 * The one chip a Task row shows. Most urgent first: overdue, waiting, answered, then a card the
 * Task opened. Null when nothing ties the Task to the homeowner.
 */
export function taskChip(
  task: { id: string; done: boolean; completedAt: string | null },
  data: HomeownerStatusData,
  now: Date,
): HomeownerChip | null {
  const cards = data.cards.filter((c) => c.linkedTaskId === task.id);
  const on = (c: StatusCard) => data.planOn[c.propertyId] ?? false;
  const reviews = data.reviews.filter((r) => r.taskId === task.id);
  const approvals = data.approvals.filter((a) => a.taskId === task.id);

  const overdue = cards.filter((c) => cardOverdue(c, on(c), now)).sort((a, b) => (a.deadlineAt ?? "").localeCompare(b.deadlineAt ?? ""))[0];
  if (overdue?.deadlineAt) return { kind: "overdue", text: `Homeowner overdue · due ${centralDay(overdue.deadlineAt)}` };

  const waitingSince = [
    ...cards.filter((c) => cardStillWaiting(c, on(c))).map((c) => c.unlockedAt),
    ...reviews.filter(reviewWaiting).map((r) => r.sentAt),
    ...approvals.filter(approvalWaiting).map((a) => a.createdAt),
  ].filter((v): v is string => Boolean(v)).sort()[0];
  if (waitingSince) return { kind: "waiting", text: `Waiting on homeowner · ${dayWord(daysWaiting(waitingSince, now))}` };

  const answeredAt = [
    ...cards.filter((c) => cardDone(c, on(c))).map((c) => c.ownerCompletedAt),
    ...reviews.filter(reviewAnswered).map(reviewAnsweredAt),
    ...approvals.filter((a) => !approvalWaiting(a)).map((a) => a.decidedAt),
  ].filter((v): v is string => Boolean(v)).sort().at(-1);
  if (answeredAt) return { kind: "answered", text: `Homeowner answered ${centralDay(answeredAt)}` };

  // Same rule as the Task drawer: only a card that finishing this Task opened.
  const opened = cards
    .filter((c) => openedCardLine({ title: c.title, unlockedAt: c.unlockedAt }, task))
    .map((c) => c.unlockedAt as string)
    .sort()[0];
  if (opened) return { kind: "opened", text: `Owner card opened ${centralDay(opened)}` };
  return null;
}

export type StatusRow = {
  key: string;
  propertyId: string;
  home: string;
  title: string;
  line: string;
  overdue: boolean;
  taskId: string | null;
  at: string;
  /** Files the homeowner sent with a card answer. */
  files?: HasFile[];
};

const homeOf = (data: HomeownerStatusData, id: string) => data.homeLabels[id] ?? "Home";

/** "Waiting on the homeowner": overdue first, then newest first. */
export function waitingRows(data: HomeownerStatusData, homes: ReadonlySet<string>, now: Date): StatusRow[] {
  const out: StatusRow[] = [];
  for (const c of data.cards) {
    if (!homes.has(c.propertyId)) continue;
    const on = data.planOn[c.propertyId] ?? false;
    if (!cardStillWaiting(c, on)) continue;
    const overdue = cardOverdue(c, on, now);
    const waited = `waiting ${dayWord(daysWaiting(c.unlockedAt, now))}`;
    const due = c.deadlineAt ? `due ${centralDayTime(c.deadlineAt)} Central` : "";
    out.push({
      key: `card:${c.id}`,
      propertyId: c.propertyId,
      home: homeOf(data, c.propertyId),
      title: c.title,
      line: overdue ? `Overdue · ${due} · ${waited}` : [cap(waited), due].filter(Boolean).join(" · "),
      overdue,
      taskId: c.linkedTaskId,
      at: c.unlockedAt ?? "",
    });
  }
  for (const r of data.reviews) {
    if (!r.propertyId || !homes.has(r.propertyId) || !reviewWaiting(r)) continue;
    out.push({ key: `review:${r.id}`, propertyId: r.propertyId, home: homeOf(data, r.propertyId), title: r.title, line: `Sent ${centralDay(r.sentAt)} · waiting ${dayWord(daysWaiting(r.sentAt, now))}`, overdue: false, taskId: r.taskId, at: r.sentAt ?? "" });
  }
  for (const a of data.approvals) {
    if (!a.propertyId || !homes.has(a.propertyId) || !approvalWaiting(a)) continue;
    out.push({ key: `approval:${a.id}`, propertyId: a.propertyId, home: homeOf(data, a.propertyId), title: a.title, line: `Sent ${centralDay(a.createdAt)} · waiting ${dayWord(daysWaiting(a.createdAt, now))}`, overdue: false, taskId: a.taskId, at: a.createdAt ?? "" });
  }
  return out.sort((x, y) => Number(y.overdue) - Number(x.overdue) || y.at.localeCompare(x.at) || x.title.localeCompare(y.title));
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const recent = (at: string | null | undefined, now: Date) =>
  Boolean(at) && Date.parse(at as string) >= now.getTime() - RECENT_DAYS * DAY && Date.parse(at as string) <= now.getTime() + DAY;

/** "Homeowner answered or finished": the last 7 days, newest first, with the answer. */
export function answeredRows(data: HomeownerStatusData, homes: ReadonlySet<string>, now: Date): StatusRow[] {
  const out: StatusRow[] = [];
  for (const c of data.cards) {
    if (!homes.has(c.propertyId) || !cardDone(c, data.planOn[c.propertyId] ?? false) || !recent(c.ownerCompletedAt, now)) continue;
    const r = c.ownerReviewId ? data.cardReviews[c.ownerReviewId] : undefined;
    const answer = r && reviewAnswered(r) ? reviewStatusLine(r).line : "";
    // What she sent on the card itself, when the reader may see it.
    const sent = submissionSummary(c.outputFields, c.submission);
    const files = c.submission?.files ?? [];
    out.push({
      key: `card:${c.id}`,
      propertyId: c.propertyId,
      home: homeOf(data, c.propertyId),
      title: c.title,
      line: sent
        ? `Answered ${centralDay(c.ownerCompletedAt)}: ${sent}`
        : answer.includes(":") ? answer : `Finished ${centralDay(c.ownerCompletedAt)}`,
      overdue: false,
      taskId: c.linkedTaskId,
      at: c.ownerCompletedAt ?? "",
      ...(files.length ? { files } : {}),
    });
  }
  for (const r of data.reviews) {
    if (!r.propertyId || !homes.has(r.propertyId) || !reviewAnswered(r) || !recent(reviewAnsweredAt(r), now)) continue;
    out.push({ key: `review:${r.id}`, propertyId: r.propertyId, home: homeOf(data, r.propertyId), title: r.title, line: reviewStatusLine(r).line, overdue: false, taskId: r.taskId, at: reviewAnsweredAt(r) ?? "" });
  }
  for (const a of data.approvals) {
    if (!a.propertyId || !homes.has(a.propertyId) || approvalWaiting(a) || !recent(a.decidedAt, now)) continue;
    out.push({ key: `approval:${a.id}`, propertyId: a.propertyId, home: homeOf(data, a.propertyId), title: a.title, line: approvalStatusLine(a).line, overdue: false, taskId: a.taskId, at: a.decidedAt ?? "" });
  }
  return out.sort((x, y) => y.at.localeCompare(x.at) || x.title.localeCompare(y.title));
}

/** Needs you now: overdue items, then recent answers, each naming the home. */
export function needsRows(data: HomeownerStatusData, homes: ReadonlySet<string>, now: Date): (StatusRow & { kind: "overdue" | "answered" })[] {
  return [
    ...waitingRows(data, homes, now).filter((r) => r.overdue).map((r) => ({ ...r, kind: "overdue" as const })),
    ...answeredRows(data, homes, now).map((r) => ({ ...r, kind: "answered" as const })),
  ];
}

/**
 * The homes "My homeowners" covers for one person: homes they are Project Manager on, homes where
 * they have an open Task, or every home for the Director of Onboarding and Admin.
 */
export function myHomeownerHomes(input: {
  person: string | null;
  allHomes: boolean;
  projects: { property_id: string; project_manager: string | null; status: string }[];
  tasks: { property_id: string; assigned_to: string | null; status: string; archived_at?: string | null }[];
}): Set<string> {
  const live = input.projects.filter((p) => p.status !== "cancelled");
  if (input.allHomes) return new Set(live.map((p) => p.property_id));
  const out = new Set<string>();
  if (!input.person) return out;
  for (const p of live) if (p.project_manager === input.person) out.add(p.property_id);
  for (const t of input.tasks)
    if (t.assigned_to === input.person && t.status !== "complete" && !t.archived_at) out.add(t.property_id);
  return out;
}

/** Handed off: the home's latest onboarding project was accepted by Operations, or is finished. */
export function handedOffHomes(projects: { property_id: string; status: string; ops_accepted_at: string | null; created_at: string }[]): Set<string> {
  const latest = new Map<string, (typeof projects)[number]>();
  for (const p of projects) {
    const cur = latest.get(p.property_id);
    if (!cur || p.created_at > cur.created_at) latest.set(p.property_id, p);
  }
  return new Set(
    [...latest.values()].filter((p) => p.ops_accepted_at || ["complete", "completed", "archived"].includes(p.status)).map((p) => p.property_id),
  );
}
