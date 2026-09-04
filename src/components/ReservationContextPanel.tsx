import { CalendarRange, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  hasReservationContext,
  ownerRezBookingUrl,
  ownerRezPropertyUrl,
} from "@/lib/ownerrez-links";
import { useRole } from "@/hooks/useRole";

/**
 * Reservation context frozen onto the ticket when it was logged.
 *
 * This is a snapshot, not a live read and not a reservation record: OwnerRez
 * remains the system of record for the booking. Resolve shows what was true at
 * ticket time plus deep links out to OwnerRez for anything that must change.
 */

export type ReservationTicket = {
  ownerrez_booking_id?: string | null;
  reservation_guest_name?: string | null;
  reservation_channel?: string | null;
  reservation_confirmation?: string | null;
  reservation_arrival?: string | null;
  reservation_departure?: string | null;
  reservation_guest_count?: number | null;
  reservation_url?: string | null;
  reservation_snapshot_at?: string | null;
};

function day(value: string | null | undefined) {
  if (!value) return null;
  const parts = value.slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  return new Date(parts[0]!, parts[1]! - 1, parts[2]!).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function ReservationContextPanel({
  ticket,
  ownerRezPropertyId,
}: {
  ticket: ReservationTicket;
  ownerRezPropertyId?: string | null;
}) {
  const { isVendor, isOwner } = useRole();
  if (isVendor || isOwner) return null;
  if (!hasReservationContext(ticket)) return null;

  const stay = [day(ticket.reservation_arrival), day(ticket.reservation_departure)]
    .filter(Boolean)
    .join(" → ");
  const bookingUrl = ticket.reservation_url ?? ownerRezBookingUrl(ticket.ownerrez_booking_id);
  const propertyUrl = ownerRezPropertyUrl(ownerRezPropertyId);
  const capturedAt = ticket.reservation_snapshot_at
    ? new Date(ticket.reservation_snapshot_at).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarRange className="size-4" /> Reservation context
          <Badge variant="secondary">Snapshot</Badge>
        </CardTitle>
        <CardDescription>
          Captured from OwnerRez when this ticket was logged{capturedAt ? ` (${capturedAt})` : ""}.
          OwnerRez stays the system of record — change the booking there.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <Row label="Guest" value={ticket.reservation_guest_name ?? "—"} />
        <Row label="Stay" value={stay || "—"} />
        <Row label="Channel" value={ticket.reservation_channel ?? "—"} />
        <Row label="Confirmation" value={ticket.reservation_confirmation ?? "—"} />
        <Row
          label="Guests"
          value={ticket.reservation_guest_count ? String(ticket.reservation_guest_count) : "—"}
        />
        <div className="flex flex-wrap gap-2 pt-2">
          {bookingUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href={bookingUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" /> Open booking in OwnerRez
              </a>
            </Button>
          ) : null}
          {propertyUrl ? (
            <Button asChild variant="ghost" size="sm">
              <a href={propertyUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" /> Home in OwnerRez
              </a>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
