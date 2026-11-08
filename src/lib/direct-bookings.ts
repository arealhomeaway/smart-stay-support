/**
 * Direct Bookings: the one rule file for rent, home ordering, the approval
 * period, the reply clock, the follow-up due time, the request views and the
 * reply email. Pure functions only, so every rule is tested without OwnerRez,
 * the mailbox or the database. The database repeats the approval, copy,
 * Active Owner and outcome rules in the staged functions; nothing here is a
 * security boundary on its own.
 */

export const REPLY_TARGET_MINUTES = 3;
export const APPROVAL_WAIT_MINUTES = 2;
export const FOLLOW_UP_HOURS = 48;
export const SEARCH_DISTANCES = [5, 10, 20] as const;
export type SearchDistance = (typeof SEARCH_DISTANCES)[number];
export const DEFAULT_SEARCH_DISTANCE: SearchDistance = 20;
export const MAX_HOMES = 3;
export const MAX_SHORT_STAYS = 2;

/**
 * The referral source records that get the rent discount, by record id
 * (MyMetis / Stay with Oasis, Owl Marketplace, Travelers Haven). Matching the
 * saved record, never a typed name, means a renamed source keeps its discount.
 * The settings row can carry the same list (docs/pending/direct-bookings-fix/05).
 */
export const DISCOUNT_SOURCE_IDS = [
  "a0e95fa9-b49b-4799-84dc-2aa77e30aaad",
  "4154beb4-84bd-4e0c-825b-3aad9d73c632",
  "5056ffce-322d-43e1-888f-c9373550a453",
] as const;

export type DirectBookingSettings = {
  approvalStart: string; // YYYY-MM-DD, Central
  approvalEnd: string; // YYYY-MM-DD, inclusive
  requireApprovalAfterEnd: boolean;
  approvalWaitMinutes: number;
  replyTargetMinutes: number;
  /** Flat nightly rate by bedroom count. A missing count means "not set". */
  nightlyRates: Record<string, number>;
  /** Referral source records (by id) that get the rent discount. */
  discountSourceIds: string[];
  discountPercent: number;
};

export const DEFAULT_SETTINGS: DirectBookingSettings = {
  approvalStart: "2026-11-09",
  approvalEnd: "2026-11-23",
  requireApprovalAfterEnd: false,
  approvalWaitMinutes: APPROVAL_WAIT_MINUTES,
  replyTargetMinutes: REPLY_TARGET_MINUTES,
  nightlyRates: { "3": 189, "4": 199 },
  discountSourceIds: [...DISCOUNT_SOURCE_IDS],
  discountPercent: 5,
};

export function readSettings(value: unknown): DirectBookingSettings {
  const v = (value && typeof value === "object" ? value : {}) as Partial<DirectBookingSettings>;
  const rates: Record<string, number> = {};
  const source = v.nightlyRates && typeof v.nightlyRates === "object" ? v.nightlyRates : DEFAULT_SETTINGS.nightlyRates;
  for (const [k, n] of Object.entries(source)) if (typeof n === "number" && n > 0) rates[k] = n;
  const ids = Array.isArray(v.discountSourceIds) ? v.discountSourceIds.filter((s): s is string => typeof s === "string") : null;
  return {
    approvalStart: typeof v.approvalStart === "string" ? v.approvalStart : DEFAULT_SETTINGS.approvalStart,
    approvalEnd: typeof v.approvalEnd === "string" ? v.approvalEnd : DEFAULT_SETTINGS.approvalEnd,
    requireApprovalAfterEnd: v.requireApprovalAfterEnd === true,
    approvalWaitMinutes: typeof v.approvalWaitMinutes === "number" ? v.approvalWaitMinutes : APPROVAL_WAIT_MINUTES,
    replyTargetMinutes: typeof v.replyTargetMinutes === "number" ? v.replyTargetMinutes : REPLY_TARGET_MINUTES,
    nightlyRates: rates,
    discountSourceIds: ids && ids.length ? ids : [...DEFAULT_SETTINGS.discountSourceIds],
    discountPercent: typeof v.discountPercent === "number" ? v.discountPercent : DEFAULT_SETTINGS.discountPercent,
  };
}

/** Central calendar date for an instant. */
export function centralDate(at: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/**
 * Inside the period: approval always required. After it ends: only when the
 * "Require approval after the period ends" setting is on. Before it starts:
 * the period has not begun, so the same after-period setting applies.
 */
export function approvalRequired(settings: DirectBookingSettings, at: Date = new Date()) {
  const day = centralDate(at);
  if (day >= settings.approvalStart && day <= settings.approvalEnd) return true;
  return settings.requireApprovalAfterEnd;
}

/** The Director may approve once the wait has passed with no answer. */
export function directorMayApprove(requestedAt: string, settings: DirectBookingSettings, at: Date = new Date()) {
  return at.getTime() - Date.parse(requestedAt) >= settings.approvalWaitMinutes * 60_000;
}

// ============= Rent =============

/** The discount for the saved referral source record (by id), or 0. */
export function sourceDiscountPercent(sourceId: string | null | undefined, settings: DirectBookingSettings) {
  if (!sourceId) return 0;
  return settings.discountSourceIds.includes(sourceId) ? settings.discountPercent : 0;
}

export type Rent = { ok: true; monthly: number; nightly: number; discountPercent: number } | { ok: false; reason: string };

export const RATE_NOT_SET = "Rate not set. Ask the Operations Supervisor.";

/**
 * monthly = flat nightly x 30, less the source discount, rounded to the
 * nearest $10; nightly shown = monthly / 30 rounded to the dollar, so the two
 * always agree.
 */
export function rentFor(bedrooms: number | null | undefined, sourceId: string | null | undefined, settings: DirectBookingSettings): Rent {
  const flat = bedrooms ? settings.nightlyRates[String(bedrooms)] : undefined;
  if (!flat) return { ok: false, reason: RATE_NOT_SET };
  const discountPercent = sourceDiscountPercent(sourceId, settings);
  const monthly = Math.round((flat * 30 * (1 - discountPercent / 100)) / 10) * 10;
  return { ok: true, monthly, nightly: Math.round(monthly / 30), discountPercent };
}

export function money(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

// ============= Which homes to offer =============

export type HomeCandidate = {
  id: string;
  /** Raw OwnerRez title (properties.name): carries "30D FIRM" or "7D MAX". */
  title: string;
  bedrooms: number | null;
  bathrooms: number | null;
  maxGuests: number | null;
  distanceMiles: number;
  /** Long stays or blocks in the way: never offered. */
  blocked: boolean;
  shortStays: number;
  petsOk: boolean;
  activeOwner: boolean;
  hasCoordinates?: boolean;
};

export type HomeAsk = {
  minBedrooms: number;
  minBathrooms: number;
  guests: number;
  preferredBedrooms: number | null;
  distance: SearchDistance;
};

export type HomeStep = "firm30" | "free" | "shortStays";

export function isFirm30(title: string) {
  return /30D\s*FIRM/i.test(title);
}
export function isSevenDayMax(title: string) {
  return /7D\s*MAX/i.test(title);
}

/** One Active Owner rule for the search and the send check: in the program, or a 7D MAX home. */
export function isActiveOwnerHome(title: string | null | undefined, inProgram: boolean) {
  return inProgram || isSevenDayMax(title ?? "");
}

/** Why a home is removed, or null when it can be offered. */
export function removalReason(home: HomeCandidate, ask: HomeAsk): string | null {
  if (home.distanceMiles > ask.distance) return "Too far";
  if (home.activeOwner || isSevenDayMax(home.title)) return "Active Owner home";
  if (home.blocked) return "Booked for these dates";
  if (home.shortStays > MAX_SHORT_STAYS) return "Too many short stays";
  if (ask.minBedrooms && (home.bedrooms ?? 0) < ask.minBedrooms) return "Not enough bedrooms";
  if (ask.minBathrooms && (home.bathrooms ?? 0) < ask.minBathrooms) return "Not enough bathrooms";
  if (ask.guests && (home.maxGuests ?? 0) < ask.guests) return "Cannot sleep the party";
  if (!home.petsOk) return "Pet rules do not fit";
  return null;
}

export function stepOf(home: HomeCandidate): HomeStep {
  if (home.shortStays > 0) return "shortStays";
  return isFirm30(home.title) ? "firm30" : "free";
}

const STEP_ORDER: Record<HomeStep, number> = { firm30: 0, free: 1, shortStays: 2 };

export const STEP_TAG: Record<HomeStep, string> = {
  firm30: "Free for 30 days",
  free: "Free",
  shortStays: "Has short stays",
};

/** The tag line on a home card. */
export function homeTag(step: HomeStep, shortStays: number, freeFrom: string | null) {
  if (step === "firm30") return "30-day firm home. Free for the whole stay.";
  if (step === "free") return "Free for the whole stay.";
  const stays = `${shortStays} short stay${shortStays === 1 ? "" : "s"} in the way`;
  return freeFrom ? `${stays}. Free from ${shortDate(freeFrom)}.` : `${stays}.`;
}

/** Filters, then orders: firm 30 days, other free, 1 to 2 short stays; ties by preferred bedrooms then distance. */
export function rankHomes<T extends HomeCandidate>(homes: T[], ask: HomeAsk): T[] {
  const bedroomGap = (h: T) => (ask.preferredBedrooms ? Math.abs((h.bedrooms ?? 0) - ask.preferredBedrooms) : 0);
  return homes
    .filter((h) => removalReason(h, ask) === null)
    .sort(
      (a, b) =>
        STEP_ORDER[stepOf(a)] - STEP_ORDER[stepOf(b)] ||
        bedroomGap(a) - bedroomGap(b) ||
        a.distanceMiles - b.distanceMiles,
    );
}

/** "Show me different homes": the next page, skipping homes already shown. */
export function nextHomes<T extends { id: string }>(ranked: T[], alreadyShown: string[], count = 6): T[] {
  const seen = new Set(alreadyShown);
  return ranked.filter((h) => !seen.has(h.id)).slice(0, count);
}

// ============= Dates =============

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-20" -> "Nov 20, 2026". */
export function longDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
/** "2026-11-20" -> "Nov 20". */
export function shortDate(ymd: string) {
  const [, m, d] = ymd.split("-").map(Number);
  if (!m || !d) return ymd;
  return `${MONTHS[m - 1]} ${d}`;
}

function addDays(ymd: string, days: number) {
  const t = Date.parse(`${ymd}T00:00:00Z`) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}
function addMonths(ymd: string, months: number) {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

/** "3 months", "6 weeks", "45 days", "1 month" -> the move-out date; null when it cannot be read. */
export function moveOutFromLength(moveIn: string, length: string | null | undefined) {
  const m = (length ?? "").trim().toLowerCase().match(/^(\d{1,3})\s*(day|days|week|weeks|month|months)$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!n) return null;
  if (m[2]!.startsWith("month")) return addMonths(moveIn, n);
  return addDays(moveIn, m[2]!.startsWith("week") ? n * 7 : n);
}

/** The stay to search: the typed dates, or today when as soon as possible, and the length when no move-out is typed. */
export function stayDates(
  r: { desired_move_in: string | null; desired_check_out: string | null; asap?: boolean | null; stay_length?: string | null },
  today: string,
) {
  const checkIn = r.desired_move_in || (r.asap ? today : null);
  const checkOut = r.desired_check_out || (checkIn ? moveOutFromLength(checkIn, r.stay_length) : null);
  return { checkIn, checkOut };
}

/** The first day the home is free from the requested start: after any short stay already there. */
export function availableFrom(checkIn: string, shortStays: { arrival: string; departure: string }[]) {
  let free = checkIn;
  for (const s of [...shortStays].sort((a, b) => a.arrival.localeCompare(b.arrival))) {
    if (s.arrival <= free && s.departure > free) free = s.departure;
  }
  return free;
}

// ============= Clock and status =============

export type RequestState = {
  created_at: string;
  owned_by: string | null;
  reply_sent_at: string | null;
  outcome: string | null;
  pending_approval: boolean;
  partner_approved_at?: string | null;
};

export type RequestStatus = "new" | "working" | "waiting_approval" | "sent" | "partner_approved" | "booked" | "not_booked";

export function requestStatus(r: RequestState): RequestStatus {
  if (r.outcome === "booked") return "booked";
  if (r.outcome === "not_booked") return "not_booked";
  if (r.reply_sent_at) return r.partner_approved_at ? "partner_approved" : "sent";
  if (r.pending_approval) return "waiting_approval";
  return r.owned_by ? "working" : "new";
}

/** The clock runs from creation in Resolve until the reply is sent, approval wait included. */
export function replyClock(createdAt: string, replySentAt: string | null, at: Date = new Date(), targetMinutes = REPLY_TARGET_MINUTES) {
  const end = replySentAt ? Date.parse(replySentAt) : at.getTime();
  const seconds = Math.max(0, Math.floor((end - Date.parse(createdAt)) / 1000));
  return { seconds, late: seconds >= targetMinutes * 60, stopped: Boolean(replySentAt) };
}

export function clockLabel(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const minutes = (n: number) => `${n} minute${n === 1 ? "" : "s"}`;

/** When the next follow-up is due: the saved time, or 48 hours after the quote (or the last follow-up). */
export function followUpDueAt(r: { reply_sent_at: string | null; last_follow_up_at?: string | null; follow_up_due_at?: string | null }) {
  if (r.follow_up_due_at) return r.follow_up_due_at;
  const base = r.last_follow_up_at || r.reply_sent_at;
  return base ? new Date(Date.parse(base) + FOLLOW_UP_HOURS * 3_600_000).toISOString() : null;
}

/** A sent quote still waiting on the partner whose follow-up time has come. */
export function followUpDue(
  r: { reply_sent_at: string | null; last_follow_up_at?: string | null; follow_up_due_at?: string | null; outcome: string | null; partner_approved_at?: string | null },
  at: Date = new Date(),
) {
  if (!r.reply_sent_at || r.outcome || r.partner_approved_at) return false;
  const due = followUpDueAt(r);
  return Boolean(due && Date.parse(due) <= at.getTime());
}

export function followUpText(dueAt: string | null, at: Date = new Date()) {
  if (!dueAt) return "Quote sent";
  if (Date.parse(dueAt) <= at.getTime()) return "Quote sent. Follow up now";
  const days = Math.round((Date.parse(`${centralDate(new Date(dueAt))}T00:00:00Z`) - Date.parse(`${centralDate(at)}T00:00:00Z`)) / 86_400_000);
  if (days <= 0) return "Quote sent. Follow up today";
  if (days === 1) return "Quote sent. Follow up tomorrow";
  if (days === 2) return "Quote sent. Follow up in 2 days";
  return `Quote sent. Follow up ${shortDate(centralDate(new Date(dueAt)))}`;
}

export type ChipTone = "progress" | "waiting" | "review" | "escalated" | "resolved" | "closed" | "context" | "brand";

/** The status chip on the list and the request page, with its colour. */
export function statusChip(
  status: RequestStatus,
  r: { created_at: string; reply_sent_at: string | null; last_follow_up_at?: string | null; follow_up_due_at?: string | null },
  at: Date = new Date(),
  targetMinutes = REPLY_TARGET_MINUTES,
): { text: string; tone: ChipTone; late: boolean } {
  if (status === "new" || status === "working") {
    const clock = replyClock(r.created_at, null, at, targetMinutes);
    const m = Math.floor(clock.seconds / 60);
    if (clock.late) return { text: `Waiting ${minutes(m)}. Reply now.`, tone: "escalated", late: true };
    const opened = m === 0 ? "Opened just now." : `Opened ${minutes(m)} ago.`;
    return { text: `${opened} ${minutes(targetMinutes - m)} left.`, tone: "brand", late: false };
  }
  if (status === "waiting_approval") {
    const late = replyClock(r.created_at, null, at, targetMinutes).late;
    return { text: "Waiting for a supervisor", tone: "waiting", late };
  }
  if (status === "sent") {
    const due = followUpDueAt(r);
    const isDue = Boolean(due && Date.parse(due) <= at.getTime());
    return { text: followUpText(due, at), tone: isDue ? "waiting" : "progress", late: false };
  }
  if (status === "partner_approved") return { text: "Approved by the partner", tone: "resolved", late: false };
  if (status === "booked") return { text: "Booked", tone: "resolved", late: false };
  return { text: "Not booked", tone: "closed", late: false };
}

// ============= Views and tiles =============

export type ViewKey = "open" | "partner" | "approved" | "booked" | "not_booked";

export const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "partner", label: "Waiting on the partner" },
  { key: "approved", label: "Approved" },
  { key: "booked", label: "Booked" },
  { key: "not_booked", label: "Not booked" },
];

export function viewOf(status: RequestStatus): ViewKey {
  if (status === "sent") return "partner";
  if (status === "partner_approved") return "approved";
  if (status === "booked") return "booked";
  if (status === "not_booked") return "not_booked";
  return "open";
}

export type BoardRow = {
  status: RequestStatus;
  created_at: string;
  reply_sent_at: string | null;
  last_follow_up_at?: string | null;
  follow_up_due_at?: string | null;
  outcome: string | null;
  partner_approved_at?: string | null;
};

export function viewCounts(rows: BoardRow[]) {
  const counts: Record<ViewKey, number> = { open: 0, partner: 0, approved: 0, booked: 0, not_booked: 0 };
  for (const r of rows) counts[viewOf(r.status)] += 1;
  return counts;
}

/** The three tiles. A tile turns red when a reply in it is past the 3 minutes. */
export function boardTiles(rows: BoardRow[], at: Date = new Date(), targetMinutes = REPLY_TARGET_MINUTES) {
  const late = (r: BoardRow) => replyClock(r.created_at, r.reply_sent_at, at, targetMinutes).late;
  const needs = rows.filter((r) => r.status === "new" || r.status === "working");
  const supervisor = rows.filter((r) => r.status === "waiting_approval");
  const followUps = rows.filter((r) => followUpDue(r, at));
  return [
    { key: "needs", label: "Needs a reply", value: needs.length, red: needs.some(late) },
    { key: "supervisor", label: "Waiting for a supervisor", value: supervisor.length, red: supervisor.some(late) },
    { key: "follow", label: "Follow-ups due", value: followUps.length, red: false },
  ];
}

/**
 * The red strip, for the Operations Supervisor (every waiting quote) and the
 * Director of Operations (quotes past the 2 minute wait, which they may approve).
 */
export function approvalStrip(
  pending: { lead_id: string; requested_at: string }[],
  who: { isSupervisor: boolean; isDirector: boolean },
  settings: DirectBookingSettings,
  at: Date = new Date(),
) {
  const mine = who.isSupervisor ? pending : who.isDirector ? pending.filter((p) => directorMayApprove(p.requested_at, settings, at)) : [];
  if (!mine.length) return null;
  const oldest = [...mine].sort((a, b) => a.requested_at.localeCompare(b.requested_at))[0]!;
  const n = mine.length;
  return { count: n, text: `${n} quote${n === 1 ? " is" : "s are"} waiting for your OK`, openId: oldest.lead_id };
}

// ============= Outcomes =============

export const NOT_BOOKED_REASONS = [
  "Stayed with family",
  "Chose another home",
  "No reply from the partner",
  "Price was too high",
  "No home was available",
  "Other",
] as const;

export function validateNotBooked(reason: string, note: string): string | null {
  if (!(NOT_BOOKED_REASONS as readonly string[]).includes(reason)) return "Choose a reason.";
  if (!note.trim()) return "Add a short note.";
  if (note.length > 500) return "Keep the note short.";
  return null;
}

/** A partner reply that reads like an approval. Only a suggestion: a coordinator confirms it. */
export function looksLikePartnerApproval(text: string | null | undefined) {
  const t = (text ?? "").toLowerCase().replace(/\s+/g, " ");
  if (!t.trim()) return false;
  if (/\b(not|isn'?t|wasn'?t|hasn'?t|haven'?t|never|pending|awaiting|waiting (for|on)|until|once|if|still need)\b[^.?!]{0,30}\bapprov/.test(t)) return false;
  return /\b(approved|has been approved|approval (is|was|has been) (given|granted|received))\b|\bgo ahead\b|\bmove forward\b|\bwe('d| would) like to (book|proceed)\b/.test(t);
}

// ============= Reply =============

/** The two roles always copied. Shown as fixed text; the COO is never copied. */
export const CC_ROLES = ["ops_supervisor", "director_ops"] as const;
export const CC_ROLE_LINE = "Operations Supervisor, Director of Operations";

/**
 * The copy list sent with every reply and follow-up: the email of each person
 * holding the Operations Supervisor or Director of Operations role, and never
 * a COO holder. Nothing typed on screen is used.
 */
export function ccRecipients(holders: { email: string | null; roles: string[] }[]) {
  const out = new Set<string>();
  for (const h of holders) {
    const email = h.email?.trim().toLowerCase();
    if (!email) continue;
    if (h.roles.includes("coo")) continue;
    if (h.roles.some((r) => (CC_ROLES as readonly string[]).includes(r))) out.add(email);
  }
  return [...out].sort();
}

export function firstName(full: string | null | undefined) {
  return (full ?? "").trim().split(/\s+/)[0] ?? "";
}

export type QuoteHome = {
  name: string;
  address: string | null;
  link: string | null;
  distanceMiles: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  /** The text for Availability: a date, or "As soon as possible". */
  availability: string;
  monthly: number;
  nightly: number;
};
export type QuoteFees = {
  cleaningFee: number | null;
  applicationFee: number | null;
  petFeePerDog: number | null;
  dogs: number;
  deposit: number | null;
};

const paid = (n: number | null | undefined): n is number => typeof n === "number" && n > 0;

/** One Time Fees, fixed order, no $0 lines. */
export function feeLines(fees: QuoteFees): string[] {
  const lines: string[] = [];
  if (paid(fees.cleaningFee)) lines.push(`Cleaning fee - ${money(fees.cleaningFee)}`);
  if (paid(fees.applicationFee)) lines.push(`Application fee - ${money(fees.applicationFee)} (one adult required)`);
  if (fees.dogs > 0 && paid(fees.petFeePerDog))
    lines.push(`Pet fee - ${money(fees.petFeePerDog)}/dog${fees.dogs > 1 ? ` (${money(fees.petFeePerDog * fees.dogs)} total)` : ""}`);
  if (paid(fees.deposit)) lines.push(`Refundable deposit - ${money(fees.deposit)}`);
  return lines;
}

export function feesBlock(fees: QuoteFees) {
  const lines = feeLines(fees);
  return lines.length ? ["One Time Fees:", ...lines].join("\n") : "";
}

/** Per home: Address, Property Link, Distance (only when an address was given), Beds, Baths, Availability, Nightly Rate, Monthly Rent. */
export function homeBlock(h: QuoteHome, addressGiven: boolean) {
  const lines = [`Address: ${h.address || h.name}`];
  if (h.link) lines.push(`Property Link: ${h.link}`);
  if (addressGiven && h.distanceMiles != null) lines.push(`Distance to residence address: ${h.distanceMiles} miles`);
  if (h.bedrooms != null) lines.push(`Beds: ${h.bedrooms}`);
  if (h.bathrooms != null) lines.push(`Baths: ${h.bathrooms}`);
  lines.push(`Availability: ${h.availability}`);
  lines.push(`Nightly Rate: ${money(h.nightly)}`);
  lines.push(`Monthly Rent: ${money(h.monthly)}`);
  return lines.join("\n");
}

export function homeLines(homes: QuoteHome[], addressGiven = false) {
  return homes.map((h) => homeBlock(h, addressGiven)).join("\n\n");
}

export function replyIntro(count: number) {
  return count === 1
    ? "Upon reviewing our inventory, we only have this home available as an option."
    : "Here are the homes we can offer:";
}

/** Fills {{key}} placeholders; unknown keys are left blank. Extra blank lines left by empty parts are closed up. */
export function fillTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => values[key] ?? "").replace(/\n{3,}/g, "\n\n");
}

export function replyValues(input: {
  contactName: string | null;
  senderName: string | null;
  subject: string | null;
  dates: string;
  homes: QuoteHome[];
  fees: QuoteFees;
  addressGiven: boolean;
}) {
  return {
    contact_first_name: firstName(input.contactName) || "there",
    contact_name: input.contactName?.trim() || "there",
    intro: replyIntro(input.homes.length),
    homes: homeLines(input.homes, input.addressGiven),
    fees: feesBlock(input.fees),
    sender_first_name: firstName(input.senderName),
    sender_name: input.senderName?.trim() ?? "",
    subject: input.subject?.trim() || "Homes for your stay",
    dates: input.dates || "your dates",
  };
}

export const DEFAULT_REPLY_SUBJECT = "RE: {{subject}}";

/** The approved reply format. The saved template (docs/pending/direct-bookings-fix/04) is the same text. */
export const DEFAULT_REPLY_TEMPLATE =
  "Hello {{contact_first_name}},\n\n{{intro}}\n\n{{homes}}\n\n{{fees}}\n\nPlease let us know if you have any questions.\n\nThank you,\n{{sender_first_name}}\n\nCustomer Service\n3000 E Britton Rd.\nOklahoma City, OK 73131\n405.415.2898 Ext. 0\ninfo@arealhomeaway.com\nwww.arealhomeaway.com";

export const DEFAULT_FOLLOW_UP_TEMPLATE =
  "Hello {{contact_name}},\n\nI wanted to follow up on the homes we shared for {{dates}}. They are still available today. Would you like us to hold one for your family?\n\nKind regards,\n{{sender_name}}\nA Real Home Away";

// ============= Words =============

/** Every fixed sentence on the Direct Bookings screens, in one place. */
export const DB_COPY = {
  subtitle: "Requests from insurance companies and referral partners. Reply to each one within 3 minutes.",
  empty: "Nothing here right now.",
  startQuote: "Start the quote",
  open: "Open",
  back: "← Back to Direct Bookings",
  reviewNow: "Review now",
  someoneElseOwns: "A coordinator already owns this request.",
  ownedByOther: "A coordinator owns this request.",
  coordinatorOnIt: "A coordinator is on it.",
  notOwned: "Nobody owns this request yet. Press Start the quote to make it yours.",
  askedTitle: "1. What they asked for",
  askedHint: "Filled in from their email. Change anything that looks wrong.",
  homesTitle: "2. Pick up to 3 homes",
  searchWithin: "Search within",
  differentHomes: "Show me different homes",
  noHomes: "No homes are free inside this distance. Try a wider distance.",
  mapLegend: "The black dot is the search location",
  replyTitle: "3. The reply",
  replyHint: (partner: string) => `This goes back to ${partner} in the same email thread. It fills in by itself from our reply template. Change the words if you want.`,
  sendForOk: "Send to a supervisor for OK",
  sendReply: "Send reply",
  sendForOkHelp: "A supervisor gets an alert and answers right away. It sends the moment they approve.",
  pickFirst: "Pick at least one home first.",
  approvalTitleSupervisor: "This quote is waiting for your OK",
  approvalTitleOthers: "Waiting for a supervisor",
  approvalSupervisor: "Check the homes and the reply below. The clock is running.",
  approvalOthers: "A supervisor has been alerted and is answering now. If there is no answer in 2 minutes, the director is alerted. It sends the moment they approve.",
  approve: "Approve and send",
  sendBack: "Send back to edit",
  replySent: "Reply sent.",
  lostTitle: "Why was it not booked?",
  lostHint: "A reason is required. We use these to see what we are losing.",
  lostSave: "Save as not booked",
  approvedTitle: "The partner says it is approved.",
  markBooked: "Mark as booked",
  markNotBooked: "Mark as not booked",
  followTitle: "Follow up",
  followHint: `It has been quiet. This goes in the same email thread. Cc: ${CC_ROLE_LINE}`,
  followSend: "Send follow-up",
  partnerApproved: "The partner approved it",
  suggestion: "The partner's reply sounds like an approval.",
  suggestionYes: "Yes, move it to Approved",
  activeOwnerRefused: "A home you picked is in the Active Owner program and cannot be offered. Remove it and pick another home.",
} as const;

/** Words never shown on any Direct Bookings screen. */
export const BANNED_SCREEN_WORDS = [/\bseat\b/i, /\bhit\b/i, /\bmedian\b/i];

/** True when the database does not have a column or function yet (staged change not applied). */
export function isMissingColumn(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return error.code === "42703" || error.code === "PGRST204" || /column .* does not exist|Could not find the .* column/i.test(error.message ?? "");
}

/** A Direct Booking row as Home's Needs you now reads it. */
export type HomeBookingRow = {
  id: string;
  partner_name: string | null;
  company: string | null;
  subject: string | null;
  created_at: string;
  reply_sent_at: string | null;
  owned_by: string | null;
  outcome: string | null;
  last_follow_up_at?: string | null;
  follow_up_due_at?: string | null;
  partner_approved_at?: string | null;
};

/**
 * Needs you now for Direct Bookings. Before anyone presses Start, a request
 * shows for everyone it alerted (the alert list is decided once, in the
 * database, by who is on shift). After Start it shows only for the owner,
 * until the reply is sent or an outcome is saved. A sent quote comes back for
 * its owner only, once its follow-up is due.
 */
export function homeDirectBookings(rows: HomeBookingRow[], alertedIds: Iterable<string>, userId: string, at: Date = new Date()) {
  const alerted = new Set(alertedIds);
  const seen = new Set<string>();
  return rows
    .filter((r) => !r.outcome)
    .filter((r) =>
      r.reply_sent_at
        ? r.owned_by === userId && followUpDue(r, at)
        : r.owned_by
          ? r.owned_by === userId
          : alerted.has(r.id),
    )
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((r) => ({ ...r, waitingForStart: !r.owned_by && !r.reply_sent_at, followUp: Boolean(r.reply_sent_at) }));
}

export const HOME_BOOKING_COPY = {
  waitingForStart: "New request. Press Start to own it and reply within 3 minutes.",
  started: "Direct booking you started. Reply within 3 minutes.",
  followUp: "Follow-up due. Check in with the partner in the same email thread.",
} as const;
