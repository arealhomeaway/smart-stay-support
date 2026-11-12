/**
 * The homeowner's one Opportunities page: which group every owner item sits in,
 * the corner chip it shows, the order inside each group, and the home tabs.
 *
 * Pure and browser-safe. Presentation only: no item's status, deadline or
 * access changes here. Each source keeps its own canonical record and actions.
 */

export type BoardSource = "work" | "review" | "plan" | "approval" | "action" | "template";
export type BoardGroup = "answer" | "ready" | "optional" | "soon" | "done";

export type BoardItem = {
  /** Unique across sources, e.g. "plan:<id>". */
  key: string;
  source: BoardSource;
  /** The id the source's own panel opens. */
  id: string;
  title: string;
  /** Homes it belongs to; empty means every home in the program. */
  propertyIds: string[];
  /** A market card answered once for every home. */
  allHomes?: boolean;
  /** "Onboarding Team", "Operations Team", "Your homeowner plan", "Optional"… */
  from: string;
  summary: string;
  cover: string;
  /** When it was sent (ISO or YYYY-MM-DD). */
  sentAt: string | null;
  /** The owner's answer-by date (YYYY-MM-DD). */
  answerBy: string | null;
  /** The work deadline used to order Ready for you (YYYY-MM-DD or ISO). */
  deadline: string | null;
  /** Waiting on an owner decision or reply. */
  needsAnswer: boolean;
  /** ARHA wrote last in the conversation. */
  newReply: boolean;
  /** An anytime plan card or an optional library card. */
  optional: boolean;
  locked: boolean;
  finished: boolean;
  opensText?: string | null;
};

/** Where an item sits on the page. One rule for every source. */
export function boardGroup(i: Pick<BoardItem, "finished" | "locked" | "needsAnswer" | "newReply" | "optional">): BoardGroup {
  if (i.finished) return "done";
  if (i.locked) return "soon";
  if (i.needsAnswer || i.newReply) return "answer";
  if (i.optional) return "optional";
  return "ready";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Nov 14" from YYYY-MM-DD (or an ISO time, read as its Central day). */
export function shortDate(value: string | null | undefined): string {
  const ymd = toCentralDay(value);
  if (!ymd) return "";
  const [, m, d] = ymd.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}`;
}

/** YYYY-MM-DD of a date or ISO time, in Central time. */
export function toCentralDay(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const t = new Date(value);
  if (Number.isNaN(t.getTime())) return null;
  return t.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

/** Today in Central time, YYYY-MM-DD. */
export function centralToday(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

function dayDiff(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

export type AnswerChip = { text: string; overdue: boolean };

/** The corner chip on a Needs your answer card. */
export function answerChip(i: Pick<BoardItem, "answerBy" | "newReply">, today: string): AnswerChip {
  const by = toCentralDay(i.answerBy);
  if (by && by < today) return { text: `Overdue since ${shortDate(by)}`, overdue: true };
  if (by && i.newReply) return { text: `New reply · answer by ${shortDate(by)}`, overdue: false };
  if (by) {
    const left = dayDiff(today, by);
    return { text: `Due ${shortDate(by)} · ${left === 0 ? "due today" : `${left} day${left === 1 ? "" : "s"} left`}`, overdue: false };
  }
  return { text: "Waiting on you", overdue: false };
}

const FAR = "9999-12-31";
const byDay = (v: string | null) => toCentralDay(v) ?? FAR;

/** Needs your answer: overdue first, then the nearest answer-by date; undated last. */
export function sortAnswer<T extends Pick<BoardItem, "answerBy" | "title">>(items: T[]): T[] {
  return [...items].sort((a, b) => byDay(a.answerBy).localeCompare(byDay(b.answerBy)) || a.title.localeCompare(b.title));
}

/** Ready for you: nearest deadline first; undated last. */
export function sortReady<T extends Pick<BoardItem, "deadline" | "answerBy" | "title">>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => byDay(a.deadline ?? a.answerBy).localeCompare(byDay(b.deadline ?? b.answerBy)) || a.title.localeCompare(b.title),
  );
}

/** Ready for you shows this many before "Show {n} more here". */
export const READY_VISIBLE = 4;
/** The portal home page shows this many Ready for you cards. */
export const HOME_READY_VISIBLE = 3;

export function inHome(i: Pick<BoardItem, "propertyIds">, homeId: string): boolean {
  return i.propertyIds.length === 0 || i.propertyIds.includes(homeId);
}

export type BoardView = { answer: BoardItem[]; ready: BoardItem[]; optional: BoardItem[]; soon: BoardItem[]; done: BoardItem[] };

/**
 * The page for one tab. `homeId` null = a one-home owner (everything);
 * "all" = All homes: just what needs you (Needs your answer only, every home).
 */
export function boardView(items: BoardItem[], homeId: string | "all" | null): BoardView {
  const view: BoardView = { answer: [], ready: [], optional: [], soon: [], done: [] };
  for (const i of items) {
    const g = boardGroup(i);
    if (homeId === "all") {
      if (g === "answer") view.answer.push(i);
      continue;
    }
    if (homeId && !inHome(i, homeId)) continue;
    view[g].push(i);
  }
  view.answer = sortAnswer(view.answer);
  view.ready = sortReady(view.ready);
  view.soon = sortReady(view.soon);
  return view;
}

/** "{n} need you" per home: the Needs your answer count on that home's tab. */
export function needYouCount(items: BoardItem[], homeId: string): number {
  return items.filter((i) => boardGroup(i) === "answer" && inHome(i, homeId)).length;
}

export function needYouLabel(n: number): string {
  return `${n} need${n === 1 ? "s" : ""} you`;
}

/** The page opens on the home with the most urgent item: overdue, then the nearest answer-by, then the most items. */
export function mostUrgentHome(items: BoardItem[], homeIds: string[], today: string): string | null {
  let best: { id: string; rank: [number, string, number] } | null = null;
  for (const id of homeIds) {
    const mine = items.filter((i) => boardGroup(i) === "answer" && inHome(i, id));
    const nearest = sortAnswer(mine)[0]?.answerBy ?? null;
    const day = byDay(nearest);
    const rank: [number, string, number] = [day < today ? 0 : 1, day, -mine.length];
    if (
      !best ||
      rank[0] < best.rank[0] ||
      (rank[0] === best.rank[0] && (rank[1] < best.rank[1] || (rank[1] === best.rank[1] && rank[2] < best.rank[2])))
    )
      best = { id, rank };
  }
  return best?.id ?? homeIds[0] ?? null;
}

/**
 * Market cards show once per owner: copies of the same card on several homes
 * become one item labelled "All your homes". The open copy is the one answered;
 * the database completes every home's copy at once.
 */
export function mergeOncePerOwner<T extends BoardItem & { cardCode?: string | null; oncePerOwner?: boolean }>(items: T[]): T[] {
  const out: T[] = [];
  const merged = new Map<string, T>();
  for (const i of items) {
    if (!i.oncePerOwner || !i.cardCode) {
      out.push(i);
      continue;
    }
    const k = `${i.cardCode}:${i.finished ? "done" : i.locked ? "soon" : "open"}`;
    const prior = merged.get(k);
    if (!prior) {
      const copy = { ...i, allHomes: true, propertyIds: [...i.propertyIds] };
      merged.set(k, copy);
      out.push(copy);
    } else {
      for (const p of i.propertyIds) if (!prior.propertyIds.includes(p)) prior.propertyIds.push(p);
    }
  }
  return out;
}

/** A plan card is optional (anytime) by its card's stage window; older readers fall back to its lane. */
export function planCardOptional(c: { stage_window?: string | null; lane?: string | null }): boolean {
  if (c.stage_window) return c.stage_window === "anytime";
  return c.lane === "flexible";
}

/** The "home · source" line under a card title. */
export function sourceLine(i: Pick<BoardItem, "allHomes" | "propertyIds" | "from">, homeName: (id: string) => string | null, multiHome: boolean): string {
  const home = i.allHomes
    ? "All your homes"
    : i.propertyIds.length === 0
      ? multiHome ? "All your homes" : ""
      : i.propertyIds.map(homeName).filter(Boolean).join(" · ");
  return [home, i.from].filter(Boolean).join(" · ");
}
