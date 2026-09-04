/**
 * Mailbox allowlist (server-only).
 *
 * Exactly one Microsoft 365 mailbox is authorised for this integration, for
 * both reading and sending: the address in EMAIL_SOURCE_MAILBOX. Nothing in the
 * browser, a ticket row, a user profile or an API request can change it.
 *
 * Every Graph path used by Resolve is built here so there is a single place to
 * audit: no /me/*, no user enumeration, no dynamic mailbox selection.
 */

/** Fallback only so the code is inspectable; the env var is the source of truth. */
const DEFAULT_MAILBOX = "info@arealhomeaway.com";

/** The one authorised mailbox, lowercased. */
export function authorizedMailbox(): string {
  const value = (process.env["EMAIL_SOURCE_MAILBOX"] ?? DEFAULT_MAILBOX).trim().toLowerCase();
  return value;
}

/** The complete allowlist. One entry, by design. */
export function mailboxAllowlist(): string[] {
  return [authorizedMailbox()];
}

export class UnauthorizedMailboxError extends Error {
  constructor(requested: string) {
    super(`unauthorized mailbox request: ${requested || "(empty)"}`);
    this.name = "UnauthorizedMailboxError";
  }
}

/**
 * Verifies a mailbox against the allowlist before any read or send.
 * Throws — and logs "unauthorized mailbox request" — for anything else.
 */
export function assertAllowedMailbox(requested: string | null | undefined): string {
  const candidate = (requested ?? "").trim().toLowerCase();
  if (!candidate || !mailboxAllowlist().includes(candidate)) {
    console.error(`unauthorized mailbox request: ${candidate || "(empty)"}`);
    throw new UnauthorizedMailboxError(candidate);
  }
  return candidate;
}

/** `/users/<authorised mailbox>` — the only Graph mailbox root this app may touch. */
export function mailboxRoot(requested: string = authorizedMailbox()): string {
  return `/users/${encodeURIComponent(assertAllowedMailbox(requested))}`;
}

/**
 * Read path: any folder of the authorised mailbox.
 *
 * Folder location is how the team decides who owns an email (Team A, Team B,
 * Accounting, Direct Bookings / Mid Term Leads, Deliveries, Needs Triage), so
 * intake must not care where a message currently sits. The mailbox itself is
 * still the hard boundary — no other mailbox is ever addressable.
 */
export function mailboxMessagesPath(query = ""): string {
  return `${mailboxRoot()}/messages${query}`;
}

/** Legacy Inbox-only path, kept for anything that must scope to the Inbox. */
export function inboxMessagesPath(query = ""): string {
  return `${mailboxRoot()}/mailFolders/Inbox/messages${query}`;
}

/** Send path: the authorised mailbox only. Never /me/sendMail. */
export function sendMailPath(): string {
  return `${mailboxRoot()}/sendMail`;
}
