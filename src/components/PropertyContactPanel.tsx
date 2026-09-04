import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Phone, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPropertyContactContext } from "@/lib/guest-context.functions";
import { usDate } from "@/lib/dates";
import { useRole } from "@/hooks/useRole";
import { useDemo } from "@/components/DemoProvider";

/**
 * Read-only owner contact + current/upcoming guest block shown once a
 * property is selected (e.g. logging new work), before a ticket exists.
 *
 * Shown only to Operations coordinators and supervisors, never in Vendor,
 * Homeowner, demo, or executive views — same rule as GuestContextPanel.
 * Data comes live from OwnerRez and the existing owner_programs record on
 * each view and is never stored or written back.
 */

function dateRange(arrival: string | null, departure: string | null) {
  if (!arrival || !departure) return "—";
  return `${usDate(arrival)} → ${usDate(departure)}`;
}

function formatDate(v: string | null) {
  if (!v) return null;
  return usDate(v);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function PropertyContactPanel({ propertyId }: { propertyId: string }) {
  const { can, isVendor, isOwner } = useRole();
  const { demoMode } = useDemo();
  const fetchContext = useServerFn(getPropertyContactContext);

  const enabled = Boolean(propertyId) && can("guest_contact") && !isVendor && !isOwner && !demoMode;

  const query = useQuery({
    queryKey: ["property-contact-context", propertyId],
    enabled,
    staleTime: 30 * 1000,
    queryFn: () => fetchContext({ data: { propertyId } }),
  });

  if (!enabled) return null;
  if (query.isLoading) return <Skeleton className="h-40 w-full" />;

  const result = query.data;
  // Belt-and-suspenders guard against an out-of-order response landing after
  // the selection has already moved to a different property — react-query's
  // queryKey already scopes the cache by propertyId, but this also refuses
  // to render a payload that doesn't say it's for the property on screen.
  if (!result || result.visible === false || result.propertyId !== propertyId) return null;

  const { owner, guest, activeOwnerProgram } = result;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserRound className="size-4" /> Owner &amp; guest context
        </CardTitle>
        <CardDescription>
          Guest detail is live from OwnerRez; the designated primary owner comes from the imported
          owner directory. Read-only — nothing here is saved or sent.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Phone className="size-3.5" /> Designated primary owner
            </p>
            {activeOwnerProgram && <Badge variant="outline">Active Owner Program</Badge>}
          </div>

          {owner.status === "matched" && (
            <>
              <Row label="Name" value={owner.name ?? "Not on file"} />
              <Row label="Phone" value={owner.phone ?? "Not on file"} />
              <Row label="Email" value={owner.email ?? "Not on file"} />
              <p className="text-xs text-muted-foreground">
                Source: {owner.source ?? "unknown"}
                {owner.sourceId ? ` #${owner.sourceId}` : ""} · last checked{" "}
                {owner.syncedAt ? formatDate(owner.syncedAt) : "never"}
                {owner.stale ? " · may be out of date" : ""}
              </p>
            </>
          )}

          {owner.status === "unmatched" && (
            <p className="text-muted-foreground">
              No owner is mapped to this home in the owner directory. {owner.detail ?? ""} This is a
              gap in the directory, not a statement that the home has no owner.
            </p>
          )}

          {owner.status === "ambiguous" && (
            <p className="text-muted-foreground">
              More than one owner contact matches this home, so none was chosen automatically.{" "}
              {owner.detail ?? ""} A supervisor needs to confirm the designated owner.
            </p>
          )}

          {owner.status === "source_error" && (
            <p className="text-danger">
              The owner directory could not be read for this home. {owner.detail ?? ""} Treat this
              as unknown, not as "no owner".
            </p>
          )}

          {owner.status === "not_synced" && (
            <p className="text-muted-foreground">
              This home has not been through an owner-directory import yet, so no primary owner can
              be shown.
            </p>
          )}
        </div>

        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Guest</p>
          {guest.status === "not_linked" && (
            <p className="text-muted-foreground">
              This home is not linked to an OwnerRez listing yet.
            </p>
          )}
          {guest.status === "vacant" && (
            <p className="text-muted-foreground">
              Vacant.{" "}
              {guest.next_arrival
                ? `Next arrival ${formatDate(guest.next_arrival)}.`
                : "No upcoming reservation on file."}
            </p>
          )}
          {guest.status === "ambiguous" && (
            <p className="text-muted-foreground">
              More than one reservation matches right now — verify the guest directly in OwnerRez
              before contacting anyone.
            </p>
          )}
          {guest.status === "source_error" && (
            <p className="text-muted-foreground">
              Guest contact unavailable — verify in OwnerRez. ({guest.message})
            </p>
          )}
          {guest.status === "occupied" && (
            <>
              <Row label="Name" value={guest.guest_name ?? "Not on file"} />
              <Row label="Phone" value={guest.phone ?? "Not on file"} />
              <Row label="Email" value={guest.email ?? "Not on file"} />
              <Row label="Stay" value={dateRange(guest.arrival, guest.departure)} />
              <Row label="Reservation" value={guest.reservation_id ?? "—"} />
              {guest.stay_kind && (
                <Badge variant="secondary">
                  {guest.stay_kind === "mid_term" ? "Mid-term tenant" : "Short-term guest"}
                </Badge>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
