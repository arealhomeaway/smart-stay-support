/**
 * Close ticket and Reopen ticket in the ticket header (register T12). Pure.
 *
 * Both buttons are always shown to people who work tickets: one is enabled
 * and the other is disabled with a plain reason. Onboarding, owner and vendor
 * accounts see neither. This only decides what the header shows. Closing
 * still goes through the closure checks and the server status rules, and
 * Reopen still uses the existing reopen paths (src/lib/ticket-reopen.ts).
 */
import type { ReopenPath } from "@/lib/ticket-reopen";

export const CLOSE_REOPEN_COPY = {
  close: "Close ticket",
  reopen: "Reopen ticket",
  reopenWhenClosed: "Reopen is available once the ticket is closed.",
  closeWhenClosed: "This ticket is already closed.",
  closeWhenFinished: "The work is finished and waiting for review.",
  archived: "Archived tickets cannot be closed or reopened.",
  record: "This is a saved record of finished work.",
  notion: "Use the Imported from Notion box below to reopen it.",
  notYet: "Not now",
} as const;

export type HeaderButton = { enabled: boolean; reason: string | null };
export type CloseReopenState = { close: HeaderButton; reopen: HeaderButton } | null;

export function closeReopenState(input: {
  status: string;
  archived: boolean;
  recordType?: string | null;
  canWorkTickets: boolean;
  onboardingOnly: boolean;
  reopenPath: ReopenPath;
}): CloseReopenState {
  if (!input.canWorkTickets || input.onboardingOnly) return null;
  const off = (reason: string): HeaderButton => ({ enabled: false, reason });
  const on: HeaderButton = { enabled: true, reason: null };
  if (input.archived) return { close: off(CLOSE_REOPEN_COPY.archived), reopen: off(CLOSE_REOPEN_COPY.archived) };
  if (input.recordType === "completed_interaction") {
    return { close: off(CLOSE_REOPEN_COPY.record), reopen: off(CLOSE_REOPEN_COPY.record) };
  }
  const isOpen = input.status !== "closed" && input.status !== "resolved";
  if (isOpen) return { close: on, reopen: off(CLOSE_REOPEN_COPY.reopenWhenClosed) };
  const close = off(input.status === "resolved" ? CLOSE_REOPEN_COPY.closeWhenFinished : CLOSE_REOPEN_COPY.closeWhenClosed);
  if (input.reopenPath === "closed" || input.reopenPath === "resolved") return { close, reopen: on };
  if (input.reopenPath === "notion") return { close, reopen: off(CLOSE_REOPEN_COPY.notion) };
  return { close, reopen: off(CLOSE_REOPEN_COPY.closeWhenClosed) };
}
