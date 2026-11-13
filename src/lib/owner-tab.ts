/**
 * Property page Part 2 (approved Nov 12): the Owner tab, the project chat and owner communication
 * on one home's Onboarding view. Pure rules only, shared by the screens, the server functions, the
 * five-minute job and the tests. The database mirrors the permission and timing rules
 * (docs/pending/property-page-part2/apply.sql) and is the authority once applied.
 */
import { UPLOAD_FOLDERS, type HomeFolder } from "@/lib/home-details";

/* ------------------------------------------------------------------ who can do what */

export type OwnerTabViewer = {
  userId: string | null;
  isAdmin: boolean;
  isOnboardingDirector: boolean;
  /** The home's Project Manager. */
  isHomePm: boolean;
  /** Designer or Utilities on this home's team. */
  isHomeTeam: boolean;
  /** Any staff account that can open the home (Admin, managers, onboarding accounts). */
  isStaff: boolean;
};

export type OwnerTabRights = {
  postOwnerChat: boolean;
  postTeamChat: boolean;
  askOwner: boolean;
  emailOwner: boolean;
  logContact: boolean;
  sendWeekly: boolean;
  switchPlan: boolean;
  switchAutoSend: boolean;
  pauseWeekly: boolean;
  editGoodToKnow: boolean;
  editPreferred: boolean;
};

/** WHO CAN DO WHAT (Part 2): the screen mirror of the server rules. */
export function ownerTabRights(v: OwnerTabViewer): OwnerTabRights {
  const signedIn = Boolean(v.userId) && v.isStaff;
  const lead = signedIn && (v.isAdmin || v.isOnboardingDirector);
  const pm = signedIn && v.isHomePm;
  const team = signedIn && (v.isHomePm || v.isHomeTeam);
  return {
    postOwnerChat: lead || team,
    // A view-only viewer (not on the team, not Admin or Director) still posts in Team only.
    postTeamChat: signedIn,
    askOwner: lead || team,
    emailOwner: lead || team,
    logContact: lead || team,
    sendWeekly: lead || pm,
    switchPlan: lead,
    switchAutoSend: lead,
    pauseWeekly: lead || pm,
    editGoodToKnow: lead || pm,
    editPreferred: lead || pm,
  };
}

/* ------------------------------------------------------------------ Needs action */

export type NeedsActionRow =
  | { kind: "waiting_on_us"; id: string; title: string; who: string; at: string | null; source: "item" | "chat" }
  | { kind: "waiting_on_owner"; id: string; title: string; dueOn: string | null; taskTitle: string; reminderOn: string | null; reminderSent: boolean }
  | { kind: "check_it"; id: string; title: string; what: string; at: string | null }
  | { kind: "weekly"; id: string; ownerFirstNames: string };

/**
 * 2.1: only these four kinds, in this order. Plan cards are never listed (only counted on the right).
 * Standard homes have no "check it" rows.
 */
export function needsAction(input: {
  activeOwner: boolean;
  waitingOnUs: Extract<NeedsActionRow, { kind: "waiting_on_us" }>[];
  waitingOnOwner: Extract<NeedsActionRow, { kind: "waiting_on_owner" }>[];
  checkIt: Extract<NeedsActionRow, { kind: "check_it" }>[];
  weekly: Extract<NeedsActionRow, { kind: "weekly" }> | null;
}): NeedsActionRow[] {
  const byAt = <T extends { at: string | null }>(a: T, b: T) => (b.at ?? "").localeCompare(a.at ?? "");
  return [
    ...[...input.waitingOnUs].sort(byAt),
    ...[...input.waitingOnOwner].sort((a, b) => (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999")),
    ...(input.activeOwner ? [...input.checkIt].sort(byAt) : []),
    ...(input.weekly ? [input.weekly] : []),
  ];
}

/** The Owner tab count: owner answers staff have not replied to, plus a weekly update ready to send. */
export function ownerTabCount(rows: NeedsActionRow[]): number {
  return rows.filter((r) => r.kind === "waiting_on_us" || r.kind === "weekly").length;
}

/** Owner chat: the owner is waiting on us when their newest message is newer than the newest staff message. */
export function ownerChatWaiting(messages: { author_type: string; created_at: string }[]): { at: string } | null {
  let owner: string | null = null;
  let staff: string | null = null;
  for (const m of messages) {
    if (m.author_type === "owner" && (!owner || m.created_at > owner)) owner = m.created_at;
    if (m.author_type === "staff" && (!staff || m.created_at > staff)) staff = m.created_at;
  }
  return owner && (!staff || owner > staff) ? { at: owner } : null;
}

/* ------------------------------------------------------------------ timeline */

export const TIMELINE_KINDS = ["portal", "email", "text", "call", "approval", "weekly"] as const;
export type TimelineKind = (typeof TIMELINE_KINDS)[number];
export const TIMELINE_TAG: Record<TimelineKind, string> = {
  portal: "Portal",
  email: "Email",
  text: "Text",
  call: "Call",
  approval: "Approval",
  weekly: "Weekly update",
};
export const TIMELINE_FILTERS = [
  { key: "all", label: "All", kinds: TIMELINE_KINDS as readonly TimelineKind[] },
  { key: "messages", label: "Messages", kinds: ["portal"] as TimelineKind[] },
  { key: "emails", label: "Emails", kinds: ["email"] as TimelineKind[] },
  { key: "calls", label: "Calls and texts", kinds: ["call", "text"] as TimelineKind[] },
  { key: "approvals", label: "Approvals", kinds: ["approval"] as TimelineKind[] },
  { key: "weekly", label: "Weekly updates", kinds: ["weekly"] as TimelineKind[] },
] as const;
export type TimelineFilter = (typeof TIMELINE_FILTERS)[number]["key"];

export type TimelineRow = { id: string; kind: TimelineKind; text: string; who: string; at: string };

/** Newest first; the kind chip and the search box (text and who) narrow it. */
export function filterTimeline(rows: TimelineRow[], filter: TimelineFilter, search: string): TimelineRow[] {
  const kinds = TIMELINE_FILTERS.find((f) => f.key === filter)?.kinds ?? TIMELINE_KINDS;
  const q = search.trim().toLowerCase();
  return rows
    .filter((r) => kinds.includes(r.kind))
    .filter((r) => !q || r.text.toLowerCase().includes(q) || r.who.toLowerCase().includes(q))
    .sort((a, b) => b.at.localeCompare(a.at));
}

/* ------------------------------------------------------------------ composer */

export type ComposerMode = "message" | "email" | "log";

/**
 * 2.1: Message (owner chat), Email, Log a call or text. Standard owner homes have no Message mode
 * unless the owner has a portal login.
 */
export function composerModes(input: { activeOwner: boolean; ownerHasPortal: boolean; rights: OwnerTabRights }): ComposerMode[] {
  const out: ComposerMode[] = [];
  if ((input.activeOwner || input.ownerHasPortal) && input.rights.postOwnerChat) out.push("message");
  if (input.rights.emailOwner) out.push("email");
  if (input.rights.logContact) out.push("log");
  return out;
}

export const COMPOSER_LABEL: Record<ComposerMode, string> = { message: "Message", email: "Email", log: "Log a call or text" };
export function composerHint(mode: ComposerMode, ownerName: string): string {
  const many = /\band\b|&|,/.test(ownerName);
  if (mode === "message") return `Posts in the owner chat. ${ownerName || "The owner"} ${many ? "see" : "sees"} it in their portal.`;
  if (mode === "email") return "Sends from your mailbox and is saved on this home.";
  return "Writes down a call or text that happened outside Resolve. The owner does not see it.";
}

/* ------------------------------------------------------------------ chat */

/** Part 3 (3.2): chat files go into the home's Files folders, never Other. */
export const CHAT_FOLDERS = UPLOAD_FOLDERS.map((f) => ({ id: f.id as ChatFolder, label: f.label, category: f.upload as string }));
export type ChatFolder = Exclude<HomeFolder, "other">;

export const CHAT_STYLE = {
  owner: { label: "With the owner", banner: "The owner sees everything in this chat." },
  team: { label: "Team only", banner: "Internal. The owner never sees this chat." },
} as const;
export type ChatKind = keyof typeof CHAT_STYLE;

/** @mentions: "@First Last" or "@First" of a teammate in the list. */
export function parseMentions(body: string, people: { id: string; name: string }[]): string[] {
  const text = ` ${body.toLowerCase()} `;
  const out = new Set<string>();
  for (const p of [...people].sort((a, b) => b.name.length - a.name.length)) {
    const full = p.name.trim().toLowerCase();
    if (!full) continue;
    const first = full.split(/\s+/)[0]!;
    if (text.includes(`@${full}`) || new RegExp(`@${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z])`).test(text)) out.add(p.id);
  }
  return [...out];
}

export function unreadCount(messages: { author_id: string; created_at: string }[], viewerId: string | null, lastReadAt: string | null): number {
  return messages.filter((m) => m.author_id !== viewerId && (!lastReadAt || m.created_at > lastReadAt)).length;
}

/** 15 minutes unread, and at most one owner email per 15 minutes per home (mirror of the database run). */
export function ownerChatEmailDue(input: { staffMessageAt: string; ownerReadAt: string | null; lastEmailAt: string | null; now: string }): boolean {
  const t = Date.parse(input.now);
  if (t - Date.parse(input.staffMessageAt) < 15 * 60_000) return false;
  if (input.ownerReadAt && input.ownerReadAt >= input.staffMessageAt) return false;
  if (input.lastEmailAt && t - Date.parse(input.lastEmailAt) < 15 * 60_000) return false;
  return true;
}

/* ------------------------------------------------------------------ Central time and business days */

const DOW: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
export function centralParts(at: Date): { date: string; dow: number; minutes: number } {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  return { date: `${p["year"]}-${p["month"]}-${p["day"]}`, dow: DOW[p["weekday"] ?? "Mon"] ?? 1, minutes: Number(p["hour"]) * 60 + Number(p["minute"]) };
}
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function isoDow(iso: string): number {
  const d = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** 2.4: the last business day before the due date (weekends and the holidays table skipped). */
export function reminderDay(dueOn: string, holidays: string[] = []): string {
  let d = addDays(dueOn, -1);
  while (isoDow(d) >= 6 || holidays.includes(d)) d = addDays(d, -1);
  return d;
}
export function reminderText(title: string, dueOn: string): string {
  const d = new Date(`${dueOn}T12:00:00Z`);
  return `Reminder: ${title} is due ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}.`;
}

/** 2.5: Friday 3 PM Central to Sunday nobody sends; the draft waits until Monday. */
export function weeklySendClosed(now: Date): boolean {
  const c = centralParts(now);
  return c.dow === 6 || c.dow === 7 || (c.dow === 5 && c.minutes >= 15 * 60);
}
/** The Monday of the week holding this Central date. */
export function weekStartOf(iso: string): string {
  return addDays(iso, 1 - isoDow(iso));
}
/** Friday from 7 AM Central: time to write this week's drafts. */
export function weeklyDraftDue(now: Date): boolean {
  const c = centralParts(now);
  return c.dow === 5 && c.minutes >= 7 * 60;
}
/** Friday 3 PM Central (the first hour): homes with auto-send on and not paused send themselves. */
export function weeklyAutoSendDue(now: Date): boolean {
  const c = centralParts(now);
  return c.dow === 5 && c.minutes >= 15 * 60 && c.minutes < 16 * 60;
}

/* ------------------------------------------------------------------ weekly draft */

export type DraftTask = { title: string; status: string; completed_at: string | null; due_on: string | null; parent_task_id?: string | null; archived_at?: string | null };
export type DraftDecision = { title: string; due_on: string | null };

const isDone = (s: string) => s === "complete" || s === "done";

/**
 * 2.5: written from the plan. Done this week (Tasks completed Monday to Friday), Next week (open
 * Tasks due in the next 7 days), Waiting on you (open owner decisions with dates), Target handoff.
 */
export function weeklyDraft(input: {
  ownerFirstNames: string;
  homeName: string;
  weekStart: string;
  today: string;
  tasks: DraftTask[];
  decisions: DraftDecision[];
  handoffOn: string | null;
  behind: boolean;
}): string {
  const friday = addDays(input.weekStart, 4);
  const nextEnd = addDays(input.today, 7);
  const top = input.tasks.filter((t) => !t.parent_task_id && !t.archived_at);
  const doneWeek = top.filter((t) => isDone(t.status) && t.completed_at && t.completed_at.slice(0, 10) >= input.weekStart && t.completed_at.slice(0, 10) <= friday);
  const next = top
    .filter((t) => !isDone(t.status) && t.status !== "void" && t.due_on && t.due_on > input.today && t.due_on <= nextEnd)
    .sort((a, b) => (a.due_on ?? "").localeCompare(b.due_on ?? ""));
  const fmt = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const list = (rows: string[], empty: string) => (rows.length ? rows.map((r) => `- ${r}`).join("\n") : `- ${empty}`);
  return [
    `Hi ${input.ownerFirstNames || "there"},`,
    `Here is this week at ${input.homeName}.`,
    `Done this week\n${list(doneWeek.map((t) => ownerFriendly(t.title)), "Steady work behind the scenes this week.")}`,
    `Next week\n${list(next.map((t) => `${ownerFriendly(t.title)} (${fmt(t.due_on!)})`), "Nothing new is due next week.")}`,
    `Waiting on you\n${list(input.decisions.map((d) => `${d.title}${d.due_on ? ` (by ${fmt(d.due_on)})` : ""}`), "Nothing right now. Thank you!")}`,
    `Target handoff\n${input.handoffOn ? `${fmt(input.handoffOn)}, ${input.behind ? "Behind" : "On track"}` : "Not set yet"}`,
  ].join("\n\n");
}

/** Owner-friendly Task titles: no "Work order:" prefixes or bracketed internal notes. */
export function ownerFriendly(title: string): string {
  return title.replace(/^work order:\s*/i, "").replace(/\s*\[[^\]]*\]\s*/g, " ").replace(/\s+/g, " ").trim();
}

/* ------------------------------------------------------------------ Active Owner program card */

/** "on pace for about N by Dec 31": hours so far, spread over the days since the start. */
export function hoursPace(input: { hours: number; startOn: string | null; today: string }): number | null {
  if (!input.startOn || input.startOn > input.today) return null;
  const year = input.today.slice(0, 4);
  const end = `${year}-12-31`;
  const start = input.startOn.slice(0, 4) === year ? input.startOn : `${year}-01-01`;
  const days = (a: string, b: string) => Math.max(1, Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000) + 1);
  const elapsed = days(start, input.today);
  const total = days(start, end);
  return Math.round((input.hours / elapsed) * total);
}

/* ------------------------------------------------------------------ email job limits (2.7) */

export const EMAIL_PART_BATCH = 50;
export const EMAIL_PART_SECONDS = 60;
/** Each email part stops after 60 seconds and leaves the rest for the next run. */
export function partTimeLeft(startedAt: number, now: number = Date.now()): boolean {
  return now - startedAt < EMAIL_PART_SECONDS * 1000;
}
