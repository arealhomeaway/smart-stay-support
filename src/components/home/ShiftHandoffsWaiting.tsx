/**
 * Needs you now (Admin, Nov 16): waiting handoffs and today's missed shift ends, for the
 * Operations Supervisor, the Director of Operations and Admin. Opens Oversight, Shift handoffs.
 */
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Handshake } from "lucide-react";
import { useShiftHandoffs } from "@/hooks/useShiftHandoffs";
import { missedLine, shiftHandoffCounts, waitingLine } from "@/lib/shift-handoffs";

export function useShiftHandoffCounts() {
  const q = useShiftHandoffs();
  return useMemo(
    () => (q.allowed && q.data ? shiftHandoffCounts(q.data, q.demoMode) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q.allowed, q.data, q.dataUpdatedAt, q.demoMode],
  );
}

export function ShiftHandoffsWaiting() {
  const counts = useShiftHandoffCounts();
  if (!counts || counts.total === 0) return null;
  const row = (key: string, text: string, sub: string | null, urgent: boolean) => (
    <Link
      key={key}
      to="/shift-handoffs"
      data-needs-row={key}
      className="surface-row flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left"
    >
      {urgent ? (
        <AlertTriangle className="size-4 shrink-0 text-danger" aria-hidden="true" />
      ) : (
        <Handshake className="size-4 shrink-0 text-primary" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1">
        <span className={`block font-medium ${urgent ? "text-danger" : ""}`}>{text}</span>
        {sub ? <span className="block text-sm text-muted-foreground">{sub}</span> : null}
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
  return (
    <>
      {counts.missed > 0 && row("shift-missed", missedLine(counts.missed), "Shift handoffs", true)}
      {counts.waiting > 0 &&
        row(
          "shift-handoffs-waiting",
          waitingLine(counts.waiting),
          counts.late > 0 ? `${counts.late} P1 waiting more than 15 min` : "Shift handoffs",
          counts.late > 0,
        )}
    </>
  );
}

/** The count on the Oversight menu item. Nothing when there is nothing waiting. */
export function ShiftHandoffsMenuCount({ className }: { className?: string }) {
  const counts = useShiftHandoffCounts();
  if (!counts || counts.total === 0) return null;
  return (
    <span
      className={className}
      data-menu-count="oversight"
      aria-label={`${waitingLine(counts.waiting)}, ${missedLine(counts.missed)}`}
    >
      {counts.total}
    </span>
  );
}
