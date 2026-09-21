/**
 * Draft rescue for the email composer.
 *
 * People get pulled away mid-message — a call, another ticket, a closed tab.
 * Whatever they had typed is kept on their own device against the record they
 * were writing about, and offered back the next time they open that record.
 * Nothing is sent, nothing leaves the browser, and a sent message clears it.
 */
import type { MergeValues } from "./email-composer";

export type EmailDraft = {
  recipientKey: string;
  customTo: string;
  templateId: string;
  subject: string;
  body: string;
  audience: string;
  /** What the record filled in when the draft was written. */
  mergeValues: MergeValues;
  savedAt: string;
};

/** Drafts older than this are stale enough that offering them back confuses. */
export const DRAFT_KEEP_DAYS = 7;

export function draftKey(context: string, recordId: string) {
  return `resolve.email-draft.${context}.${recordId}`;
}

/** True when the draft holds something the person would be sorry to lose. */
export function draftIsWorthKeeping(draft: Pick<EmailDraft, "subject" | "body" | "customTo">) {
  return Boolean(draft.subject.trim() || draft.body.trim() || draft.customTo.trim());
}

export function draftIsFresh(draft: Pick<EmailDraft, "savedAt">, now = new Date()) {
  const saved = new Date(draft.savedAt).getTime();
  if (Number.isNaN(saved)) return false;
  const age = now.getTime() - saved;
  return age >= 0 && age <= DRAFT_KEEP_DAYS * 24 * 60 * 60 * 1000;
}

/** Anything unreadable is treated as no draft rather than breaking the screen. */
export function parseDraft(raw: string | null, now = new Date()): EmailDraft | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const d = parsed as Partial<EmailDraft>;
  if (typeof d.subject !== "string" || typeof d.body !== "string") return null;
  const draft: EmailDraft = {
    recipientKey: typeof d.recipientKey === "string" ? d.recipientKey : "",
    customTo: typeof d.customTo === "string" ? d.customTo : "",
    templateId: typeof d.templateId === "string" ? d.templateId : "",
    subject: d.subject,
    body: d.body,
    audience: typeof d.audience === "string" ? d.audience : "guest",
    mergeValues:
      d.mergeValues && typeof d.mergeValues === "object" ? (d.mergeValues as MergeValues) : {},
    savedAt: typeof d.savedAt === "string" ? d.savedAt : "",
  };
  if (!draftIsFresh(draft, now) || !draftIsWorthKeeping(draft)) return null;
  return draft;
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function store(): Store | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function saveDraft(
  context: string,
  recordId: string,
  draft: Omit<EmailDraft, "savedAt">,
  s: Store | null = store(),
) {
  if (!s) return;
  const key = draftKey(context, recordId);
  if (!draftIsWorthKeeping(draft)) {
    s.removeItem(key);
    return;
  }
  try {
    s.setItem(key, JSON.stringify({ ...draft, savedAt: new Date().toISOString() }));
  } catch {
    // A full or blocked storage must never stop someone writing an email.
  }
}

export function loadDraft(context: string, recordId: string, s: Store | null = store()) {
  if (!s) return null;
  try {
    return parseDraft(s.getItem(draftKey(context, recordId)));
  } catch {
    return null;
  }
}

export function clearDraft(context: string, recordId: string, s: Store | null = store()) {
  try {
    s?.removeItem(draftKey(context, recordId));
  } catch {
    // Nothing to do — the draft simply ages out.
  }
}
