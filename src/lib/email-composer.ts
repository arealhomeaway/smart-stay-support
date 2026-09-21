/**
 * Contextual Email Composer — shared, browser-safe pieces.
 *
 * Templates are written with merge fields in {{double braces}}. The record the
 * employee is looking at supplies the values; anything the record cannot
 * answer stays visible as a blank so nobody sends a half-finished sentence.
 */

export type ComposerContext = "ticket" | "work_order" | "property" | "onboarding_task";
export type MessageAudience = "guest" | "owner" | "vendor" | "staff";

export const CONTEXT_LABELS: Record<ComposerContext, string> = {
  ticket: "Ticket",
  work_order: "Work Order",
  property: "Property",
  onboarding_task: "Onboarding step",
};

export const AUDIENCE_LABELS: Record<MessageAudience, string> = {
  guest: "Guest",
  owner: "Homeowner",
  vendor: "Vendor",
  staff: "Team",
};

/** Every merge field the composer understands, with a plain description. */
export const MERGE_FIELDS: { key: string; describes: string }[] = [
  { key: "property", describes: "Property name" },
  { key: "property_address", describes: "Property address" },
  { key: "guest_name", describes: "Guest on the reservation" },
  { key: "owner_name", describes: "Homeowner" },
  { key: "vendor_name", describes: "Vendor on the job" },
  { key: "ticket_ref", describes: "Ticket number" },
  { key: "ticket_title", describes: "What the ticket is about" },
  { key: "work_order_title", describes: "Work Order title" },
  { key: "scheduled_for", describes: "Scheduled date and time" },
  { key: "task_title", describes: "Onboarding step" },
  { key: "task_due", describes: "Date the step is due" },
  { key: "sender_name", describes: "Your name" },
];

/**
 * Details a homeowner message needs before it goes out. A blank homeowner or
 * home in the message is how the wrong person gets the wrong letter, so it is
 * stopped here rather than explained afterwards.
 */
export function missingOwnerDetails(
  values: MergeValues,
  audience: MessageAudience | null,
): string[] {
  const gaps: string[] = [];
  const blank = (key: string) => {
    const v = values[key];
    return v == null || String(v).trim() === "";
  };
  if (blank("property")) gaps.push("This record has no home on it.");
  if (audience === "owner") {
    if (blank("owner_name")) gaps.push("No homeowner name is on file for this home.");
    if (blank("property_address")) gaps.push("No address is on file for this home.");
  }
  return gaps;
}

export type MergeValues = Record<string, string | null | undefined>;

const FIELD_RE = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

/** Fills a template with what the record knows. Unknown values stay blank. */
export function applyMergeFields(text: string, values: MergeValues) {
  return text.replace(FIELD_RE, (_match, key: string) => {
    const value = values[key.toLowerCase()];
    return value == null || value === "" ? "" : String(value);
  });
}

/** Merge fields in a template that this record cannot fill in. */
export function unresolvedFields(text: string, values: MergeValues) {
  const missing = new Set<string>();
  for (const match of text.matchAll(FIELD_RE)) {
    const key = (match[1] ?? "").toLowerCase();
    const value = values[key];
    if (value == null || value === "") missing.add(key);
  }
  return [...missing];
}

export type ComposerDraft = { to: string; subject: string; body: string };

/**
 * What still needs fixing, said against the box it belongs to, so the person
 * sees the problem where they can fix it rather than in a list underneath.
 */
export function draftFieldProblems(draft: ComposerDraft) {
  const blanks = [...new Set([...draft.subject.matchAll(FIELD_RE), ...draft.body.matchAll(FIELD_RE)]
    .map((m) => (m[1] ?? "").toLowerCase()))];
  const left = (text: string) =>
    /\{\{\s*[a-z0-9_]+\s*\}\}/i.test(text)
      ? "Fill in the blanks the template left behind."
      : null;
  return {
    to: !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(draft.to.trim())
      ? "Choose a contact or type a valid email address."
      : null,
    subject:
      draft.subject.trim().length < 3
        ? "Give the message a subject line."
        : left(draft.subject),
    body: draft.body.trim().length < 10 ? "Write the message." : left(draft.body),
    unfilled: blanks,
  };
}

/**
 * The one rule the Send button obeys: every blocker in one place, so the
 * button, the preview and the messages under each box can never disagree.
 */
export function sendGate(
  draft: ComposerDraft,
  values: MergeValues,
  audience: MessageAudience | null,
) {
  const fields = draftFieldProblems(draft);
  const blockers = [
    ...[fields.to, fields.subject, fields.body].filter((p): p is string => p !== null),
    ...missingOwnerDetails(values, audience),
  ];
  return { fields, blockers, canSend: blockers.length === 0 };
}

/** What still needs fixing before this message can go out. */
export function draftProblems(draft: ComposerDraft) {
  const f = draftFieldProblems(draft);
  return [f.to, f.subject, f.body].filter((p): p is string => p !== null);
}

/* ------------------------------------------------------------------ *
 * Recipients: To, Cc and Bcc as removable chips.
 * ------------------------------------------------------------------ */

export type RecipientField = "to" | "cc" | "bcc";
export type RecipientLists = Record<RecipientField, string[]>;

export const EMPTY_RECIPIENTS: RecipientLists = { to: [], cc: [], bcc: [] };

export const RECIPIENT_FIELD_LABELS: Record<RecipientField, string> = {
  to: "To",
  cc: "Cc",
  bcc: "Bcc",
};

export function isEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value.trim());
}

/** One person, one line — the same address twice is always a mistake. */
export function findRecipient(lists: RecipientLists, address: string): RecipientField | null {
  const needle = address.trim().toLowerCase();
  for (const field of ["to", "cc", "bcc"] as RecipientField[]) {
    if (lists[field].some((a) => a.toLowerCase() === needle)) return field;
  }
  return null;
}

/**
 * Adds one or several pasted addresses. A bad address or one already on the
 * message is reported back rather than quietly dropped.
 */
export function addRecipients(
  lists: RecipientLists,
  field: RecipientField,
  raw: string,
): { lists: RecipientLists; added: string[]; errors: string[] } {
  const pieces = raw
    .split(/[,;\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const next: RecipientLists = { to: [...lists.to], cc: [...lists.cc], bcc: [...lists.bcc] };
  const added: string[] = [];
  const errors: string[] = [];
  for (const piece of pieces) {
    if (!isEmailAddress(piece)) {
      errors.push(`${piece} is not a valid email address.`);
      continue;
    }
    const existing = findRecipient(next, piece);
    if (existing) {
      errors.push(`${piece} is already on this message under ${RECIPIENT_FIELD_LABELS[existing]}.`);
      continue;
    }
    next[field].push(piece.trim());
    added.push(piece.trim());
  }
  return { lists: next, added, errors };
}

export function removeRecipient(
  lists: RecipientLists,
  field: RecipientField,
  address: string,
): RecipientLists {
  const needle = address.trim().toLowerCase();
  return {
    ...lists,
    [field]: lists[field].filter((a) => a.toLowerCase() !== needle),
  };
}

/** What stops the message going out, said in terms of the recipient boxes. */
export function recipientProblems(lists: RecipientLists): string[] {
  const problems: string[] = [];
  if (lists.to.length === 0) problems.push("Add at least one recipient in To.");
  const bad = [...lists.to, ...lists.cc, ...lists.bcc].filter((a) => !isEmailAddress(a));
  for (const a of bad) problems.push(`${a} is not a valid email address.`);
  return problems;
}

/* ------------------------------------------------------------------ *
 * Scheduled sending — the time the person picked, in the place they mean.
 * ------------------------------------------------------------------ */

export type ScheduleDraft = { date: string; time: string; timeZone: string };

/** Common working time zones, ARHA's own first. */
export const SEND_TIME_ZONES = [
  "America/Chicago",
  "America/New_York",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "UTC",
];

/** The offset a zone is at for a given instant, in minutes. */
function zoneOffsetMinutes(timeZone: string, at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return (asUtc - at.getTime()) / 60000;
}

/**
 * Turns "September 22, 9:00 AM, America/Chicago" into the exact instant,
 * so a message scheduled for 9 a.m. Central arrives at 9 a.m. Central
 * whatever the sender's own clock says.
 */
export function zonedToInstant(draft: ScheduleDraft): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || !/^\d{2}:\d{2}$/.test(draft.time)) return null;
  const [y, m, d] = draft.date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = draft.time.split(":").map(Number) as [number, number];
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  let guess = new Date(naive);
  for (let i = 0; i < 2; i += 1) {
    const offset = zoneOffsetMinutes(draft.timeZone, guess);
    guess = new Date(naive - offset * 60000);
  }
  return Number.isNaN(guess.getTime()) ? null : guess;
}

/** Scheduling problems, in the same voice as every other composer check. */
export function scheduleProblems(draft: ScheduleDraft, now = new Date()): string[] {
  const problems: string[] = [];
  if (!draft.date) problems.push("Pick the date this should go out.");
  if (!draft.time) problems.push("Pick the time this should go out.");
  if (!draft.timeZone) problems.push("Pick the time zone this time is in.");
  if (problems.length > 0) return problems;
  const instant = zonedToInstant(draft);
  if (!instant) return ["That date and time could not be read."];
  if (instant.getTime() <= now.getTime()) problems.push("Pick a time in the future.");
  return problems;
}
