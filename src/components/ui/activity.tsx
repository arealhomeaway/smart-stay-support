/**
 * The one Recent Activity treatment in Resolve.
 *
 * An event is a coloured icon, a plain sentence and a human time — never a
 * bordered card. The colour comes from what kind of event it is, so a column of
 * activity is scannable in seconds without reading every line.
 *
 * Pure presentation: no data access, no permissions, no routing decisions.
 */
import type { ComponentType, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  ClipboardCheck,
  Home,
  MessageSquare,
  PauseCircle,
  Stamp,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ActivityKind =
  | "repair" /* work order / vendor work — amber */
  | "escalation" /* coral */
  | "approval" /* review, decision — lavender */
  | "completed" /* sage */
  | "owner" /* owner response — aqua */
  | "handoff" /* active work moving — sky */
  | "waiting" /* amber */
  | "note" /* cool grey */
  | "property"; /* aqua */

const KIND: Record<ActivityKind, { tint: string; icon: ComponentType<{ className?: string }> }> = {
  repair: { tint: "bg-amber/12 text-amber", icon: Wrench },
  escalation: { tint: "bg-coral/12 text-coral", icon: AlertTriangle },
  approval: { tint: "bg-lavender/14 text-lavender", icon: Stamp },
  completed: { tint: "bg-sage/12 text-sage", icon: Check },
  owner: { tint: "bg-aqua/16 text-aqua", icon: MessageSquare },
  handoff: { tint: "bg-sky/14 text-sky", icon: ArrowLeftRight },
  waiting: { tint: "bg-amber/12 text-amber", icon: PauseCircle },
  note: { tint: "bg-cool-grey/14 text-cool-grey", icon: ClipboardCheck },
  property: { tint: "bg-aqua/16 text-aqua", icon: Home },
};

export type ActivityEvent = {
  id: string;
  kind: ActivityKind;
  /** One plain-language sentence. */
  label: ReactNode;
  /** Human time, e.g. "12 min ago". */
  when?: string;
  /** Optional internal destination for the whole row. */
  to?: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
};

function Row({ event }: { event: ActivityEvent }) {
  const meta = KIND[event.kind] ?? KIND.note;
  const Icon = meta.icon;
  return (
    <>
      <span
        aria-hidden="true"
        className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", meta.tint)}
      >
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{event.label}</span>
      {event.when ? (
        <span className="numeric shrink-0 text-xs text-muted-foreground">{event.when}</span>
      ) : null}
    </>
  );
}

/** A scannable column of recent events. No borders, no nested cards. */
export function ActivityList({
  events,
  emptyLabel = "Nothing has happened yet today.",
  className,
}: {
  events: ActivityEvent[];
  emptyLabel?: string;
  className?: string;
}) {
  if (events.length === 0) {
    return <p className={cn("text-sm text-muted-foreground", className)}>{emptyLabel}</p>;
  }
  return (
    <ul className={cn("space-y-0.5", className)}>
      {events.map((e) => (
        <li key={e.id}>
          {e.to ? (
            <Link
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              to={e.to as any}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              params={e.params as any}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              search={e.search as any}
              className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
            >
              <Row event={e} />
            </Link>
          ) : (
            <div className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2">
              <Row event={e} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
