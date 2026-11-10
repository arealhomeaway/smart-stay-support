/**
 * Portal requests (Emily, Nov 9, register D8). Owl Marketplace, ReloQuest,
 * Travelers Haven and Realto requests are answered by email and in the
 * partner's own portal. Pure rules only, shared by intake, the server actions
 * and the request page:
 * - the partner portal link: only a host on PORTAL_HOSTS is ever kept or shown;
 * - no reply senders: never a reply address;
 * - when "I answered in the partner's portal" may be pressed.
 * Phase 1: the team picks the Referral source by hand; nothing here recognises
 * the partner.
 */

/** The only hosts (and their subdomains) a stored portal link may point to. */
export const PORTAL_HOSTS = [
  "source.owlmarketplace.com",
  "owlmarketplace.com",
  "reloquest.com",
  "travelershaven.com",
  "aleasetech.com",
] as const;

/** Known portal sender addresses that never read replies. */
export const PORTAL_NO_REPLY_SENDERS = ["noreply@owlmarketplace.com"] as const;

export const NO_REPLY_WARNING =
  "This sender does not read replies. Type the address to reply to, or answer in the partner's portal.";

export const PORTAL_COPY = {
  openPortal: "Open in partner portal",
  sectionTitle: "Answer in the partner's portal",
  sectionHint: "Paste the reply into the partner's portal, then record it here.",
  showSection: "Answered in a partner's portal instead?",
  copyReply: "Copy the reply",
  copied: "Reply copied.",
  noteLabel: "Note",
  notePlaceholder: "For example: portal quote number 4471",
  noteNeeded: "Add a short note, for example the portal quote number.",
  answer: "I answered in the partner's portal",
  answered: "Answered in the partner's portal.",
  historyLine: "Answered in the partner's portal",
  askOk: "Send to a supervisor for OK",
  askOkHelp: "A supervisor checks every quote first. Once it is OK, answer in the portal.",
  waitingOk: "Waiting for a supervisor to OK the quote.",
  approvedForPortal: "The quote is OK. Answer in the partner's portal now.",
  approverToast: "Approved. The coordinator answers in the partner's portal.",
  needsOk: "A supervisor must OK this quote before you answer in the partner's portal.",
  pickFirst: "Pick at least one home first.",
  replyToLabel: "Reply to",
  replyToPlaceholder: "name@company.com",
  sentInPortal: (took: string) => `Answered in the partner's portal in ${took}.`,
  alsoPortal: "Also answered in the partner's portal.",
  correct: "Correct",
  correctTitle: "Correct the portal answer",
  correctReason: "Reason",
  correctSave: "Save the correction",
  corrected: "Corrected.",
} as const;

const MAX_LINK = 2000;

function hostAllowed(host: string) {
  const h = host.toLowerCase().replace(/\.$/, "");
  return PORTAL_HOSTS.some((p) => h === p || h.endsWith(`.${p}`));
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&#x2f;|&#47;/gi, "/")
    .replace(/&#x3a;|&#58;/gi, ":")
    .replace(/&#x3d;|&#61;/gi, "=")
    .replace(/&#x3f;|&#63;/gi, "?")
    .replace(/&quot;/gi, '"');
}

/**
 * One link, cleaned: the partner link it points to when it is on the list,
 * otherwise null. Outlook Safe Links wrappers are opened to the real link.
 */
export function portalLinkFrom(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let text = decodeEntities(raw.trim()).replace(/[).,;:!?\]>'"]+$/, "");
  if (!text || text.length > MAX_LINK) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (/(^|\.)safelinks\.protection\.outlook\.com$/i.test(url.hostname)) {
    const inner = url.searchParams.get("url");
    if (!inner) return null;
    text = inner;
    try {
      url = new URL(text);
    } catch {
      return null;
    }
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (!hostAllowed(url.hostname)) return null;
  const out = url.toString();
  return out.length <= MAX_LINK ? out : null;
}

/**
 * The first partner portal link in a message, in the order it appears. Link
 * addresses hidden behind buttons (href values in the HTML) count as well as
 * links written in the text. Anything on another host is ignored.
 */
export function findPortalLink(input: { content?: string | null; contentType?: string | null; text?: string | null }): string | null {
  const found: { at: number; link: string }[] = [];
  const scan = (source: string, offset: number) => {
    const href = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
    for (let m = href.exec(source); m; m = href.exec(source)) found.push({ at: offset + m.index, link: m[1] ?? m[2] ?? m[3] ?? "" });
    const bare = /https?:\/\/[^\s"'<>]+/gi;
    for (let m = bare.exec(source); m; m = bare.exec(source)) found.push({ at: offset + m.index, link: m[0] });
  };
  scan(input.content ?? "", 0);
  // Text after the HTML, so a link in both places is found at its HTML spot first.
  scan(input.text ?? "", (input.content ?? "").length + 1);
  found.sort((a, b) => a.at - b.at);
  for (const f of found) {
    const link = portalLinkFrom(f.link);
    if (link) return link;
  }
  return null;
}

/** A sender that never reads replies: never a reply address. */
export function isNoReplyAddress(address: string | null | undefined): boolean {
  const a = (address ?? "").trim().toLowerCase();
  if (!a) return false;
  if ((PORTAL_NO_REPLY_SENDERS as readonly string[]).includes(a)) return true;
  const local = a.split("@")[0]!.split("+")[0]!;
  if (/^(no[-_.]?reply|do[-_.]?not[-_.]?reply|mailer[-_.]?daemon)([-_.].*)?$/.test(local)) return true;
  return local === "notifications" || local === "notification";
}

/** A typed reply address that may be used: looks like an address and reads replies. */
export function usableReplyAddress(typed: string | null | undefined): string | null {
  const t = (typed ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) || t.length > 320) return null;
  return isNoReplyAddress(t) ? null : t;
}

/**
 * Where the reply goes and whether the send buttons may be used. A no reply
 * sender keeps every send button off until a usable address is typed.
 */
export function replyAddressState(saved: string | null | undefined, typed: string | null | undefined) {
  const typedOk = usableReplyAddress(typed);
  if (typedOk) return { to: typedOk, blocked: false, warning: null as string | null, typedUsed: true };
  const to = (saved ?? "").trim();
  if (isNoReplyAddress(to)) return { to, blocked: true, warning: NO_REPLY_WARNING as string | null, typedUsed: false };
  return { to, blocked: false, warning: null as string | null, typedUsed: false };
}

/** One line, trimmed, at most 200 characters, as the database stores it. */
export function portalNote(note: string | null | undefined) {
  return (note ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
}

export type PortalState = {
  approvalRequiredNow: boolean;
  /** The latest quote sent for OK was approved. */
  approved: boolean;
  pending: boolean;
  replySent: boolean;
  portalAnswered: boolean;
  finished: boolean;
  homesPicked: number;
  note: string;
};

/**
 * Whether "I answered in the partner's portal" may be pressed, and if not why.
 * During the approval period only after the Supervisor has approved the quote;
 * after it at any time. Never twice, never on a finished request.
 */
export function portalAnswerState(s: PortalState): { allowed: boolean; reason: string | null; needsOk: boolean } {
  if (s.finished || s.portalAnswered) return { allowed: false, reason: null, needsOk: false };
  if (!s.replySent && !s.approved) {
    if (s.pending) return { allowed: false, reason: PORTAL_COPY.waitingOk, needsOk: false };
    if (s.approvalRequiredNow) return { allowed: false, reason: PORTAL_COPY.needsOk, needsOk: true };
    if (s.homesPicked < 1) return { allowed: false, reason: PORTAL_COPY.pickFirst, needsOk: false };
  }
  if (!portalNote(s.note)) return { allowed: false, reason: PORTAL_COPY.noteNeeded, needsOk: false };
  return { allowed: true, reason: null, needsOk: false };
}

/** Copy the finished reply text so it can be pasted into the portal. */
export async function copyReplyText(body: string, clipboard: { writeText: (t: string) => Promise<void> }) {
  const text = body.trim();
  await clipboard.writeText(text);
  return text;
}

/** How a request was answered, for reports: email or portal (null before the reply). */
export type ReplyMethod = "email" | "portal";
