import { OPEN_STATUSES, isClosed, slaState } from "@/lib/tickets";
import { isMine, type MatterOwnership } from "@/lib/matters";
import { isBlocked, isEscalated } from "@/lib/team-queue";
import { isImportHeld } from "@/lib/import-hold";
import { isQuietNotion, isRecentOpenImport, type NotionTicketLike } from "@/lib/notion-ticket-display";

export type MyWorkView =
  "active" | "attention" | "waiting" | "blocked" | "scheduled" | "escalated" | "completed";

export const MY_WORK_VIEWS: { value: MyWorkView; label: string; hint: string }[] = [
  { value: "active", label: "Active", hint: "Work assigned to you that is still open." },
  {
    value: "attention",
    label: "Needs attention",
    hint: "Your overdue or escalated work, plus handoffs awaiting you.",
  },
  { value: "waiting", label: "Waiting", hint: "Your work awaiting a reply or follow-up." },
  { value: "blocked", label: "Blocked", hint: "Your work that cannot move without intervention." },
  { value: "scheduled", label: "Scheduled", hint: "Your work with a future next-action date." },
  {
    value: "escalated",
    label: "Escalated",
    hint: "Your work that has been escalated.",
  },
  {
    value: "completed",
    label: "Recently completed",
    hint: "Work you completed or owned at closure.",
  },
];

export type MyWorkTicket = MatterOwnership & {
  id: string;
  status: string;
  priority: string;
  response_due_at?: string | null;
  action_due_at?: string | null;
  next_action_due_at?: string | null;
  next_review_at?: string | null;
  handoff_status?: string | null;
  escalation_level?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
};

export function matchesMyWorkView(
  ticket: MyWorkTicket,
  view: MyWorkView,
  userId: string | null,
  now = Date.now(),
) {
  if (isImportHeld(ticket as { import_hold?: string | null })) return false;
  // A recent open import assigned to this person shows under Active only, and
  // stays quiet until they take it. Other imports join only once reopened.
  if (isQuietNotion(ticket as unknown as NotionTicketLike, now))
    return view === "active" && isRecentOpenImport(ticket as unknown as NotionTicketLike, now) && isMine(ticket, userId);
  if (!isMine(ticket, userId)) return false;
  const active = OPEN_STATUSES.includes(ticket.status);
  if (view === "completed") return isClosed(ticket.status);
  if (!active) return false;
  if (view === "active") return true;
  if (view === "waiting") return ticket.status === "waiting" || ticket.status === "awaiting_guest";
  if (view === "blocked") return isBlocked(ticket);
  if (view === "scheduled") {
    const due = ticket.next_action_due_at ?? ticket.next_review_at;
    return Boolean(due && new Date(due).getTime() > now);
  }
  if (view === "escalated") return isEscalated(ticket);
  return (
    ticket.handoff_status === "pending" ||
    isEscalated(ticket) ||
    slaState(ticket).breached ||
    isBlocked(ticket)
  );
}
