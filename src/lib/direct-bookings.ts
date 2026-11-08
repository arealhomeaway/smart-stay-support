/**
 * Direct Bookings: the one rule file for rent, home ordering, the approval
 * period, the reply clock and outcomes. Pure functions only, so every rule is
 * tested without OwnerRez, the mailbox or the database. The database repeats
 * the approval and ownership rules in the staged functions; nothing here is a
 * security boundary on its own.
 */

export const REPLY_TARGET_MINUTES = 3;
export const APPROVAL_WAIT_MINUTES = 2;
export const SEARCH_DISTANCES = [5, 10, 20] as const;
export type SearchDistance = (typeof SEARCH_DISTANCES)[number];
export const MAX_HOMES = 3;
export const MAX_SHORT_STAYS = 2;

export type DirectBookingSettings = {
  approvalStart: string; // YYYY-MM-DD, Central
  approvalEnd: string; // YYYY-MM-DD, inclusive
  requireApprovalAfterEnd: boolean;
  approvalWaitMinutes: number;
  replyTargetMinutes: number;
  /** Flat nightly rate by bedroom count. A missing count means "not set". */
  nightlyRates: Record<string, number>;
  /** Referral sources that get the rent discount, matched by name. */
  discountSources: string[];
  discountPercent: number;
};

export const DEFAULT_SETTINGS: DirectBookingSettings = {
  approvalStart: "2026-11-09",
  approvalEnd: "2026-11-23",
  requireApprovalAfterEnd: false,
  approvalWaitMinutes: APPROVAL_WAIT_MINUTES,
  replyTargetMinutes: REPLY_TARGET_MINUTES,
  nightlyRates: { "3": 189, "4": 199 },
  discountSources: ["MyMetis", "Owl Marketplace", "Travelers Haven"],
  discountPercent: 5,
};

export function readSettings(value: unknown): DirectBookingSettings {
  const v = (value && typeof value === "object" ? value : {}) as Partial<DirectBookingSettings>;
  const rates: Record<string, number> = {};
  const source = v.nightlyRates && typeof v.nightlyRates === "object" ? v.nightlyRates : DEFAULT_SETTINGS.nightlyRates;
  for (const [k, n] of Object.entries(source)) if (typeof n === "number" && n > 0) rates[k] = n;
  return {
    approvalStart: typeof v.approvalStart === "string" ? v.approvalStart : DEFAULT_SETTINGS.approvalStart,
    approvalEnd: typeof v.approvalEnd === "string" ? v.approvalEnd : DEFAULT_SETTINGS.approvalEnd,
    requireApprovalAfterEnd: v.requireApprovalAfterEnd === true,
    approvalWaitMinutes: typeof v.approvalWaitMinutes === "number" ? v.approvalWaitMinutes : APPROVAL_WAIT_MINUTES,
    replyTargetMinutes: typeof v.replyTargetMinutes === "number" ? v.replyTargetMinutes : REPLY_TARGET_MINUTES,
    nightlyRates: rates,
    discountSources: Array.isArray(v.discountSources) ? v.discountSources.filter((s): s is string => typeof s === "string") : DEFAULT_SETTINGS.discountSources,
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

export function sourceDiscountPercent(sourceName: string | null | undefined, settings: DirectBookingSettings) {
  const name = (sourceName ?? "").trim().toLowerCase();
  if (!name) return 0;
  return settings.discountSources.some((s) => s.trim().toLowerCase() === name) ? settings.discountPercent : 0;
}

export type Rent = { ok: true; monthly: number; nightly: number; discountPercent: number } | { ok: false; reason: string };

export const RATE_NOT_SET = "Rate not set. Ask the Operations Supervisor.";

/** monthly = flat nightly x 30, less the source discount, rounded to the nearest $10; nightly shown = monthly / 30. */
export function rentFor(bedrooms: number | null | undefined, sourceName: string | null | undefined, settings: DirectBookingSettings): Rent {
  const flat = bedrooms ? settings.nightlyRates[String(bedrooms)] : undefined;
  if (!flat) return { ok: false, reason: RATE_NOT_SET };
  const discountPercent = sourceDiscountPercent(sourceName, settings);
  const monthly = Math.round((flat * 30 * (1 - discountPercent / 100)) / 10) * 10;
  return { ok: true, monthly, nightly: Math.round((monthly / 30) * 100) / 100, discountPercent };
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

// ============= Clock and status =============

export type RequestState = {
  created_at: string;
  owned_by: string | null;
  reply_sent_at: string | null;
  outcome: string | null;
  pending_approval: boolean;
};

export type RequestStatus = "new" | "working" | "waiting_approval" | "sent" | "booked" | "not_booked";

export function requestStatus(r: RequestState): RequestStatus {
  if (r.outcome === "booked") return "booked";
  if (r.outcome === "not_booked") return "not_booked";
  if (r.reply_sent_at) return "sent";
  if (r.pending_approval) return "waiting_approval";
  return r.owned_by ? "working" : "new";
}

export const STATUS_LABEL: Record<RequestStatus, string> = {
  new: "New",
  working: "In progress",
  waiting_approval: "Waiting for approval",
  sent: "Reply sent",
  booked: "Booked",
  not_booked: "Not booked",
};

/** The clock runs from creation in Resolve until the reply is sent, approval wait included. */
export function replyClock(createdAt: string, replySentAt: string | null, at: Date = new Date(), targetMinutes = REPLY_TARGET_MINUTES) {
  const end = replySentAt ? Date.parse(replySentAt) : at.getTime();
  const seconds = Math.max(0, Math.floor((end - Date.parse(createdAt)) / 1000));
  return { seconds, late: seconds > targetMinutes * 60, stopped: Boolean(replySentAt) };
}

export function clockLabel(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
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

// ============= Reply =============

export type QuoteHome = { name: string; monthly: number; nightly: number; bedrooms: number | null; bathrooms: number | null };
export type QuoteFees = {
  cleaningFee: number | null;
  applicationFee: number | null;
  petFeePerDog: number | null;
  dogs: number;
  deposit: number | null;
};

export function feeLines(fees: QuoteFees): string[] {
  const lines: string[] = [];
  if (fees.cleaningFee != null) lines.push(`Cleaning fee: ${money(fees.cleaningFee)}`);
  if (fees.applicationFee != null) lines.push(`Application fee: ${money(fees.applicationFee)} (one adult required)`);
  if (fees.dogs > 0 && fees.petFeePerDog != null)
    lines.push(`Pet fee: ${money(fees.petFeePerDog)}/dog, ${money(fees.petFeePerDog * fees.dogs)} total`);
  if (fees.deposit != null) lines.push(`Refundable deposit: ${money(fees.deposit)}`);
  return lines;
}

export function homeLines(homes: QuoteHome[]) {
  return homes
    .map((h, i) => {
      const size = [h.bedrooms ? `${h.bedrooms} bed` : null, h.bathrooms ? `${h.bathrooms} bath` : null].filter(Boolean).join(", ");
      return `${i + 1}. ${h.name}${size ? ` (${size})` : ""}: ${money(h.monthly)} a month, ${money(h.nightly)} a night`;
    })
    .join("\n");
}

/** Fills {{key}} placeholders; unknown keys are left blank. */
export function fillTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => values[key] ?? "");
}

export const DEFAULT_REPLY_TEMPLATE =
  "Hello {{contact_name}},\n\nThank you for thinking of A Real Home Away. Here are the homes we can offer for {{dates}}:\n\n{{homes}}\n\n{{fees}}\n\nPlease let us know which home works best, and we will hold it for you.\n\nKind regards,\n{{sender_name}}\nA Real Home Away";

export const DEFAULT_FOLLOW_UP_TEMPLATE =
  "Hello {{contact_name}},\n\nI wanted to follow up on the homes we shared for {{dates}}. They are still available today. Would you like us to hold one for your family?\n\nKind regards,\n{{sender_name}}\nA Real Home Away";

// ============= Words =============

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
};

/**
 * Needs you now for Direct Bookings. Before anyone presses Start, a request
 * shows for everyone it alerted (the alert list is decided once, in the
 * database, by who is on shift). After Start it shows only for the owner,
 * until the reply is sent or an outcome is saved.
 */
export function homeDirectBookings(rows: HomeBookingRow[], alertedIds: Iterable<string>, userId: string) {
  const alerted = new Set(alertedIds);
  const seen = new Set<string>();
  return rows
    .filter((r) => !r.reply_sent_at && !r.outcome)
    .filter((r) => (r.owned_by ? r.owned_by === userId : alerted.has(r.id)))
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((r) => ({ ...r, waitingForStart: !r.owned_by }));
}

export const HOME_BOOKING_COPY = {
  waitingForStart: "New request. Press Start to own it and reply within 3 minutes.",
  started: "Direct booking you started. Reply within 3 minutes.",
} as const;
