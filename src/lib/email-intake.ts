/**
 * Email intake safety rules (pure, browser safe).
 *
 * Emily, Nov 9 (register "Email intake"): the switch is real; the start line
 * is set when it is turned on and older mail is ignored; [RESOLVE TEST] mail
 * from an ARHA address is a test record; mail from our own address never
 * creates a Direct Booking request.
 *
 * Every rule here is mirrored by the server paths in mailbox.server.ts and
 * email-intake.server.ts, and by the staged database step in
 * docs/pending/email-intake-safety/.
 */

import { isArrivalTestTicket } from "./arrival-check";

export const INTAKE_OFF_MESSAGE = "Email intake is off.";
export const BEFORE_START_REASON = "received before email intake started";
export const OWN_ADDRESS_REASON = "sent from our own address";
export const TEST_SUBJECT_MARKER = "[RESOLVE TEST]";
export const CLEAR_TEST_REASON = "Email intake test";
export const OWN_DOMAIN = "arealhomeaway.com";

/** True for any @arealhomeaway.com sender. */
export function isOwnAddress(address: string | null | undefined): boolean {
  const a = (address ?? "").trim().toLowerCase();
  return a.endsWith(`@${OWN_DOMAIN}`) && a.indexOf("@") > 0;
}

/** A test message: the subject starts with [RESOLVE TEST] and the sender is an ARHA address. */
export function isIntakeTest(subject: string | null | undefined, from: string | null | undefined) {
  return (
    (subject ?? "").trimStart().toUpperCase().startsWith(TEST_SUBJECT_MARKER) && isOwnAddress(from)
  );
}

/**
 * True when a message must be ignored because it arrived before the start
 * line. No start line, or no received time, is treated as before: intake can
 * only act on mail it can prove arrived after it was turned on.
 */
export function receivedBeforeStart(
  receivedAt: string | null | undefined,
  startLine: string | null | undefined,
): boolean {
  if (!startLine || !receivedAt) return true;
  const received = new Date(receivedAt).getTime();
  const start = new Date(startLine).getTime();
  if (Number.isNaN(received) || Number.isNaN(start)) return true;
  return received <= start;
}

/** The start line only ever moves forward. */
export function nextStartLine(current: string | null | undefined, now: Date): string {
  const rounded = new Date(Math.ceil(now.getTime() / 1000) * 1000);
  const iso = rounded.toISOString().replace(/\.\d{3}Z$/, "Z");
  if (!current) return iso;
  return new Date(current).getTime() >= rounded.getTime() ? current : iso;
}

/** A Ticket made from a [RESOLVE TEST] email (demo marked, from the email path). */
export function isEmailTestTicket(
  t: { is_demo?: boolean | null; external_source?: string | null } | null | undefined,
) {
  return Boolean(t?.is_demo) && (t?.external_source ?? "").toLowerCase() === "email";
}

/**
 * Register E1 (a), Emily Nov 9: test records show, with their Test chip, in the normal
 * screens for the people who run the test plan (Admin, Operations Supervisor, Director of
 * Operations, Director of Onboarding) and stay hidden from everyone else. They are never
 * counted anywhere, for anyone.
 */
export function seesEmailTestRecords(
  roles: readonly string[],
  seats: { opsSupervisor?: boolean; opsDirector?: boolean; onboardingDirector?: boolean } = {},
): boolean {
  return (
    roles.includes("admin") ||
    seats.opsSupervisor === true ||
    seats.opsDirector === true ||
    seats.onboardingDirector === true
  );
}

/** The same rule, read from the role access object the screens already hold. */
export function seesEmailTestsFor(access: {
  roles: readonly string[];
  seats: { opsSupervisor?: boolean; opsDirector?: boolean; onboardingDirector?: boolean };
}): boolean {
  return seesEmailTestRecords(access.roles, access.seats);
}

/**
 * Whether a ticket shows under the current lens: the ordinary demo or real match, plus an
 * email test ticket in the real lens for someone who runs the test plan.
 */
export function ticketShownInLens(
  t: { is_demo?: boolean | null; external_source?: string | null; external_id?: string | null } | null | undefined,
  demoMode: boolean,
  seesTests: boolean,
): boolean {
  if (!t) return false;
  if (Boolean(t.is_demo) === demoMode) return true;
  // Build 12: a test arrival check opens the same way for the people who run the test plan.
  return !demoMode && seesTests && (isEmailTestTicket(t) || isArrivalTestTicket(t));
}

/** Words for the separate, never counted list of test records. */
export const EMAIL_TEST_COPY = {
  heading: "Email intake tests",
  hint: "Test records for the email intake test plan. They are never counted in any total.",
  open: "Open",
} as const;

/** Register E1 (c): Run intake now is hidden until it can create records. */
export const RUN_INTAKE_NOW_SHOWN = false;

/** Register E1 (e): the switch and the timed check move together. */
export const ONE_SWITCH_NOTE =
  "Turning this on also starts the timed check every minute. Turning it off stops both.";
export const OUT_OF_STEP_LINE =
  "The switch and the timed check do not match. Turn email intake off and on again to fix it.";

/** A Direct Booking request made from a [RESOLVE TEST] email. */
export function isEmailTestLead(
  l: { is_demo?: boolean | null; source_detail?: Record<string, unknown> | null } | null | undefined,
) {
  const detail = (l?.source_detail ?? {}) as Record<string, unknown>;
  return Boolean(l?.is_demo) && detail["email_test"] === true;
}

/** Alert wording for a test record. Mirrors the database trigger. */
export function testAlertTitle(title: string) {
  return /^test\b/i.test(title) ? title : `Test: ${title}`;
}

export type NotificationState = { label: string; live: boolean };

/**
 * What the inbox panel says about Microsoft notifications. It never says
 * "Live notifications" unless the subscription is current, the switch is on
 * and the sweep (which renews it) is running.
 */
export function notificationState(input: {
  subscription: { status: string; expiresAt: string | null } | null;
  switchOn: boolean;
  sweepActive: boolean;
  now?: Date;
}): NotificationState {
  const now = (input.now ?? new Date()).getTime();
  const sub = input.subscription;
  if (!sub) return { label: "Notifications not set up", live: false };
  const expiry = sub.expiresAt ? new Date(sub.expiresAt).getTime() : 0;
  if (sub.status !== "active" || !expiry || expiry <= now) {
    return { label: "Notifications expired", live: false };
  }
  if (!input.switchOn || !input.sweepActive) return { label: "Notifications not running", live: false };
  return { label: "Live notifications", live: true };
}

/** The plain status lines on the inbox panel, in order. */
export function intakeStatusLines(input: {
  switchOn: boolean;
  startLine: string | null;
  sweepActive: boolean;
  lastSweepAt: string | null;
  lastMessageAt: string | null;
  skippedSinceStart: number;
  format: (iso: string) => string;
}): string[] {
  const f = input.format;
  const lines = [
    input.switchOn ? "Email intake is on." : INTAKE_OFF_MESSAGE,
    input.startLine
      ? `Mail received after ${f(input.startLine)} is read. Older mail is ignored.`
      : "No start line yet. It is set when email intake is turned on.",
    input.sweepActive
      ? `Timed check runs every minute. Last check: ${input.lastSweepAt ? f(input.lastSweepAt) : "none yet"}.`
      : `Timed check is off. Last check: ${input.lastSweepAt ? f(input.lastSweepAt) : "none yet"}.`,
    `Last message handled: ${input.lastMessageAt ? f(input.lastMessageAt) : "none yet"}.`,
    `${input.skippedSinceStart} message${input.skippedSinceStart === 1 ? "" : "s"} skipped since the start line.`,
  ];
  // Register E1 (e): one switch. Say so plainly if the two are ever out of step.
  if (input.switchOn !== input.sweepActive) lines.push(OUT_OF_STEP_LINE);
  return lines;
}
