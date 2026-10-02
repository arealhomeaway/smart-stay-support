import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Home, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { getPropertyContactContext } from "@/lib/guest-context.functions";
import {
  ACTIVE_STAY_IMPACT,
  GUEST_COMM,
  ISSUE_RELATION,
  currentGuestDisplay,
  relationFromDates,
  suggestActiveStayImpact,
  ticketGuestComm,
  type Occupancy,
} from "@/lib/guest-impact";
import { ownerRezBookingUrl } from "@/lib/ownerrez-links";
import { usDate } from "@/lib/dates";
import { useRole } from "@/hooks/useRole";
import { useDemo } from "@/components/DemoProvider";

/**
 * Occupancy & guest impact for one Ticket. Keeps four answers apart:
 * who is in the home now (live, never guessed), which reservation the issue
 * belongs to, whether it affects an active stay, and what we owe a guest.
 * Live guest detail is read on view and never stored.
 */

export type OccupancyTicket = {
  id: string;
  property_id: string | null;
  guest_in_residence: boolean | null;
  guest_impact: string | null;
  guest_confirmed: boolean | null;
  guest_update_at: string | null;
  next_guest_update_at: string | null;
  waiting_on: string | null;
  active_stay_impact: string | null;
  guest_comm_required: string | null;
  issue_reservation_relation: string | null;
  ownerrez_booking_id: string | null;
  reservation_guest_name: string | null;
  reservation_arrival: string | null;
  reservation_departure: string | null;
  reservation_confirmation: string | null;
  reservation_channel: string | null;
  reservation_url: string | null;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

const TONE: Record<Occupancy, "default" | "secondary" | "outline"> = {
  in_home: "default",
  vacant: "secondary",
  unknown: "outline",
};

export function OccupancyGuestPanel({
  ticket,
  workTypeName,
  readOnly,
  onChanged,
}: {
  ticket: OccupancyTicket;
  workTypeName: string | null;
  readOnly?: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const { can, isVendor, isOwner } = useRole();
  const { demoMode } = useDemo();
  const fetchContext = useServerFn(getPropertyContactContext);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    guest: ticket.reservation_guest_name ?? "",
    arrival: ticket.reservation_arrival ?? "",
    departure: ticket.reservation_departure ?? "",
    confirmation: ticket.reservation_confirmation ?? "",
  });

  const liveAllowed =
    Boolean(ticket.property_id) && can("guest_contact") && !isVendor && !isOwner && !demoMode;
  const live = useQuery({
    queryKey: ["property-contact-context", ticket.property_id],
    enabled: liveAllowed,
    staleTime: 30 * 1000,
    queryFn: () => fetchContext({ data: { propertyId: ticket.property_id as string } }),
  });

  if (isVendor || isOwner) return null;

  const guest =
    live.data && live.data.visible && live.data.propertyId === ticket.property_id
      ? live.data.guest
      : null;
  const display = currentGuestDisplay(
    guest
      ? {
          status: guest.status,
          guest_name: guest.status === "occupied" ? guest.guest_name : null,
          phone: guest.status === "occupied" ? guest.phone : null,
          email: guest.status === "occupied" ? guest.email : null,
        }
      : { status: "unknown" },
  );
  const unknownWhy = demoMode
    ? "Demo homes never read OwnerRez, so occupancy can't be verified."
    : !liveAllowed
      ? "Occupancy can't be verified from this view."
      : guest?.status === "not_linked"
        ? "This home isn't linked to an OwnerRez listing."
        : guest?.status === "ambiguous"
          ? "More than one reservation matches right now — verify in OwnerRez."
          : guest?.status === "source_error"
            ? "OwnerRez could not be read just now — verify there."
            : "Reservation data isn't available.";

  const eff = ticketGuestComm(ticket, workTypeName);
  const relation =
    eff.relation ?? relationFromDates(ticket.reservation_arrival, ticket.reservation_departure);
  const suggestedImpact = suggestActiveStayImpact({
    occupancy: display.occupancy,
    relation,
    postStay: eff.postStay,
    guestAffectedNow: ticket.guest_in_residence,
    guestImpact: ticket.guest_impact,
  });
  const hasIssueReservation = Boolean(
    ticket.reservation_guest_name || ticket.reservation_arrival || ticket.ownerrez_booking_id,
  );
  const bookingUrl = ticket.reservation_url ?? ownerRezBookingUrl(ticket.ownerrez_booking_id);
  const issueIsCurrent = relation === "current";

  async function save(patch: {
    active_stay_impact?: string;
    guest_comm_required?: string;
    issue_reservation_relation?: string;
    reservation_guest_name?: string | null;
    reservation_arrival?: string | null;
    reservation_departure?: string | null;
    reservation_confirmation?: string | null;
  }) {
    setSaving(true);
    const { error } = await supabase.from("tickets").update(patch).eq("id", ticket.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return false;
    }
    await onChanged();
    return true;
  }

  async function saveReservation() {
    const ok = await save({
      reservation_guest_name: draft.guest.trim() || null,
      reservation_arrival: draft.arrival || null,
      reservation_departure: draft.departure || null,
      reservation_confirmation: draft.confirmation.trim() || null,
      issue_reservation_relation:
        relationFromDates(draft.arrival, draft.departure) ?? relation ?? "prior",
    });
    if (ok) setEditing(false);
  }

  return (
    <Card data-testid="occupancy-guest-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Home className="size-4" /> Occupancy & guest impact
        </CardTitle>
        <CardDescription>
          Who is in the home now comes live from OwnerRez and is never saved here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {/* 1. Current occupancy */}
        <section className="space-y-2" aria-label="Current occupancy">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Current occupancy
          </p>
          {liveAllowed && live.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <>
              <Badge variant={TONE[display.occupancy]} data-testid="occupancy-state">
                {display.occupancy === "in_home" ? "Guest in home" : display.headline}
              </Badge>
              {display.occupancy === "unknown" && (
                <p className="text-muted-foreground">
                  {unknownWhy} Resolve won't assume anyone is in the home. You can keep working.
                </p>
              )}
              {display.occupancy === "vacant" && guest?.status === "vacant" && (
                <p className="text-muted-foreground">
                  {guest.next_arrival
                    ? `Next arrival ${usDate(guest.next_arrival)}.`
                    : "No upcoming reservation on file."}
                </p>
              )}
              {display.showGuest && guest?.status === "occupied" && (
                <div className="space-y-1.5">
                  <Row label="Current guest" value={guest.guest_name ?? "Name not on file"} />
                  {display.contactMissing ? (
                    <p className="text-muted-foreground">
                      A current reservation exists, but its contact details are unavailable —
                      check OwnerRez.
                    </p>
                  ) : (
                    <>
                      <Row label="Phone" value={guest.phone ?? "Not on file"} />
                      <Row label="Email" value={guest.email ?? "Not on file"} />
                    </>
                  )}
                  <Row
                    label="Stay"
                    value={
                      guest.arrival && guest.departure
                        ? `${usDate(guest.arrival)} → ${usDate(guest.departure)}`
                        : "—"
                    }
                  />
                  <Row label="Reservation" value={guest.reservation_id ?? "—"} />
                </div>
              )}
            </>
          )}
        </section>

        {/* 2. Issue reservation */}
        <section className="space-y-2 border-t border-border pt-3" aria-label="Issue reservation">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <UserRound className="size-3.5" /> Issue reservation
            </p>
            {relation && (
              <Badge variant="outline">
                {ISSUE_RELATION.find((r) => r.value === relation)?.label}
              </Badge>
            )}
          </div>
          {hasIssueReservation && !editing ? (
            <div className="space-y-1.5">
              <Row label="Issue guest" value={ticket.reservation_guest_name ?? "—"} />
              <Row
                label="Stay"
                value={
                  ticket.reservation_arrival && ticket.reservation_departure
                    ? `${usDate(ticket.reservation_arrival)} → ${usDate(ticket.reservation_departure)}`
                    : "—"
                }
              />
              <Row
                label="Reservation"
                value={ticket.reservation_confirmation ?? ticket.ownerrez_booking_id ?? "—"}
              />
              <Row label="Source" value={ticket.reservation_channel ?? "—"} />
              {bookingUrl && (
                <Button asChild variant="outline" size="sm">
                  <a href={bookingUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" /> Open in OwnerRez
                  </a>
                </Button>
              )}
              {!issueIsCurrent && display.occupancy === "in_home" && (
                <p className="text-muted-foreground" data-testid="issue-guest-differs">
                  The issue guest is not the current guest. Don't contact the current guest about
                  this.
                </p>
              )}
            </div>
          ) : !editing ? (
            <p className="text-muted-foreground">No reservation is linked to this issue.</p>
          ) : null}
          {editing && (
            <div className="grid gap-2">
              <div>
                <Label htmlFor="ir-guest">Issue guest</Label>
                <Input
                  id="ir-guest"
                  value={draft.guest}
                  onChange={(e) => setDraft({ ...draft, guest: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="ir-arr">Arrival</Label>
                  <Input
                    id="ir-arr"
                    type="date"
                    value={draft.arrival}
                    onChange={(e) => setDraft({ ...draft, arrival: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="ir-dep">Departure</Label>
                  <Input
                    id="ir-dep"
                    type="date"
                    value={draft.departure}
                    onChange={(e) => setDraft({ ...draft, departure: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="ir-conf">Reservation ID</Label>
                <Input
                  id="ir-conf"
                  value={draft.confirmation}
                  onChange={(e) => setDraft({ ...draft, confirmation: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={saving} onClick={saveReservation}>
                  Save issue reservation
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {!readOnly && !editing && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-40 flex-1">
                <Label className="text-xs text-muted-foreground">Issue is tied to</Label>
                <Select
                  value={eff.relation ?? ""}
                  onValueChange={(v) => void save({ issue_reservation_relation: v })}
                  disabled={saving}
                >
                  <SelectTrigger aria-label="Issue is tied to">
                    <SelectValue placeholder={relation ? "Confirm…" : "Not set"} />
                  </SelectTrigger>
                  <SelectContent>
                    {ISSUE_RELATION.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                {hasIssueReservation ? "Edit details" : "Add stay details"}
              </Button>
            </div>
          )}
        </section>

        {/* 3 + 4. Active-stay impact and guest communication */}
        <section className="space-y-3 border-t border-border pt-3" aria-label="Guest impact">
          <div>
            <Label className="text-xs text-muted-foreground">
              Does this issue affect an active guest stay?
            </Label>
            <Select
              value={ticket.active_stay_impact ?? ""}
              onValueChange={(v) => void save({ active_stay_impact: v })}
              disabled={readOnly || saving}
            >
              <SelectTrigger aria-label="Active-stay impact" data-testid="active-stay-impact">
                <SelectValue
                  placeholder={`Not confirmed — suggested: ${ACTIVE_STAY_IMPACT.find((o) => o.value === suggestedImpact)?.label}`}
                />
              </SelectTrigger>
              <SelectContent>
                {ACTIVE_STAY_IMPACT.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!ticket.active_stay_impact && (
              <p className="mt-1 text-xs text-muted-foreground">
                Treated as {ACTIVE_STAY_IMPACT.find((o) => o.value === eff.impact)?.label} until
                someone confirms.
              </p>
            )}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Guest communication required</Label>
            <Select
              value={ticket.guest_comm_required ?? ""}
              onValueChange={(v) => void save({ guest_comm_required: v })}
              disabled={readOnly || saving}
            >
              <SelectTrigger aria-label="Guest communication required" data-testid="guest-comm">
                <SelectValue
                  placeholder={`Not confirmed — ${GUEST_COMM.find((o) => o.value === eff.comm)?.label}`}
                />
              </SelectTrigger>
              <SelectContent>
                {GUEST_COMM.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs font-medium" data-testid="guest-comm-state">
              {eff.commLabel}
              {eff.commState === "informed" && eff.commDueAt
                ? ` · next update due ${new Date(eff.commDueAt).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}`
                : ""}
            </p>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
