/**
 * Homeowner ⇄ ARHA conversation on one owner-facing request (browser-safe).
 *
 * The thread merges the homeowner's original structured responses (stored on
 * the request) with the append-only conversation messages, in time order.
 * The conversation state is derived from the thread, never stored twice.
 */

export type ThreadAuthor = "homeowner" | "staff" | "system";

export type ThreadEntry = {
  id: string;
  author: ThreadAuthor;
  name: string;
  label: string | null;
  text: string | null;
  at: string;
  event: "resolved" | "reopened" | "response_requested" | null;
  requestKind?: "feedback" | "decision" | null;
};

export type ConversationMessage = {
  id: string;
  author_type: string;
  author_name: string;
  body: string;
  event: string | null;
  request_kind?: string | null;
  created_at: string;
};

export type LegacyResponse = {
  kind: string;
  decision: string | null;
  text: string | null;
  at: string;
  by?: string;
};

export type ConversationState = "resolved" | "staff_action" | "waiting_on_homeowner";

export const CONVERSATION_STATE_META: Record<ConversationState, { label: string; tone: string }> = {
  staff_action: { label: "Staff action needed", tone: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300" },
  waiting_on_homeowner: { label: "Waiting on homeowner", tone: "border-border bg-muted text-muted-foreground" },
  resolved: { label: "Resolved / Complete", tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
};

function legacyLabel(r: LegacyResponse) {
  if (r.kind === "decision") return r.decision === "authorize" ? "Authorized this work" : "Requested changes";
  if (r.kind === "acknowledge") return "Acknowledged";
  return "Feedback";
}

export function buildThread(legacy: LegacyResponse[], messages: ConversationMessage[]): ThreadEntry[] {
  const entries: ThreadEntry[] = [
    ...legacy.map((r, i) => ({
      id: `r${i}`,
      author: "homeowner" as const,
      name: r.by ?? "The homeowner",
      label: legacyLabel(r),
      text: r.text,
      at: r.at,
      event: null,
    })),
    ...messages.map((m) => ({
      id: m.id,
      author: (m.author_type === "staff" || m.author_type === "system" ? m.author_type : "homeowner") as ThreadAuthor,
      name: m.author_name,
      label: m.event === "response_requested" ? (m.request_kind === "decision" ? "Decision requested" : "Feedback requested") : null,
      text: m.body,
      at: m.created_at,
      event: (m.event === "resolved" || m.event === "reopened" || m.event === "response_requested" ? m.event : null) as ThreadEntry["event"],
      requestKind: (m.request_kind === "feedback" || m.request_kind === "decision" ? m.request_kind : null) as ThreadEntry["requestKind"],
    })),
  ];
  return entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

/** Resolved when complete; otherwise whoever spoke last decides who acts next. */
export function conversationState(status: string, thread: ThreadEntry[]): ConversationState {
  if (status === "complete") return "resolved";
  const last = [...thread].reverse().find((e) => e.author !== "system");
  return last?.author === "homeowner" ? "staff_action" : "waiting_on_homeowner";
}

/** The last non-system author on a thread, or null when nobody has spoken yet. */
export function lastSpeaker(thread: ThreadEntry[]): "homeowner" | "staff" | null {
  const last = [...thread].reverse().find((e) => e.author !== "system");
  return last ? (last.author as "homeowner" | "staff") : null;
}

/**
 * An explicit staff request for a fresh response stays open until the homeowner
 * answers after it (a reply or a recorded response). Informational staff
 * messages never open a request.
 */
export function openResponseRequest(thread: ThreadEntry[]): "feedback" | "decision" | null {
  let open: "feedback" | "decision" | null = null;
  for (const e of thread) {
    if (e.event === "response_requested") open = e.requestKind ?? "feedback";
    else if (e.author === "homeowner") open = null;
  }
  return open;
}
