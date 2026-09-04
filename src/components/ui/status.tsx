/**
 * The one shared status vocabulary for Resolve.
 *
 * Every lens uses these badges so a state means the same thing — and looks the
 * same — on Home, in a queue, on a ticket, on a work order and in Oversight.
 * Colour never carries the meaning on its own: each badge is a dot plus a word.
 *
 * Pure presentation. No data access, no permissions, no routing.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusTone =
  | "progress" /* sky — active work */
  | "waiting" /* amber — paused on someone else */
  | "review" /* lavender — decision or review */
  | "escalated" /* coral — high risk, blocked */
  | "resolved" /* sage — complete */
  | "closed" /* cool grey — finished and filed */
  | "context" /* aqua — property / supporting context */
  | "brand"; /* teal — brand or primary emphasis */

const TONE: Record<StatusTone, string> = {
  progress: "bg-sky/12 text-sky",
  waiting: "bg-amber/14 text-amber",
  review: "bg-lavender/12 text-lavender",
  escalated: "bg-coral/12 text-coral",
  resolved: "bg-sage/12 text-sage",
  closed: "bg-cool-grey/12 text-cool-grey",
  context: "bg-aqua/14 text-aqua",
  brand: "bg-primary/10 text-primary",
};

/** Solid version of the same tone, for rails, dots and progress fills. */
export const TONE_SOLID: Record<StatusTone, string> = {
  progress: "bg-sky",
  waiting: "bg-amber",
  review: "bg-lavender",
  escalated: "bg-coral",
  resolved: "bg-sage",
  closed: "bg-cool-grey",
  context: "bg-aqua",
  brand: "bg-primary",
};

/** A compact rounded status badge: soft tint, semantic dot, plain-language word. */
export function StatusBadge({
  tone,
  children,
  icon,
  className,
  title,
}: {
  tone: StatusTone;
  children: ReactNode;
  /** Replaces the dot when a symbol communicates more than the dot does. */
  icon?: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span className={cn("chip", TONE[tone], className)} title={title}>
      {icon ? (
        <span aria-hidden="true" className="[&>svg]:size-3.5">
          {icon}
        </span>
      ) : (
        <span aria-hidden="true" className="chip-dot" />
      )}
      {children}
    </span>
  );
}

/** Ticket status → shared tone. One mapping, used everywhere. */
export function ticketTone(status: string | null | undefined): StatusTone {
  switch (status) {
    case "dispatched":
    case "in_progress":
      return "progress";
    case "waiting":
    case "awaiting_guest":
      return "waiting";
    case "resolved":
      return "review";
    case "closed":
      return "resolved";
    case "open":
      return "escalated";
    default:
      return "closed";
  }
}
