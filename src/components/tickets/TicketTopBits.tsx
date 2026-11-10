/**
 * Ticket header line, step tracker and the "Do this now" frame. Display only:
 * occupancy reads the same live OwnerRez lookup as the Occupancy panel (same
 * cache), and the tracker is derived from existing ticket state.
 */
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check } from "lucide-react";
import { getPropertyContactContext } from "@/lib/guest-context.functions";
import { useRole } from "@/hooks/useRole";
import { useDemo } from "@/components/DemoProvider";
import { usDate } from "@/lib/dates";
import { StatusBadge } from "@/components/ui/status";
import type { Tracker } from "@/lib/ticket-cleanup";

export type HeaderOccupancy = { state: "in_home" | "vacant" | "unknown"; guestName: string | null; until: string | null; nextArrival?: string | null };

export function useHeaderOccupancy(propertyId: string | null | undefined): HeaderOccupancy {
  const { can, isVendor, isOwner } = useRole();
  const { demoMode } = useDemo();
  const fetchContext = useServerFn(getPropertyContactContext);
  const allowed = Boolean(propertyId) && can("guest_contact") && !isVendor && !isOwner && !demoMode;
  const live = useQuery({
    queryKey: ["property-contact-context", propertyId],
    enabled: allowed,
    staleTime: 30 * 1000,
    queryFn: () => fetchContext({ data: { propertyId: propertyId as string } }),
  });
  const g = live.data && live.data.visible && live.data.propertyId === propertyId ? live.data.guest : null;
  if (!g) return { state: "unknown", guestName: null, until: null };
  if (g.status === "occupied") return { state: "in_home", guestName: g.guest_name ?? null, until: g.departure ?? null };
  if (g.status === "vacant") return { state: "vacant", guestName: null, until: null, nextArrival: g.next_arrival ?? null };
  return { state: "unknown", guestName: null, until: null };
}

export function TicketHeaderLine({ address, occupancy, ticketRef }: { address: string | null; occupancy: HeaderOccupancy; ticketRef: string | number }) {
  const parts: string[] = [];
  if (address) parts.push(address);
  if (occupancy.state === "in_home") {
    parts.push(
      [occupancy.guestName, occupancy.until ? `in home until ${usDate(occupancy.until)}` : "in home"].filter(Boolean).join(", "),
    );
  }
  parts.push(`Ticket #${ticketRef}`);
  return (
    <p className="mt-1 text-sm text-muted-foreground" data-testid="ticket-header-line">
      {parts.join(" · ")}
    </p>
  );
}

export function OccupancyChip({ occupancy }: { occupancy: HeaderOccupancy }) {
  if (occupancy.state === "in_home") return <StatusBadge tone="brand">Guest in home</StatusBadge>;
  if (occupancy.state === "vacant") return <StatusBadge tone="context">Vacant</StatusBadge>;
  return null;
}

export function StepTracker({ tracker }: { tracker: Tracker }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Where this ticket is" data-testid="step-tracker">
      {tracker.steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2" aria-current={s.current ? "step" : undefined}>
          {i > 0 && <span className="h-px w-4 bg-border sm:w-8" aria-hidden="true" />}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
              s.current
                ? "border-primary bg-primary/10 font-semibold text-primary"
                : s.complete
                  ? "border-success/40 text-success"
                  : "border-border text-muted-foreground"
            }`}
          >
            {s.complete ? <Check className="size-3.5" aria-label="done" /> : null}
            {s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function DoThisNow({ due, nextStep, children }: { due: string | null; nextStep?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label="Do this now" className="rounded-xl border-2 border-primary/40 bg-card p-4" data-current-work>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Do this now</h2>
        {/* The next step line carries its own due time (register T5). */}
        {due && !nextStep && (
          <span className={`text-sm font-medium ${due.startsWith("overdue") ? "text-danger" : "text-muted-foreground"}`} data-testid="do-this-now-due">
            {due}
          </span>
        )}
      </div>
      {nextStep}
      {children}
    </section>
  );
}
