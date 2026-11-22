/**
 * Owner updates after closing (Admin, Nov 22): three templated updates replace the Friday weekly
 * update written from the week's Tasks. Pure rules only, shared by the Owner tab, the five-minute job
 * and the tests: the schedule (Closing + 7, 14 and 21 days, 9:00 AM in the home's time zone, weekends
 * and US federal holidays move to the next business day), the stop rule, the wording and the
 * "6 days since the last update" prompt. Writes go through docs/pending/owner-closing-updates.
 */
import { ownerParties } from "@/lib/onboarding-home-page";

export const UPDATE_NUMBERS = [1, 2, 3] as const;
export type UpdateNo = (typeof UPDATE_NUMBERS)[number];

/** Days after the Resolve Closing Date for each update. */
export const UPDATE_OFFSET_DAYS: Record<UpdateNo, number> = { 1: 7, 2: 14, 3: 21 };
/** Send time, in the home's own time zone. */
export const SEND_HOUR = 9;
/** A scheduled update not sent by 5:00 PM on its day is missed and never sent later. */
export const SEND_CUTOFF_HOUR = 17;
/** The prompt shows when the owner has not heard from us for this many days. */
export const QUIET_OWNER_DAYS = 6;

/* ------------------------------------------------------------------ dates */

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** 1 = Monday ... 7 = Sunday. */
export function isoDow(iso: string): number {
  const d = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}
const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
/** The nth weekday (1 = Monday) of a month; n = -1 is the last one. */
function nthWeekday(y: number, m: number, dow: number, n: number): string {
  if (n > 0) {
    let d = ymd(y, m, 1);
    while (isoDow(d) !== dow) d = addDays(d, 1);
    return addDays(d, 7 * (n - 1));
  }
  let d = addDays(ymd(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1), -1);
  while (isoDow(d) !== dow) d = addDays(d, -1);
  return d;
}
/** Fixed-date holidays move to Friday when on a Saturday and to Monday when on a Sunday. */
function observed(iso: string): string {
  const w = isoDow(iso);
  return w === 6 ? addDays(iso, -1) : w === 7 ? addDays(iso, 1) : iso;
}

/** The eleven US federal holidays as observed (OPM rules) that fall in the given year. */
export function usFederalHolidays(year: number): string[] {
  const days = [
    observed(ymd(year, 1, 1)), // New Year's Day
    nthWeekday(year, 1, 1, 3), // Birthday of Martin Luther King, Jr.
    nthWeekday(year, 2, 1, 3), // Washington's Birthday
    nthWeekday(year, 5, 1, -1), // Memorial Day
    observed(ymd(year, 6, 19)), // Juneteenth
    observed(ymd(year, 7, 4)), // Independence Day
    nthWeekday(year, 9, 1, 1), // Labor Day
    nthWeekday(year, 10, 1, 2), // Columbus Day
    observed(ymd(year, 11, 11)), // Veterans Day
    nthWeekday(year, 11, 4, 4), // Thanksgiving Day
    observed(ymd(year, 12, 25)), // Christmas Day
    observed(ymd(year + 1, 1, 1)), // next New Year's Day, observed on Dec 31 when Jan 1 is a Saturday
  ];
  return [...new Set(days.filter((d) => d.startsWith(`${year}-`)))].sort();
}

/** Federal holidays for the years around a date, plus any extra days (the business holidays table). */
export function holidaysAround(iso: string, extra: readonly string[] = []): Set<string> {
  const y = Number(iso.slice(0, 4));
  return new Set([...usFederalHolidays(y - 1), ...usFederalHolidays(y), ...usFederalHolidays(y + 1), ...extra]);
}

export function isBusinessDay(iso: string, holidays: Set<string>): boolean {
  return isoDow(iso) < 6 && !holidays.has(iso);
}
export function onOrNextBusinessDay(iso: string, holidays: Set<string>): string {
  let d = iso;
  while (!isBusinessDay(d, holidays)) d = addDays(d, 1);
  return d;
}
export function previousBusinessDay(iso: string, holidays: Set<string>): string {
  let d = addDays(iso, -1);
  while (!isBusinessDay(d, holidays)) d = addDays(d, -1);
  return d;
}

/* ------------------------------------------------------------------ time zones */

const STATE_ZONE: Record<string, string> = {
  ok: "America/Chicago", oklahoma: "America/Chicago",
  tx: "America/Chicago", texas: "America/Chicago",
  in: "America/Indiana/Indianapolis", indiana: "America/Indiana/Indianapolis",
};

export function validTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The home's own time zone; else its state's; else Central. */
export function homeTimeZone(timeZone: string | null | undefined, state: string | null | undefined): string {
  if (validTimeZone(timeZone?.trim())) return timeZone!.trim();
  return STATE_ZONE[(state ?? "").trim().toLowerCase()] ?? "America/Chicago";
}

function zoneParts(at: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  return { y: Number(p["year"]), m: Number(p["month"]), d: Number(p["day"]), h: Number(p["hour"]), min: Number(p["minute"]), s: Number(p["second"]) };
}

/** The local date and minutes after midnight in a time zone. */
export function localNow(at: Date, tz: string): { date: string; minutes: number } {
  const p = zoneParts(at, tz);
  return { date: ymd(p.y, p.m, p.d), minutes: p.h * 60 + p.min };
}

/** A local wall clock time in a time zone, as a UTC timestamp. */
export function localTimeToUtc(day: string, hour: number, tz: string): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d, hour, 0, 0);
  const offset = (t: number) => {
    const p = zoneParts(new Date(t), tz);
    return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - t;
  };
  let t = guess - offset(guess);
  const again = guess - offset(t);
  if (again !== t) t = again;
  return new Date(t).toISOString();
}

/* ------------------------------------------------------------------ the schedule */

export type HomeFacts = {
  /** Resolve Closing Date: the actual closing date, else the planned one (as on the home's header). */
  closingOn: string | null;
  timeZone: string;
  /** properties.lifecycle_status, onboarding_projects.status and .project_status. */
  lifecycleStatus: string | null;
  projectStatus: string | null;
  notionStatus: string | null;
};

export function resolveClosingDate(actual: string | null | undefined, planned: string | null | undefined, projectPlanned?: string | null): string | null {
  return actual || planned || projectPlanned || null;
}

/**
 * The sequence stops once the home is Live: Operations owns it (lifecycle active_operations), the
 * onboarding project is complete, or its Status is Property Handed Off. Resolve has no Listed status.
 * A contract that fell through, or a cancelled project, also stops it.
 */
export function stopReason(f: Pick<HomeFacts, "lifecycleStatus" | "projectStatus" | "notionStatus">): string | null {
  if (f.lifecycleStatus === "active_operations" || f.projectStatus === "complete" || f.notionStatus === "Property Handed Off") return "The home is Live.";
  if (f.projectStatus === "cancelled" || f.notionStatus === "Contract Fell Through") return "The home is no longer onboarding.";
  return null;
}

export type PlannedSend = { no: UpdateNo; sendOn: string; sendAt: string; previewOn: string; previewAt: string };

/** Closing + 7, 14 and 21 days; weekends and holidays move to the next business day; 9:00 AM local. */
export function plannedSends(closingOn: string, timeZone: string, extraHolidays: readonly string[] = []): PlannedSend[] {
  const holidays = holidaysAround(closingOn, extraHolidays);
  return UPDATE_NUMBERS.map((no) => {
    const sendOn = onOrNextBusinessDay(addDays(closingOn, UPDATE_OFFSET_DAYS[no]), holidays);
    const previewOn = previousBusinessDay(sendOn, holidays);
    return { no, sendOn, sendAt: localTimeToUtc(sendOn, SEND_HOUR, timeZone), previewOn, previewAt: localTimeToUtc(previewOn, SEND_HOUR, timeZone) };
  });
}

export type UpdateStatus = "scheduled" | "held" | "sending" | "sent" | "test_sent" | "missed" | "stopped" | "failed";
/** Statuses the schedule may still move. Everything else is final. */
export const MOVABLE: readonly UpdateStatus[] = ["scheduled", "stopped"];

export type StoredUpdate = { id: string; no: UpdateNo; status: UpdateStatus; closingOn: string; sendOn: string; sendAt: string; reason: string | null };

export type ScheduleChange =
  | { kind: "create"; no: UpdateNo; closingOn: string; sendOn: string; sendAt: string; timeZone: string }
  | { kind: "move"; id: string; no: UpdateNo; closingOn: string; sendOn: string; sendAt: string; timeZone: string; from: string }
  | { kind: "stop"; id: string; no: UpdateNo; reason: string }
  | { kind: "miss"; id: string; no: UpdateNo; reason: string };

/**
 * Brings one home's stored updates in line with its closing date and status. Only sends dated today
 * or later are ever created; a moved date that is already past is missed, never sent late. Held,
 * sent and missed updates never change. Edits stay with their update when its date moves.
 */
export function reconcileHome(input: { facts: HomeFacts; today: string; stored: StoredUpdate[]; extraHolidays?: readonly string[] }): ScheduleChange[] {
  const out: ScheduleChange[] = [];
  const stop = stopReason(input.facts) ?? (input.facts.closingOn ? null : "No closing date.");
  const byNo = new Map(input.stored.map((s) => [s.no, s]));
  if (stop) {
    for (const s of input.stored) if (s.status === "scheduled") out.push({ kind: "stop", id: s.id, no: s.no, reason: stop });
    return out;
  }
  const plan = plannedSends(input.facts.closingOn!, input.facts.timeZone, input.extraHolidays ?? []);
  for (const p of plan) {
    const s = byNo.get(p.no);
    if (!s) {
      if (p.sendOn >= input.today) out.push({ kind: "create", no: p.no, closingOn: input.facts.closingOn!, sendOn: p.sendOn, sendAt: p.sendAt, timeZone: input.facts.timeZone });
      continue;
    }
    if (!MOVABLE.includes(s.status)) continue;
    const same = s.sendOn === p.sendOn && s.sendAt === p.sendAt && s.closingOn === input.facts.closingOn;
    if (p.sendOn < input.today) {
      if (s.status === "scheduled" && !same) out.push({ kind: "miss", id: s.id, no: p.no, reason: "The closing date moved, and this date has already passed." });
      continue;
    }
    if (!same || s.status === "stopped") out.push({ kind: "move", id: s.id, no: p.no, closingOn: input.facts.closingOn!, sendOn: p.sendOn, sendAt: p.sendAt, timeZone: input.facts.timeZone, from: s.sendOn });
  }
  return out;
}

/** Send now, wait, or missed: a scheduled update goes only on its own day, from 9:00 AM until 5:00 PM local. */
export function sendDecision(input: { sendOn: string; sendAt: string; timeZone: string; now: Date }): "wait" | "send" | "missed" {
  if (input.now.getTime() < Date.parse(input.sendAt)) return "wait";
  const local = localNow(input.now, input.timeZone);
  if (local.date !== input.sendOn || local.minutes >= SEND_CUTOFF_HOUR * 60) return "missed";
  return "send";
}

/** The Project Manager preview: from 9:00 AM local on the business day before, until the send. */
export function previewDue(input: { previewAt: string; sendAt: string; now: Date }): boolean {
  const t = input.now.getTime();
  return t >= Date.parse(input.previewAt) && t < Date.parse(input.sendAt);
}

/* ------------------------------------------------------------------ the wording */

export type UpdateMerge = { address: string; nickname: string; ownerFirstNames: string; projectManager: string };

/** {{Property Nickname}}: the nickname without its trailing house number, e.g. "(3400)"; blank uses the address. */
export function ownerNickname(nickname: string | null | undefined, address: string): string {
  const n = (nickname ?? "").replace(/\s*\(\s*\d+\s*\)\s*$/, "").trim();
  return n || address;
}

const COMPANY = /\b(llc|l\.l\.c\.?|inc\.?|corp\.?|corporation|company|group|properties|property|holdings|trust|investments?|investors?|real estate|partners|lp|ltd)\b/i;

/** {{Owner First Names}}: "Rachel and Mike"; a company with no person behind it reads "there". */
export function ownerFirstNames(people: string[], recordName: string | null | undefined): string {
  const parties = ownerParties(people, recordName);
  const names = parties.people.length ? parties.people : recordName && !COMPANY.test(recordName) ? [recordName] : [];
  const seen = new Set<string>();
  const firsts: string[] = [];
  for (const n of names) {
    for (const part of n.split(/\s*(?:&|,|\band\b)\s*/i)) {
      if (!part.trim() || COMPANY.test(part)) continue;
      const first = part.trim().split(/\s+/)[0]!;
      if (seen.has(first.toLowerCase())) continue;
      seen.add(first.toLowerCase());
      firsts.push(first);
    }
  }
  if (!firsts.length) return "there";
  if (firsts.length === 1) return firsts[0]!;
  return `${firsts.slice(0, -1).join(", ")} and ${firsts.at(-1)}`;
}

const TEMPLATES: Record<UpdateNo, { subject: string; body: string }> = {
  1: {
    subject: "Quick update on {{Property Address}}",
    body: [
      "Hi {{Owner First Names}},",
      "I hope you're having a great week! I wanted to give you a quick update on how things are coming along at {{Property Nickname}}.",
      "We've ordered all of the essentials, furniture, and decor, and the first deliveries have already started arriving. More will keep coming over the next several days, and our stager is receiving everything and getting it ready. Utilities are also being fully set up, so the house is running and ready for the work ahead.",
      "Now that the house is empty, we've completed a pre work assessment to make sure common guest risks are handled before the property moves into operations.",
      "Staging begins next week, and we're on track to have the house photographed and ready to list shortly after. I'll keep you posted as everything comes together.",
      "Warmly,\n{{Primary Project Manager}}",
    ].join("\n\n"),
  },
  2: {
    subject: "{{Property Address}} is coming together",
    body: [
      "Hi {{Owner First Names}},",
      "We're in the final stretch of staging, and the house is coming together beautifully. Furniture is going in room by room following the design plan, and the decor, art, and finishing touches are being layered in so every space feels warm, cohesive, and ready for guests.",
      "Photography is on the books, and we're working to get the home guest ready as soon as possible.",
      "We're really excited about how this home is turning out, and we can't wait to show you the final photos!",
      "Best regards,\n{{Primary Project Manager}}",
    ].join("\n\n"),
  },
  3: {
    subject: "Getting {{Property Address}} ready for guests",
    body: [
      "Hi {{Owner First Names}},",
      "I wanted to let you know that we're working with our operations team to review all of the details for your home and prepare its marketing content. As soon as operations confirms the home is fully ready for guests, we'll be in touch with next steps.",
      "If you have any questions at all, please let us know!",
      "Kindly,\n{{Primary Project Manager}}",
    ].join("\n\n"),
  },
};

export function updateTemplate(no: UpdateNo) {
  return TEMPLATES[no];
}

export function renderUpdate(no: UpdateNo, m: UpdateMerge): { subject: string; body: string } {
  const fill = (t: string) =>
    t
      .replaceAll("{{Property Address}}", m.address)
      .replaceAll("{{Property Nickname}}", m.nickname)
      .replaceAll("{{Owner First Names}}", m.ownerFirstNames)
      .replaceAll("{{Primary Project Manager}}", m.projectManager);
  return { subject: fill(TEMPLATES[no].subject), body: fill(TEMPLATES[no].body) };
}

/** The update that matches this home now: the next one not sent yet, else the last one. */
export function matchingUpdate(items: { no: UpdateNo; sendOn: string | null; status: string | null }[], today: string): UpdateNo {
  const open = items.filter((i) => i.sendOn && i.sendOn >= today && !["sent", "test_sent", "held", "missed"].includes(i.status ?? "")).sort((a, b) => a.no - b.no);
  if (open[0]) return open[0].no;
  const past = items.filter((i) => i.sendOn && i.sendOn < today).sort((a, b) => b.no - a.no);
  return past[0]?.no ?? 1;
}

/* ------------------------------------------------------------------ 6 days since the last update */

/** Whole days since the owner last heard from us; null when the prompt should not show. */
export function quietOwnerDays(input: { lastUpdateAt: string | null; startedAt: string | null; now: Date; stopped: boolean }): number | null {
  if (input.stopped) return null;
  const from = input.lastUpdateAt ?? input.startedAt;
  if (!from) return null;
  const days = Math.floor((input.now.getTime() - Date.parse(from)) / 86_400_000);
  return days >= QUIET_OWNER_DAYS ? days : null;
}
