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
